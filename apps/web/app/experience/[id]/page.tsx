"use client";

/**
 * Musicathon Experience Player
 * The hero screen: synced lyrics + reviewer's moments fire in time with Spotify playback
 *
 * Real implementation uses:
 * - Spotify Web Playback SDK for audio
 * - Musixmatch for synced lyrics (fetched live, never cached per contest rules)
 * - Album color extraction for immersive gradients
 */

import { useEffect, useState, useRef, useLayoutEffect, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { WebPlaybackSDK, type PlayerState } from "@/lib/spotify-player";
import { getActiveAnnotations, type SyncedLyrics, type ActiveAnnotations } from "@/lib/sync-engine";
import type { Review, AlbumReview } from "@/lib/types";
import { paletteFromString, type Palette } from "@/lib/palette";
import { LNArt, lnFmt } from "@/components/ln/atoms";
import { getReviews } from "@/lib/api";
import { LyricShareModal } from "@/components/share/LyricShareModal";
import { VisualiserEngine, PositionPredictor, createMockRhythm } from "@/lib/visualiser-engine";
import { deriveBaseAesthetic } from "@/lib/visualiser-base-aesthetic";
import { VisualiserCanvas } from "@/components/VisualiserCanvas";
import type { VisualState } from "@/lib/visualiser-types";

function ExperienceContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reviewId = params.id as string;
  const expType = searchParams.get("type");
  const isAlbumExp = expType === "album";
  const isFeedExp = expType === "feed";
  const isPlaylistExp = expType === "playlist";

  // `segments` holds every playable track in order (one for a track review, every
  // reviewed track for an album, the whole community feed for a feed experience);
  // `idx` is the song you're on and `review` always points at the current segment
  // so the rest of the player renders unchanged.
  const [segments, setSegments] = useState<Review[]>([]);
  const [idx, setIdx] = useState(0);
  const [playlistLabel, setPlaylistLabel] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [lyrics, setLyrics] = useState<SyncedLyrics | null>(null);
  const [translation, setTranslation] = useState<SyncedLyrics | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [annotations, setAnnotations] = useState<ActiveAnnotations | null>(null);
  const [player, setPlayer] = useState<WebPlaybackSDK | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coverPalette, setCoverPalette] = useState<Palette | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareMoment, setShareMoment] = useState<any>(null);
  // "Experience more" picks — recent community track posts to jump to (track mode).
  const [moreReviews, setMoreReviews] = useState<Review[]>([]);

  // Visualiser state
  const [visualiserEnabled, setVisualiserEnabled] = useState(true);
  const [visualState, setVisualState] = useState<VisualState | null>(null);
  const [beatOffset, setBeatOffset] = useState(0); // Beat phase offset for tuning
  const engineRef = useRef<VisualiserEngine | null>(null);
  const predictorRef = useRef<PositionPredictor>(new PositionPredictor());

  // Lyric auto-scroll
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const colRef = useRef<HTMLDivElement | null>(null);
  const [lyricShift, setLyricShift] = useState(0);

  // The Spotify SDK is initialised once per page; navigating songs reuses it.
  const playerRef = useRef<WebPlaybackSDK | null>(null);
  const initedRef = useRef(false);
  // The track id we last issued a play for, so we don't re-issue on every render.
  const playedTrackRef = useRef<string | null>(null);
  // For album/feed auto-advance: track the last position to detect a track end.
  const lastPosRef = useRef(0);
  const endedHandledRef = useRef(false);

  const INK = "#d7c9d0";
  const muted = (a: number) => `rgba(215,201,208,${a})`;

  // Fetch review data — a single track review, or every reviewed track of an album.
  useEffect(() => {
    async function fetchReview() {
      try {
        if (isFeedExp) {
          // Compile the GLOBAL community feed into a playlist of track reviews
          // (feed:"friends" is the public all-reviews feed; your own posts are
          // included), starting at the post that was clicked when it's present.
          const all = await getReviews({ feed: "friends" });
          const segs: Review[] = (all || [])
            .filter((r) => r.track?.trackId && !r.track.trackId.startsWith("lastfm-"))
            // Newest first, so the queue starts on the most recent track review.
            .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          if (segs.length === 0) throw new Error("No community posts to play yet");
          // The community experience always opens on the most recent track review.
          setPlaylistLabel("Community feed");
          setSegments(segs);
          setIdx(0);
          setReview(segs[0]);
        } else if (isAlbumExp) {
          const res = await fetch(`/api/album-reviews/${reviewId}`);
          if (!res.ok) throw new Error("Failed to load album review");
          const data = await res.json();
          const ar: AlbumReview = data.albumReview;
          // Each reviewed track becomes a playable segment, carrying the album
          // reviewer as its author. Only tracks with a real Spotify id are kept.
          const segs: Review[] = (ar.trackReviews || [])
            .filter((tr) => tr.track?.trackId)
            .map((tr) => ({ ...tr, user: tr.user || ar.user }));
          if (segs.length === 0) throw new Error("This album review has no tracks to play");
          setPlaylistLabel(ar.album?.name || null);
          setSegments(segs);
          setIdx(0);
          setReview(segs[0]);
        } else if (isPlaylistExp) {
          const res = await fetch(`/api/playlists/${reviewId}`);
          if (!res.ok) throw new Error("Failed to load playlist");
          const data = await res.json();
          const pl = data.playlist;
          // Each playlist track becomes a playable segment; the curator's note
          // rides along as the segment's take.
          const segs: Review[] = (pl.tracks || [])
            .filter((t: any) => t.trackId)
            .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
            .map((t: any) => ({
              id: `${pl.id}-${t.id}`,
              userId: pl.userId,
              user: pl.user,
              track: { trackId: t.trackId, name: t.name, artist: t.artist, album: t.album || "", artworkUrl: t.artworkUrl || "" },
              rating: 0,
              take: t.take || t.note || undefined,
              // Timestamped moments fire on the scrubber + lyric sync, like albums.
              notes: (t.notes || []).map((n: any) => ({
                seconds: n.seconds,
                label: n.label,
                note: n.note || undefined,
                lyric: n.lyric || undefined,
              })),
              createdAt: pl.createdAt,
              likeCount: 0,
              repostCount: 0,
            }));
          if (segs.length === 0) throw new Error("This playlist has no playable tracks");
          setPlaylistLabel(pl.title || null);
          setSegments(segs);
          setIdx(0);
          setReview(segs[0]);
        } else {
          const res = await fetch(`/api/reviews/${reviewId}`);
          if (!res.ok) throw new Error("Failed to load review");
          const data = await res.json();
          setSegments([data.review]);
          setIdx(0);
          setReview(data.review);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load review");
      }
    }

    fetchReview();
  }, [reviewId, isAlbumExp, isFeedExp, isPlaylistExp]);

  // For a single-track experience, pull 4 other posts from the GLOBAL community
  // feed (feed:"friends" is the public all-reviews feed) to "Experience more".
  useEffect(() => {
    if (isAlbumExp || isFeedExp || isPlaylistExp) return;
    let cancelled = false;
    getReviews({ feed: "friends" })
      .then((all) => {
        if (cancelled) return;
        const picks = (all || [])
          .filter((r) => r.track?.trackId && !r.track.trackId.startsWith("lastfm-") && r.id !== reviewId)
          .slice(0, 4);
        setMoreReviews(picks);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAlbumExp, isFeedExp, isPlaylistExp, reviewId]);

  // Exit the experience player entirely: stop playback (tear down the shared
  // device) and leave for home, rather than just going back a page.
  const exitExperience = () => {
    try {
      WebPlaybackSDK.disconnectShared();
    } catch {
      /* best-effort */
    }
    playerRef.current = null;
    router.push("/");
  };

  // Back also leaves the experience player, so stop playback (tear down the
  // shared device) before returning to the previous page.
  const goBack = () => {
    try {
      WebPlaybackSDK.disconnectShared();
    } catch {
      /* best-effort */
    }
    playerRef.current = null;
    router.back();
  };

  // Play/pause. Right after a device is created the SDK may not have an active
  // playback state yet, so togglePlay() would be a no-op (the bug where the play
  // button did nothing until a refresh). If there's no state, start playback of
  // the current track via the REST path to activate the device first.
  const handlePlayPause = async () => {
    if (!player) return;
    try {
      const state = await player.getCurrentState();
      if (!state) {
        const tid = review?.track?.trackId;
        if (tid) await player.playTrack(`spotify:track:${tid}`);
      } else {
        await player.togglePlay();
      }
    } catch (e) {
      console.error("[Experience] play/pause failed:", e);
    }
  };

  // Jump to another song in the album/feed experience. Playback follows the
  // selected review via the effect below, so we only move the pointer here.
  const goToSegment = (n: number) => {
    if (segments.length < 2) return;
    const clamped = Math.max(0, Math.min(segments.length - 1, n));
    if (clamped === idx) return;
    setIdx(clamped);
    setReview(segments[clamped]);
  };

  // Initialize the Spotify player once. Playback itself is driven by the effect
  // below (which follows the selected review). Optional — preview mode (lyrics
  // only) works without it.
  useEffect(() => {
    if (initedRef.current || segments.length === 0) return;
    initedRef.current = true;

    async function initPlayer() {
      try {
        const tokenRes = await fetch("/api/spotify/token");

        if (!tokenRes.ok) {
          const errorData = await tokenRes.json().catch(() => ({}));
          console.warn("[Experience] Spotify not available:", errorData.error);
          // Don't set error - just continue in preview mode
          setLoading(false);
          return;
        }

        const { access_token } = await tokenRes.json();

        // Reuse the shared, already-connected device when one exists so
        // navigating between experiences is instant and the transport stays live.
        const sdk = await WebPlaybackSDK.getShared(access_token, (state) => {
          setPlayerState(state);
        });

        playerRef.current = sdk;
        setPlayer(sdk);
        setLoading(false);
      } catch (err) {
        console.warn("[Experience] Could not initialize Spotify player:", err);
        // Continue in preview mode - not a fatal error
        setLoading(false);
      }
    }

    initPlayer();

    // Keep the shared player alive across navigations — don't disconnect here, or
    // the next experience would have to register a fresh device all over again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments]);

  // Playback follows the selected review: whenever the current track changes (on
  // load, on next/prev, on auto-advance), play it on the shared device. Routed
  // through one place so a reused page instance still starts the right song.
  useEffect(() => {
    let tid = review?.track?.trackId;
    if (!player || !tid) return;
    if (playedTrackRef.current === tid) return;

    // MIGRATION FIX: If trackId is a UUID (old data), search for Spotify ID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tid);
    if (isUUID) {
      console.warn("[Experience] Track ID is a UUID, searching for Spotify ID...");
      const trackName = review?.track?.name;
      const artistName = review?.track?.artist;

      if (trackName && artistName) {
        fetch(`/api/search?q=${encodeURIComponent(`${trackName} ${artistName}`)}&type=track`)
          .then(res => res.json())
          .then(data => {
            const spotifyTrack = data.tracks?.[0];
            if (spotifyTrack?.trackId) {
              console.log("[Experience] Found Spotify ID:", spotifyTrack.trackId);
              playedTrackRef.current = spotifyTrack.trackId;
              player.playTrack(`spotify:track:${spotifyTrack.trackId}`).catch((e) => {
                console.error("[Experience] Failed to play track:", e);
              });
            } else {
              console.error("[Experience] No Spotify track found");
              setError("Track not available on Spotify");
            }
          })
          .catch(e => console.error("[Experience] Search failed:", e));
      }
      return;
    }

    playedTrackRef.current = tid;
    player.playTrack(`spotify:track:${tid}`).catch((e) => {
      console.error("[Experience] Failed to play track:", e);
    });
  }, [player, review?.track?.trackId]);

  // Album / feed experiences auto-advance: when the current song finishes (the
  // SDK reports paused at position 0 after we were near the end), play the next.
  useEffect(() => {
    if (!playerState) return;
    const { positionMs, durationMs, isPlaying } = playerState;
    // The SDK signals a finished single track by pausing — and reports the
    // position either back at 0 or pinned at the very end, depending on timing.
    // Treat either as "ended" as long as we were near the end just before.
    const wasNearEnd = lastPosRef.current > 0 && durationMs > 0 && lastPosRef.current >= durationMs - 2500;
    // Within 400ms of the end is effectively the track finishing, not a human
    // pause, so this won't false-trigger when someone pauses mid-song.
    const atEdge = positionMs === 0 || (durationMs > 0 && positionMs >= durationMs - 400);
    if (!isPlaying && atEdge && wasNearEnd && !endedHandledRef.current) {
      endedHandledRef.current = true;
      if (segments.length > 1 && idx < segments.length - 1) {
        goToSegment(idx + 1);
      }
    }
    // Once a track is genuinely playing again, re-arm the end detector.
    if (isPlaying && positionMs > 1500) {
      endedHandledRef.current = false;
    }
    lastPosRef.current = positionMs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerState, segments.length, idx]);

  // Initialize visualiser engine when track changes - fetch REAL audio analysis
  useEffect(() => {
    if (!review?.track) return;

    async function initializeVisualiser() {
      if (!review?.track) return;

      try {
        // Fetch real audio analysis from API (genre + BPM)
        const trackName = encodeURIComponent(review.track.name);
        const artistName = encodeURIComponent(review.track.artist);
        const response = await fetch(`/api/audio-analysis?track=${trackName}&artist=${artistName}`);

        let genre = 'Pop';
        let bpm = 120;
        let audioFeatures = undefined;
        let lastfmTags: string[] = [];

        if (response.ok) {
          const data = await response.json();
          genre = data.genre || 'Pop';
          bpm = data.bpm || 120;
          audioFeatures = data.audioFeatures;
          lastfmTags = data.lastfmTags || [];
          console.log(`[Visualiser] Loaded audio analysis: ${genre} @ ${bpm} BPM${lastfmTags.length > 0 ? ` (tags: ${lastfmTags.join(', ')})` : ''}`);
        } else {
          console.warn('[Visualiser] Audio analysis failed, using defaults');
        }

        // Derive base aesthetic from real genre + audio features + Last.fm tags
        const baseAesthetic = deriveBaseAesthetic(genre, audioFeatures, lastfmTags);

        // Create rhythm from real BPM
        const rhythm = createMockRhythm(bpm);

        // Extract rhythmic texture features
        const rhythmicTexture = audioFeatures ? {
          rhythmicDensity: audioFeatures.rhythmicDensity,
          percussiveStrength: audioFeatures.percussiveStrength,
          grooveRegularity: audioFeatures.grooveRegularity,
        } : undefined;

        // Initialize engine with rhythmic texture
        engineRef.current = new VisualiserEngine(baseAesthetic, rhythm, rhythmicTexture);
      } catch (error) {
        console.error('[Visualiser] Failed to initialize:', error);
        // Fallback to defaults
        const baseAesthetic = deriveBaseAesthetic('Pop');
        const rhythm = createMockRhythm(120);
        engineRef.current = new VisualiserEngine(baseAesthetic, rhythm);
      }
    }

    initializeVisualiser();
  }, [review]);

  // Fetch lyrics when track loads (works with or without Spotify player)
  useEffect(() => {
    if (!review?.track) return;

    async function fetchLyrics() {
      try {
        // Use stored track data (not playerState which might differ)
        // Clean up trailing periods and extra whitespace
        const trackName = review?.track?.name?.trim().replace(/\.\s*$/, '').trim();
        const artistName = review?.track?.artist?.trim();

        if (!trackName || !artistName) return;

        console.log("[Experience] Fetching lyrics for:", trackName, "by", artistName);
        const res = await fetch(`/api/lyrics?track=${encodeURIComponent(trackName)}&artist=${encodeURIComponent(artistName)}`);

        if (res.status === 401 || res.status === 403) {
          setError("Musixmatch trial key has expired. See the video for the full experience!");
          return;
        }

        if (!res.ok) {
          console.log("No lyrics available for this track");
          setLyrics(null);
          return;
        }

        const data = await res.json();
        if (data.lyrics && Array.isArray(data.lyrics)) {
          setLyrics({ lines: data.lyrics });
          console.log("[Experience] Loaded", data.lyrics.length, "synced lyric lines");

          // Check if translation is available
          if (data.translation && Array.isArray(data.translation)) {
            setTranslation({ lines: data.translation });
            setShowTranslation(true); // Show translation by default
            console.log("[Experience] Translation available");
          } else {
            setTranslation(null);
            setShowTranslation(false);
          }
        } else {
          setLyrics(null);
          setTranslation(null);
          setShowTranslation(false);
        }
      } catch (err) {
        console.error("Failed to fetch lyrics:", err);
        setLyrics(null);
        setTranslation(null);
        setShowTranslation(false);
      }
    }

    fetchLyrics();
  }, [review]);

  // Update annotations whenever player state changes
  useEffect(() => {
    if (!playerState) return;
    const newAnnotations = getActiveAnnotations(playerState, lyrics, review);
    setAnnotations(newAnnotations);
  }, [playerState, lyrics, review]);

  // Poll position while playing for continuous lyric sync + visualiser predictor update
  useEffect(() => {
    if (!player || !playerState?.isPlaying) return;

    const interval = setInterval(async () => {
      const currentState = await player.getCurrentState();
      if (currentState) {
        setPlayerState(currentState);
        // Update visualiser position predictor (5Hz)
        predictorRef.current.update(currentState.positionMs, currentState.isPlaying);
      }
    }, 200); // Update 5 times per second

    return () => clearInterval(interval);
  }, [player, playerState?.isPlaying]);

  // 60fps visualiser rendering loop
  useEffect(() => {
    if (!visualiserEnabled || !engineRef.current) return;

    let animationFrameId: number;

    function renderLoop() {
      if (!engineRef.current) {
        animationFrameId = requestAnimationFrame(renderLoop);
        return;
      }

      // Predict current position (60fps smooth interpolation from 5Hz polls)
      const predictedPos = predictorRef.current.predict();
      const isPlaying = predictorRef.current.getIsPlaying();

      // Get current lyric line text
      const currentLine = annotations?.activeLine?.text || '';

      // Check if moment is active (lingers for 9s after firing)
      const positionSec = predictedPos / 1000;
      const momentActive = review?.notes?.some(
        (m) => positionSec >= m.seconds && positionSec < m.seconds + 9
      ) || false;

      // Get visual state from engine (with beat offset for tuning)
      const state = engineRef.current.getVisualState(
        predictedPos + beatOffset,
        isPlaying,
        currentLine,
        momentActive
      );

      setVisualState(state);

      animationFrameId = requestAnimationFrame(renderLoop);
    }

    renderLoop();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [visualiserEnabled, annotations, review?.notes]);

  // Lyric auto-scroll effect
  useLayoutEffect(() => {
    if (!lyrics?.lines || annotations?.activeLineIndex === undefined) return;

    const activeIndex = annotations.activeLineIndex >= 0 ? annotations.activeLineIndex : 0;
    const el = lineRefs.current[activeIndex];
    const col = colRef.current;

    if (el && col) {
      setLyricShift(col.clientHeight * 0.40 - (el.offsetTop + el.offsetHeight / 2));
    }
  }, [annotations?.activeLineIndex, lyrics?.lines]);

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: "center", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", background: "var(--ln-bg)", color: "var(--ln-fg)" }}>
        <h1 style={{ margin: 0, marginBottom: 16 }}>Error</h1>
        <p style={{ opacity: 0.7 }}>{error}</p>
        <button onClick={() => router.back()} style={{ marginTop: 24, padding: "12px 24px", background: "var(--ln-accent)", color: "#161013", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
          Go Back
        </button>
      </div>
    );
  }

  if (loading || !review) {
    return (
      <div style={{ padding: 40, textAlign: "center", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ln-bg)", color: "var(--ln-fg)" }}>
        Loading Experience...
      </div>
    );
  }

  const p = coverPalette || paletteFromString(review.track.trackId || review.track.album || review.track.name);
  const accent = p.accent;
  const positionSec = (playerState?.positionMs || 0) / 1000;
  const durationSec = (playerState?.durationMs || 1) / 1000;
  const progress = durationSec > 0 ? (positionSec / durationSec) * 100 : 0;

  // Find active moment (lingers for 9s after the playhead hits it, so the
  // annotation doesn't vanish before you've read it alongside the lyric).
  const activeMoment = review.notes?.find((m) => positionSec >= m.seconds && positionSec < m.seconds + 9) || null;

  // The written note: first line is the caption, the rest is the full review
  // (revealed on expand). No note → the card is hidden entirely.
  const takeLines = (review.take || "").split("\n").map((s) => s.trim()).filter(Boolean);
  const caption = takeLines[0] || "";
  const hasMoreNote = takeLines.length > 1;

  // Album / feed experiences are queues; show the next song. A single track
  // experience instead offers more community posts to jump to.
  const isPlaylist = isAlbumExp || isFeedExp || isPlaylistExp;
  const upNext = isPlaylist && idx < segments.length - 1 ? segments[idx + 1] : null;

  // Nearest moment to current position for sharing
  const nearestMoment = review.notes && review.notes.length > 0
    ? review.notes.reduce((prev, curr) =>
        Math.abs(curr.seconds - positionSec) < Math.abs(prev.seconds - positionSec) ? curr : prev
      )
    : null;

  return (
    <main style={{ position: "relative", minHeight: "100vh", overflow: "hidden", color: INK }}>
      {/* Immersive album-colour flood */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0, overflow: "hidden", background: "#1a0d0e" }}>
        <div style={{ position: "absolute", inset: -120, filter: "blur(90px)", transform: "scale(1.1)", opacity: 0.95 }}>
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(60% 50% at 28% 16%, ${p.mid} 0%, ${p.deep} 58%, ${p.lo} 100%)` }} />
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(46% 42% at 82% 24%, ${p.glow}cc 0%, transparent 60%)`, animation: "mu-breathe 7s ease-in-out infinite" }} />
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(44% 40% at 14% 90%, ${accent}55 0%, transparent 58%)` }} />
        </div>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(18,9,10,0.55) 0%, rgba(18,9,10,0.32) 30%, rgba(18,9,10,0.72) 100%)" }} />
      </div>

      {/* Visualiser Canvas Layer (between background and content) */}
      {visualiserEnabled && visualState && (
        <VisualiserCanvas
          visualState={visualState}
          width={1920}
          height={1080}
        />
      )}

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1140, margin: "0 auto", padding: "92px 24px 60px" }}>
        {/* Top row: back + visualiser toggle + vision-demo tag */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={goBack} className="ln-press" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(244,239,230,0.06)", border: "1px solid rgba(244,239,230,0.16)", color: INK, borderRadius: 999, padding: "8px 15px", cursor: "pointer", fontFamily: "var(--ln-body)", fontSize: 13.5, fontWeight: 600 }}>
              <span style={{ fontSize: 15, lineHeight: 1 }}>←</span> Back
            </button>
            <button onClick={exitExperience} className="ln-press" title="Stop playback and leave the experience" style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(244,239,230,0.06)", border: `1px solid ${accent}55`, color: INK, borderRadius: 999, padding: "8px 15px", cursor: "pointer", fontFamily: "var(--ln-body)", fontSize: 13.5, fontWeight: 600 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke={INK} strokeWidth="2.2" strokeLinecap="round" /></svg>
              Exit player
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setVisualiserEnabled(!visualiserEnabled)} className="ln-press" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: visualiserEnabled ? `${accent}1a` : "rgba(244,239,230,0.06)", border: `1px solid ${visualiserEnabled ? `${accent}55` : "rgba(244,239,230,0.16)"}`, color: visualiserEnabled ? accent : INK, borderRadius: 999, padding: "6px 12px", cursor: "pointer", fontFamily: "var(--ln-mono)", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: visualiserEnabled ? accent : "rgba(244,239,230,0.5)" }} />
              Visualiser
            </button>
            <span style={{ fontFamily: "var(--ln-mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: muted(0.5), border: "1px solid rgba(244,239,230,0.14)", borderRadius: 999, padding: "5px 11px" }}>
              the Experience · Musicathon
            </span>
          </div>
        </div>

        <div className="mu-exp-grid" style={{ display: "grid", gridTemplateColumns: "minmax(300px, 380px) 1fr", gap: 48, alignItems: "start" }}>
          {/* LEFT — cover, transport, note */}
          <div className="mu-exp-left" style={{ position: "sticky", top: 92, display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Album art */}
            <div style={{ position: "relative", borderRadius: 18, overflow: "hidden", boxShadow: "0 40px 90px -32px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.06)" }}>
              <div style={{ aspectRatio: "1 / 1", position: "relative" }}>
                <LNArt palette={p} src={review.track.artworkUrl} radius={18} noTag onPaletteExtracted={setCoverPalette} />
                {/* Playing indicator */}
                {playerState?.isPlaying && (
                  <div style={{ position: "absolute", top: 16, right: 16, width: 40, height: 40, borderRadius: "50%", background: "rgba(8,6,7,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.12)" }}>
                    <MUEq color={accent} />
                  </div>
                )}
              </div>
            </div>

            {/* Title + artist */}
            <div>
              {playlistLabel && segments.length > 1 && (
                <div style={{ marginBottom: 6, fontFamily: "var(--ln-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: accent }}>
                  {playlistLabel} · {idx + 1} / {segments.length}
                </div>
              )}
              <h1 style={{ margin: 0, fontFamily: "var(--ln-album)", fontWeight: 600, fontSize: 30, lineHeight: 1.06, letterSpacing: "-0.01em", color: INK }}>
                {playerState?.trackName || review.track.name}
              </h1>
              <div style={{ marginTop: 5, fontFamily: "var(--ln-body)", fontSize: 15, color: muted(0.7) }}>
                {playerState?.artistName || review.track.artist}
              </div>
            </div>

            {/* Scrubber */}
            <div>
              <div onClick={(e) => {
                if (!player || !playerState) return;
                const bar = e.currentTarget.getBoundingClientRect();
                const ratio = Math.min(1, Math.max(0, (e.clientX - bar.left) / bar.width));
                player.seek(ratio * playerState.durationMs);
              }} style={{ position: "relative", height: 22, display: "flex", alignItems: "center", cursor: "pointer" }}>
                <div style={{ position: "absolute", left: 0, right: 0, height: 5, borderRadius: 3, background: "rgba(244,239,230,0.16)" }} />
                <div style={{ position: "absolute", left: 0, height: 5, borderRadius: 3, background: accent, width: `${progress}%`, transition: "width 0.22s linear" }} />
                {/* Moment markers */}
                {review.notes?.map((m, i) => {
                  const isActive = activeMoment === m;
                  const markerPos = durationSec > 0 ? (m.seconds / durationSec) * 100 : 0;
                  return (
                    <div key={i} title={m.label} style={{ position: "absolute", left: `${markerPos}%`, transform: "translateX(-50%)", width: isActive ? 13 : 9, height: isActive ? 13 : 9, borderRadius: "50%", background: isActive ? accent : "rgba(240,226,204,0.5)", border: "2px solid #1a0d0e", boxShadow: isActive ? `0 0 0 4px ${accent}55` : "none", transition: "all 0.2s" }} />
                  );
                })}
                {/* Playhead */}
                <div style={{ position: "absolute", left: `${progress}%`, transform: "translateX(-50%)", width: 14, height: 14, borderRadius: "50%", background: INK, boxShadow: "0 2px 6px rgba(0,0,0,0.6)", transition: "left 0.22s linear" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--ln-mono)", fontSize: 11, color: muted(0.55), marginTop: 2 }}>
                <span>{lnFmt(positionSec)}</span>
                <span>{lnFmt(durationSec)}</span>
              </div>
            </div>

            {/* Transport controls, or a note for non-Spotify accounts. Playback is
                only available to users who continued with Spotify — there's no
                connect-later flow. */}
            {!player ? (
              <div style={{ textAlign: "center", padding: "20px 16px", background: "rgba(255,255,255,0.05)", borderRadius: 12, border: `1px solid ${accent}33` }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: accent }}>
                  Sign up with your Spotify account to get the full experience
                </div>
              </div>
            ) : (
              // Album experience gets prev/next to move between songs; a single
              // track review just gets start/stop.
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24 }}>
                {segments.length > 1 && (
                  <button onClick={() => goToSegment(idx - 1)} disabled={idx === 0} className="ln-press" style={{ width: 46, height: 46, borderRadius: "50%", border: "none", background: "transparent", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.3 : 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }} aria-label="previous song">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill={INK}><path d="M6 5v14h2V5H6zm3 7l9 7V5l-9 7z" /></svg>
                  </button>
                )}
                <button onClick={handlePlayPause} className="ln-press" style={{ width: 64, height: 64, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }} aria-label={playerState?.isPlaying ? "pause" : "play"}>
                  {playerState?.isPlaying ? (
                    <svg width="42" height="42" viewBox="0 0 24 24" fill="#fff" style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))" }}><rect x="6.5" y="5" width="4" height="14" rx="1.7" /><rect x="13.5" y="5" width="4" height="14" rx="1.7" /></svg>
                  ) : (
                    <svg width="42" height="42" viewBox="0 0 24 24" fill="#fff" stroke="#fff" strokeWidth="3.4" strokeLinejoin="round" strokeLinecap="round" style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))" }}><path d="M8 6.2v11.6l10-5.8z" /></svg>
                  )}
                </button>
                {segments.length > 1 && (
                  <button onClick={() => goToSegment(idx + 1)} disabled={idx === segments.length - 1} className="ln-press" style={{ width: 46, height: 46, borderRadius: "50%", border: "none", background: "transparent", cursor: idx === segments.length - 1 ? "default" : "pointer", opacity: idx === segments.length - 1 ? 0.3 : 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }} aria-label="next song">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill={INK}><path d="M16 5v14h2V5h-2zM6 5v14l9-7-9-7z" /></svg>
                  </button>
                )}
              </div>
            )}

            {/* Spotify attribution */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "var(--ln-mono)", fontSize: 10.5, letterSpacing: "0.04em", color: muted(0.55) }}>
              <span style={{ width: 14, height: 14, borderRadius: "50%", background: "#1DB954", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="9" height="9" viewBox="0 0 24 24"><path d="M17.2 16.6c-.2.3-.6.4-.9.2-2.5-1.5-5.6-1.9-9.3-1-.4.1-.7-.1-.8-.5-.1-.4.1-.7.5-.8 4-.9 7.5-.5 10.3 1.2.3.2.4.6.2.9zm1.4-3.1c-.3.4-.7.5-1.1.3-2.8-1.7-7.1-2.2-10.4-1.2-.4.1-.9-.1-1-.5-.1-.4.1-.9.5-1 3.8-1.1 8.5-.6 11.7 1.4.3.2.5.7.3 1z" fill="#fff" /></svg>
              </span>
              streaming via Spotify
            </div>
          </div>

          {/* RIGHT — reviewer note + synced lyrics */}
          <div className="mu-exp-right" style={{ minWidth: 0 }}>
            {/* Reviewer note — only when the author actually wrote one */}
            {caption && (
              <div key={review.id} style={{ borderRadius: 16, border: `1px solid ${accent}33`, background: `${accent}10`, padding: "16px 18px", animation: "mu-rise 0.45s cubic-bezier(.2,.8,.2,1) both" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 11 }}>
                  <span style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${accent}26`, border: `1px solid ${accent}66`, color: accent, fontFamily: "var(--ln-display)", fontWeight: 600, fontSize: 14 }}>
                    {review.user?.displayName?.[0] || "U"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
                    <div style={{ fontFamily: "var(--ln-mono)", fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", color: accent }}>
                      what {review.user?.displayName?.split(" ")[0] || "they"} wrote
                    </div>
                    <div style={{ fontFamily: "var(--ln-body)", fontSize: 13, color: muted(0.7) }}>@{review.user?.handle || "user"}</div>
                  </div>
                  {hasMoreNote && (
                    <button onClick={() => setNoteOpen((v) => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: muted(0.55), fontFamily: "var(--ln-mono)", fontSize: 11 }}>
                      {noteOpen ? "collapse" : "expand"}
                    </button>
                  )}
                </div>
                <p style={{ margin: 0, fontFamily: "var(--ln-preview)", fontStyle: "italic", fontWeight: 500, fontSize: 18, lineHeight: 1.45, color: INK, wordWrap: "break-word" }}>
                  {caption}
                </p>
                {noteOpen && hasMoreNote && (
                  <div style={{ marginTop: 11, display: "flex", flexDirection: "column", gap: 9 }}>
                    {takeLines.slice(1).map((ln, i) => (
                      <p key={i} style={{ margin: 0, fontFamily: "var(--ln-body)", fontSize: 14.5, lineHeight: 1.6, color: muted(0.82), wordWrap: "break-word" }}>
                        {ln}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Active moment live callout */}
            <div style={{ minHeight: 52, marginTop: 12, position: "relative" }}>
              {activeMoment && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, borderRadius: 12, background: accent, color: "#2c1517", padding: "11px 15px", animation: "mu-pop 0.3s cubic-bezier(.16,1,.3,1) both", boxShadow: `0 14px 30px -12px ${accent}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <span style={{ fontFamily: "var(--ln-mono)", fontSize: 13, fontWeight: 700 }}>{lnFmt(activeMoment.seconds)}</span>
                    <span style={{ width: 1, height: 20, background: "rgba(44,21,23,0.3)" }} />
                    <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--ln-preview)", fontStyle: (activeMoment as any).lyric ? "italic" : "normal", fontSize: 17, fontWeight: 600, lineHeight: 1.4, wordWrap: "break-word", color: (activeMoment as any).lyric ? "#f5f1e8" : "inherit" }}>
                      {(activeMoment as any).lyric || activeMoment.label}
                    </span>
                    <button onClick={() => { setShareMoment(activeMoment); setShareModalOpen(true); }} className="ln-press" title="Share this lyric" style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(44,21,23,0.16)", border: "none", color: "#2c1517", borderRadius: 999, padding: "6px 11px", cursor: "pointer", fontFamily: "var(--ln-body)", fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 15V4M12 4l-4 4M12 4l4 4M5 13v5a2 2 0 002 2h10a2 2 0 002-2v-5" stroke="#2c1517" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      Share
                    </button>
                  </div>
                  {activeMoment.note && (
                    <div style={{ fontFamily: "var(--ln-body)", fontSize: 15, lineHeight: 1.45, color: "#f5f1e8", paddingLeft: 3 }}>
                      {activeMoment.note}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Synced lyrics */}
            {lyrics && lyrics.lines && lyrics.lines.length > 0 ? (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
                  <span style={{ fontFamily: "var(--ln-label)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: accent }}>lyrics</span>
                  <span style={{ flex: 1, height: 1, background: "rgba(244,239,230,0.12)" }} />
                  {translation && (
                    <button
                      onClick={() => setShowTranslation(!showTranslation)}
                      className="ln-press"
                      style={{
                        background: "rgba(244,239,230,0.08)",
                        border: `1px solid ${showTranslation ? accent : "rgba(244,239,230,0.16)"}`,
                        borderRadius: 6,
                        padding: "4px 8px",
                        cursor: "pointer",
                        fontFamily: "var(--ln-mono)",
                        fontSize: 9,
                        letterSpacing: "0.04em",
                        color: showTranslation ? accent : muted(0.6),
                        fontWeight: 600,
                        transition: "all 0.2s",
                      }}
                    >
                      {showTranslation ? "EN" : "ORIG"}
                    </button>
                  )}
                  <span style={{ fontFamily: "var(--ln-mono)", fontSize: 9.5, letterSpacing: "0.04em", color: muted(0.45) }}>synced · Musixmatch</span>
                </div>

                <div ref={colRef} className="ln-scroll" style={{ position: "relative", height: "clamp(360px, 52vh, 560px)", overflow: "hidden", WebkitMaskImage: "linear-gradient(180deg, transparent, #000 16%, #000 80%, transparent)" }}>
                  <div style={{ transform: `translateY(${lyricShift}px)`, transition: "transform 0.5s cubic-bezier(.2,.8,.2,1)", display: "flex", flexDirection: "column", gap: 4, paddingTop: 8 }}>
                    {lyrics.lines.map((line, i) => {
                      const lineSec = line.time.total / 1000;
                      const isActive = i === annotations?.activeLineIndex;
                      const passed = annotations?.activeLineIndex !== undefined && i < annotations.activeLineIndex;
                      const dist = Math.abs(i - (annotations?.activeLineIndex || 0));
                      const translatedLine = translation?.lines?.[i];

                      return (
                        <div key={i} ref={(el) => { lineRefs.current[i] = el; }}
                          onClick={() => player?.seek(lineSec * 1000 + 200)}
                          style={{
                            cursor: "pointer",
                            padding: "7px 2px",
                          }}>
                          <div style={{
                            fontFamily: "var(--ln-album)",
                            fontWeight: isActive ? 600 : 500,
                            fontSize: isActive ? 22 : 18,
                            lineHeight: 1.25,
                            letterSpacing: "-0.01em",
                            color: isActive ? INK : passed ? muted(0.32) : muted(0.5),
                            opacity: isActive ? 1 : Math.max(0.26, 1 - dist * 0.16),
                            transition: "all 0.4s cubic-bezier(.2,.8,.2,1)",
                            wordWrap: "break-word",
                          }}>
                            {isActive && <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: accent, marginRight: 12, verticalAlign: "middle", boxShadow: `0 0 0 4px ${accent}33` }} />}
                            {line.text}
                          </div>
                          {showTranslation && translatedLine && translatedLine.text !== line.text && (
                            <div style={{
                              fontFamily: "var(--ln-body)",
                              fontSize: isActive ? 14 : 12,
                              lineHeight: 1.4,
                              color: muted(0.45),
                              marginTop: 4,
                              marginLeft: isActive ? 32 : 0,
                              fontStyle: "italic",
                              opacity: isActive ? 0.9 : Math.max(0.2, 1 - dist * 0.2),
                              transition: "all 0.4s cubic-bezier(.2,.8,.2,1)",
                              wordWrap: "break-word",
                            }}>
                              {translatedLine.text}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 14, textAlign: "center", padding: 40, opacity: 0.5 }}>
                No synced lyrics available for this track
              </div>
            )}

            {/* Up next — the next song in an album / feed queue */}
            {upNext && (
              <div style={{ marginTop: 26 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
                  <span style={{ fontFamily: "var(--ln-label)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: accent }}>up next</span>
                  <span style={{ flex: 1, height: 1, background: "rgba(244,239,230,0.12)" }} />
                </div>
                <button onClick={() => goToSegment(idx + 1)} className="ln-press" style={{ width: "100%", display: "flex", alignItems: "center", gap: 13, padding: 12, borderRadius: 14, cursor: "pointer", textAlign: "left", background: "rgba(244,239,230,0.04)", border: `1px solid ${accent}26` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={upNext.track.artworkUrl} alt="" style={{ width: 52, height: 52, borderRadius: 9, objectFit: "cover", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--ln-album)", fontWeight: 600, fontSize: 16, color: INK, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{upNext.track.name}</div>
                    <div style={{ fontFamily: "var(--ln-body)", fontSize: 13, color: muted(0.6), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{upNext.track.artist}</div>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={accent}><path d="M8 5v14l11-7z" /></svg>
                </button>
              </div>
            )}

            {/* Experience more — community posts to jump to from a single track */}
            {!isPlaylist && moreReviews.length > 0 && (
              <div style={{ marginTop: 26 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
                  <span style={{ fontFamily: "var(--ln-label)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: accent }}>Experience more</span>
                  <span style={{ flex: 1, height: 1, background: "rgba(244,239,230,0.12)" }} />
                </div>
                <div className="mu-exp-more" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  {moreReviews.map((r) => (
                    <button key={r.id} onClick={() => router.push(`/experience/${r.id}`)} className="ln-press" style={{ display: "flex", flexDirection: "column", gap: 7, padding: 0, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", minWidth: 0 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.track.artworkUrl} alt="" style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: 11, objectFit: "cover", boxShadow: "0 14px 30px -16px rgba(0,0,0,0.8)" }} />
                      <div style={{ fontFamily: "var(--ln-album)", fontWeight: 600, fontSize: 13, color: INK, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.track.name}</div>
                      <div style={{ fontFamily: "var(--ln-body)", fontSize: 11.5, color: muted(0.6), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: -3 }}>{r.track.artist}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes mu-breathe { 0%,100% { opacity: 0.75; } 50% { opacity: 1; } }
        @keyframes mu-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        @keyframes mu-pop { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: none; } }
        @media (max-width: 880px) {
          .mu-exp-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
          .mu-exp-left { position: static !important; max-width: 380px; }
        }
        @media (max-width: 440px) {
          .mu-exp-more { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (prefers-reduced-motion: reduce) { [style*="mu-breathe"] { animation: none !important; } }
      `}</style>

      {/* Share Modal */}
      {shareModalOpen && shareMoment && review?.track && (
        <LyricShareModal
          track={{
            name: review.track.name,
            artist: review.track.artist,
            album: review.track.album || "",
            artworkUrl: review.track.artworkUrl || "",
            palette: coverPalette || paletteFromString(review.track.trackId || review.track.name),
            trackId: review.track.trackId,
          }}
          moment={{
            seconds: shareMoment.sec,
            label: shareMoment.label,
            note: shareMoment.note,
            lyric: shareMoment.lyric,
          }}
          reviewer={{
            name: review.user?.displayName || review.user?.handle || "Listener",
            handle: review.user?.handle || "listener",
          }}
          accent={coverPalette?.accent || "#d5896f"}
          onClose={() => setShareModalOpen(false)}
        />
      )}
    </main>
  );
}

// EQ visualizer component
function MUEq({ color }: { color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2.5, height: 18, width: 18 }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ flex: 1, background: color, borderRadius: 1, height: "40%", animation: `ln-eq 0.8s ease-in-out ${i * 0.16}s infinite alternate` }} />
      ))}
    </div>
  );
}

export default function ExperiencePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ExperienceContent />
    </Suspense>
  );
}
