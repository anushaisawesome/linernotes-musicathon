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
import { useParams, useRouter } from "next/navigation";
import { WebPlaybackSDK, type PlayerState } from "@/lib/spotify-player";
import { getActiveAnnotations, type SyncedLyrics, type ActiveAnnotations } from "@/lib/sync-engine";
import type { Review } from "@/lib/types";
import { paletteFromString, type Palette } from "@/lib/palette";
import { LNArt, lnFmt } from "@/components/ln/atoms";

function ExperienceContent() {
  const params = useParams();
  const router = useRouter();
  const reviewId = params.id as string;

  const [review, setReview] = useState<Review | null>(null);
  const [lyrics, setLyrics] = useState<SyncedLyrics | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [annotations, setAnnotations] = useState<ActiveAnnotations | null>(null);
  const [player, setPlayer] = useState<WebPlaybackSDK | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coverPalette, setCoverPalette] = useState<Palette | null>(null);
  const [noteOpen, setNoteOpen] = useState(true);

  // Lyric auto-scroll
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const colRef = useRef<HTMLDivElement | null>(null);
  const [lyricShift, setLyricShift] = useState(0);

  const INK = "#d7c9d0";
  const muted = (a: number) => `rgba(215,201,208,${a})`;

  // Fetch review data
  useEffect(() => {
    async function fetchReview() {
      try {
        const res = await fetch(`/api/reviews/${reviewId}`);
        if (!res.ok) throw new Error("Failed to load review");

        const data = await res.json();
        setReview(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load review");
      }
    }

    fetchReview();
  }, [reviewId]);

  // Initialize Spotify player
  useEffect(() => {
    if (!review) return;

    async function initPlayer() {
      try {
        await WebPlaybackSDK.loadSDK();
        const tokenRes = await fetch("/api/spotify/token");
        if (!tokenRes.ok) throw new Error("Failed to get Spotify token");

        const { access_token } = await tokenRes.json();

        const sdk = new WebPlaybackSDK(access_token);
        await sdk.initialize((state) => {
          setPlayerState(state);
        });

        setPlayer(sdk);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize player");
        setLoading(false);
      }
    }

    initPlayer();

    return () => {
      if (player) {
        player.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review]);

  // Fetch lyrics when track changes
  useEffect(() => {
    if (!playerState?.isrc) return;

    async function fetchLyrics() {
      try {
        const res = await fetch(`/api/lyrics?isrc=${encodeURIComponent(playerState?.isrc || '')}`);

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
        setLyrics(data.lyrics);
      } catch (err) {
        console.error("Failed to fetch lyrics:", err);
        setLyrics(null);
      }
    }

    fetchLyrics();
  }, [playerState?.isrc]);

  // Update annotations whenever player state changes
  useEffect(() => {
    if (!playerState) return;
    const newAnnotations = getActiveAnnotations(playerState, lyrics, review);
    setAnnotations(newAnnotations);
  }, [playerState, lyrics, review]);

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

  // Find active moment (pulses for 5s after playhead hits it)
  const activeMoment = review.notes?.find((m) => positionSec >= m.seconds && positionSec < m.seconds + 5) || null;

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

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1140, margin: "0 auto", padding: "92px 24px 60px" }}>
        {/* Top row: back + vision-demo tag */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 26 }}>
          <button onClick={() => router.back()} className="ln-press" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(244,239,230,0.06)", border: "1px solid rgba(244,239,230,0.16)", color: INK, borderRadius: 999, padding: "8px 15px", cursor: "pointer", fontFamily: "var(--ln-body)", fontSize: 13.5, fontWeight: 600 }}>
            <span style={{ fontSize: 15, lineHeight: 1 }}>←</span> Back
          </button>
          <span style={{ fontFamily: "var(--ln-mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: muted(0.5), border: "1px solid rgba(244,239,230,0.14)", borderRadius: 999, padding: "5px 11px" }}>
            the Experience · Musicathon
          </span>
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

            {/* Transport controls */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24 }}>
              <button onClick={() => player?.previousTrack()} className="ln-press" style={{ width: 46, height: 46, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }} aria-label="previous">
                <svg width="22" height="22" viewBox="0 0 24 24" fill={INK}><path d="M6 5v14h2V5H6zm3 7l9 7V5l-9 7z" /></svg>
              </button>
              <button onClick={() => player?.togglePlay()} className="ln-press" style={{ width: 64, height: 64, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }} aria-label={playerState?.isPlaying ? "pause" : "play"}>
                {playerState?.isPlaying ? (
                  <svg width="42" height="42" viewBox="0 0 24 24" fill="#fff" style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))" }}><rect x="6.5" y="5" width="4" height="14" rx="1.7" /><rect x="13.5" y="5" width="4" height="14" rx="1.7" /></svg>
                ) : (
                  <svg width="42" height="42" viewBox="0 0 24 24" fill="#fff" stroke="#fff" strokeWidth="3.4" strokeLinejoin="round" strokeLinecap="round" style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))" }}><path d="M8 6.2v11.6l10-5.8z" /></svg>
                )}
              </button>
              <button onClick={() => player?.nextTrack()} className="ln-press" style={{ width: 46, height: 46, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }} aria-label="next">
                <svg width="22" height="22" viewBox="0 0 24 24" fill={INK}><path d="M16 5v14h2V5h-2zM6 5v14l9-7-9-7z" /></svg>
              </button>
            </div>

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
            {/* Reviewer note */}
            <div key={review.id} style={{ borderRadius: 16, border: `1px solid ${accent}33`, background: `${accent}10`, padding: "16px 18px", animation: "mu-rise 0.45s cubic-bezier(.2,.8,.2,1) both" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: noteOpen ? 11 : 0 }}>
                <span style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${accent}26`, border: `1px solid ${accent}66`, color: accent, fontFamily: "var(--ln-display)", fontWeight: 600, fontSize: 14 }}>
                  {review.user?.displayName?.[0] || "U"}
                </span>
                <div style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
                  <div style={{ fontFamily: "var(--ln-mono)", fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", color: accent }}>
                    what {review.user?.displayName?.split(" ")[0] || "they"} wrote
                  </div>
                  <div style={{ fontFamily: "var(--ln-body)", fontSize: 13, color: muted(0.7) }}>@{review.user?.handle || "user"}</div>
                </div>
                <button onClick={() => setNoteOpen((v) => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: muted(0.55), fontFamily: "var(--ln-mono)", fontSize: 11 }}>
                  {noteOpen ? "hide" : "show"}
                </button>
              </div>
              {noteOpen && review.take && (
                <p style={{ margin: 0, fontFamily: "var(--ln-preview)", fontStyle: "italic", fontWeight: 500, fontSize: 18, lineHeight: 1.45, color: INK, wordWrap: "break-word" }}>
                  {review.take}
                </p>
              )}
            </div>

            {/* Active moment live callout */}
            <div style={{ height: 52, marginTop: 12, position: "relative" }}>
              {activeMoment && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 11, borderRadius: 12, background: accent, color: "#2c1517", padding: "0 8px 0 15px", animation: "mu-pop 0.3s cubic-bezier(.16,1,.3,1) both", boxShadow: `0 14px 30px -12px ${accent}` }}>
                  <span style={{ fontFamily: "var(--ln-mono)", fontSize: 12, fontWeight: 700 }}>{lnFmt(activeMoment.seconds)}</span>
                  <span style={{ width: 1, height: 18, background: "rgba(44,21,23,0.3)" }} />
                  <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--ln-body)", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {activeMoment.label} {activeMoment.note && `— ${activeMoment.note}`}
                  </span>
                </div>
              )}
            </div>

            {/* Synced lyrics */}
            {lyrics && lyrics.lines && lyrics.lines.length > 0 ? (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
                  <span style={{ fontFamily: "var(--ln-label)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: accent }}>lyrics</span>
                  <span style={{ flex: 1, height: 1, background: "rgba(244,239,230,0.12)" }} />
                  <span style={{ fontFamily: "var(--ln-mono)", fontSize: 9.5, letterSpacing: "0.04em", color: muted(0.45) }}>synced · Musixmatch</span>
                </div>

                <div ref={colRef} className="ln-scroll" style={{ position: "relative", height: "clamp(360px, 52vh, 560px)", overflow: "hidden", WebkitMaskImage: "linear-gradient(180deg, transparent, #000 16%, #000 80%, transparent)" }}>
                  <div style={{ transform: `translateY(${lyricShift}px)`, transition: "transform 0.5s cubic-bezier(.2,.8,.2,1)", display: "flex", flexDirection: "column", gap: 4, paddingTop: 8 }}>
                    {lyrics.lines.map((line, i) => {
                      const lineSec = line.time.total / 1000;
                      const isActive = i === annotations?.activeLineIndex;
                      const passed = annotations?.activeLineIndex !== undefined && i < annotations.activeLineIndex;
                      const dist = Math.abs(i - (annotations?.activeLineIndex || 0));

                      return (
                        <div key={i} ref={(el) => (lineRefs.current[i] = el)}
                          onClick={() => player?.seek(lineSec * 1000 + 200)}
                          style={{
                            cursor: "pointer",
                            padding: "7px 2px",
                            fontFamily: "var(--ln-album)",
                            fontWeight: isActive ? 600 : 500,
                            fontSize: isActive ? 27 : 22,
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
        @media (prefers-reduced-motion: reduce) { [style*="mu-breathe"] { animation: none !important; } }
      `}</style>
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
