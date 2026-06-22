"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import type { Track, Review } from "@/lib/types";
import { TrackSearch } from "./TrackSearch";
import { StarsInput, MomentsEditor, CaptionPicker, Chip, DepthMeter, ModeTabs, PreviewShell, cmpInput, type DraftMoment, type Depth } from "./composer-ui";
import { LyricsBrowser } from "./LyricsBrowser";
import { LNArt, LNIcon } from "@/components/ln/atoms";
import { LNWCard } from "@/components/ln/cards";
import { paletteFromString } from "@/lib/palette";
import type { ReviewVM } from "@/lib/view-adapter";

interface ComposeFormProps {
  onSubmit?: (review: Partial<Review>) => Promise<void>;
  onSuccess?: (review: Review) => void;
  searchAPI?: (query: string, offset?: number) => Promise<Track[]>;
  initialTrack?: Track;
  initialRating?: number;
  editReviewId?: string;
  initialTake?: string;
  initialNotes?: Array<{ seconds: number; label: string; note?: string; lyric?: string }>;
}

export function ComposeForm({ onSubmit, onSuccess, searchAPI, initialTrack, initialRating, editReviewId, initialTake, initialNotes }: ComposeFormProps) {
  const { data: session } = useSession();
  const [track, setTrack] = useState<Track | null>(initialTrack || null);
  const [rating, setRating] = useState(initialRating || 0);

  // A prompt (or Last.fm row) resolves its track asynchronously, so initialTrack
  // arrives after mount — autofill the song once it does.
  useEffect(() => {
    if (initialTrack) setTrack(initialTrack);
  }, [initialTrack]);
  useEffect(() => {
    if (initialRating) setRating(initialRating);
  }, [initialRating]);
  const [showLine, setShowLine] = useState(!!initialTake);
  const [line, setLine] = useState(initialTake || "");
  const [showMoments, setShowMoments] = useState(!!initialNotes && initialNotes.length > 0);
  const [moments, setMoments] = useState<DraftMoment[]>(
    initialNotes?.map(note => ({
      seconds: note.seconds,
      label: note.label,
      note: note.note || "",
      lyric: note.lyric,
    })) || []
  );
  const [captionIdx, setCaptionIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  // Which moment leads the card. Tracked by content signature (not index) so it
  // survives the chronological re-sort that happens when a moment is added.
  const [featuredKey, setFeaturedKey] = useState<string | null>(null);

  // The note: chosen caption is prepended as a pull-quote (headlines the card),
  // and the full review is kept after it in the order it was written.
  const lines = line.split("\n").map((s) => s.trim()).filter(Boolean);
  const capIdx = lines.length ? Math.min(captionIdx, lines.length - 1) : 0;
  const take = lines.length > 1 ? [lines[capIdx], ...lines.filter((_, i) => i !== capIdx)].join("\n") : lines[0] || "";
  const multiline = lines.length > 1;
  const depth: Depth = multiline ? "full" : take ? "caption" : rating > 0 ? "floor" : null;
  const canPost = !!track && rating > 0;

  // Featured-moment selection: resolve the stored signature to its current index,
  // defaulting to the first moment, then order so the featured one leads.
  const momentSig = (m: DraftMoment) => `${m.seconds}|${m.lyric || ""}|${m.note || ""}|${m.label || ""}`;
  const featuredIdx = moments.length
    ? (() => {
        const i = featuredKey ? moments.findIndex((m) => momentSig(m) === featuredKey) : -1;
        return i >= 0 ? i : 0;
      })()
    : -1;
  const orderedMoments =
    featuredIdx > 0 ? [moments[featuredIdx], ...moments.filter((_, i) => i !== featuredIdx)] : moments;

  const draft: ReviewVM | null = useMemo(() => {
    if (!track) return null;
    return {
      id: "draft",
      href: "#",
      kind: "track",
      album: {
        title: track.name,
        artist: track.artist,
        artworkUrl: track.artworkUrl || null,
        palette: paletteFromString(track.trackId || track.album || track.name),
        kind: "track",
        tracks: [],
      },
      user: { id: "", name: "", handle: "", tint: "#bd9183" },
      rating,
      take: take || undefined,
      body: undefined,
      notes: orderedMoments.map((m) => ({ sec: m.seconds, label: m.label || "moment", note: m.note || "", lyric: m.lyric })),
      via: null,
      likeCount: 0,
      repostCount: 0,
      at: "",
    };
  }, [track, rating, take, orderedMoments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!track) {
      alert("Please select a track first");
      return;
    }
    setSubmitting(true);
    try {
      const reviewData = {
        trackId: String(track.trackId),
        trackName: track.name,
        trackArtist: track.artist,
        trackAlbum: track.album,
        artworkUrl: track.artworkUrl,
        previewUrl: track.previewUrl,
        rating,
        take: take || undefined,
        // Featured moment leads the array; the POST route marks notes[0] featured.
        notes: orderedMoments.length > 0 ? orderedMoments.map((m) => ({ seconds: m.seconds, label: m.label || "moment", note: m.note || undefined, lyric: m.lyric || undefined })) : undefined,
      };

      if (onSubmit) {
        await onSubmit(reviewData as unknown as Partial<Review>);
      } else if (editReviewId) {
        // Update existing review
        const response = await fetch(`/api/reviews/${editReviewId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rating,
            take: take || undefined,
            notes: orderedMoments.length > 0 ? orderedMoments.map((m) => ({ seconds: m.seconds, label: m.label || "moment", note: m.note || undefined, lyric: m.lyric || undefined })) : undefined,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to update review");
        }

        const { review: updatedReview } = await response.json();
        onSuccess?.(updatedReview);
      } else {
        const { createReview } = await import("@/lib/api");
        const newReview = await createReview(reviewData);
        onSuccess?.(newReview);
      }

      setTrack(null);
      setRating(0);
      setLine("");
      setMoments([]);
      setFeaturedKey(null);
      setCaptionIdx(0);
      setShowLine(false);
      setShowMoments(false);

      if (session?.user?.handle) {
        window.location.href = `/profile/${session.user.handle}`;
      } else {
        alert("Note posted!");
      }
    } catch (error) {
      console.error("Failed to submit review:", error);
      const msg = error instanceof Error ? error.message : "Failed to submit";
      alert(msg === "Authentication required" || /unauthor/i.test(msg) ? "Please log in to post a note." : `Couldn't ${editReviewId ? 'update' : 'post'}: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const gold = "var(--ln-accent)";

  return (
    <div>
      <ModeTabs active="track" />

      {!track ? (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontFamily: "var(--ln-body)", fontSize: 14.5, fontWeight: 400, letterSpacing: "0.01em", color: gold, marginBottom: 10 }}>What song is on your mind?</div>
          <TrackSearch onTrackSelect={setTrack} searchAPI={searchAPI} />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="lnw-cmp" style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 340px", gap: 28, alignItems: "start" }}>
          {/* EDITOR */}
          <div style={{ minWidth: 0 }}>
            {/* proposed track */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 12, borderRadius: 14, background: "rgba(var(--ln-fg-rgb),0.04)", border: "1px solid rgba(var(--ln-fg-rgb),0.09)" }}>
              <div style={{ width: 60, height: 60, borderRadius: 9, overflow: "hidden", flexShrink: 0 }}>
                <LNArt palette={draft!.album.palette} src={track.artworkUrl} label="" radius={9} noTag />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--ln-album)", fontWeight: 600, fontSize: 18, color: "var(--ln-fg)", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.name}</div>
                <div style={{ fontFamily: "var(--ln-body)", fontSize: 13, color: "var(--ln-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.artist} · {track.album}</div>
              </div>
              <button type="button" onClick={() => { setTrack(null); setRating(0); }} className="ln-press" style={{ flexShrink: 0, padding: "7px 13px", borderRadius: 999, cursor: "pointer", background: "rgba(var(--ln-fg-rgb),0.06)", color: "rgba(var(--ln-fg-rgb),0.7)", border: "1px solid rgba(var(--ln-fg-rgb),0.16)", fontFamily: "var(--ln-body)", fontSize: 12.5, fontWeight: 600 }}>Change</button>
            </div>

            {/* rate */}
            <div style={{ marginTop: 24, textAlign: "center" }}>
              <div style={{ fontFamily: "var(--ln-mono)", fontSize: 10.5, letterSpacing: "0.1em", color: "rgba(var(--ln-fg-rgb),0.5)", textTransform: "uppercase" }}>rate the track</div>
              <div style={{ marginTop: 12, display: "flex", justifyContent: "center", alignItems: "center", gap: 12 }}>
                <StarsInput rating={rating} onChange={setRating} />
                <span style={{ fontFamily: "var(--ln-mono)", fontSize: 23, color: rating ? gold : "rgba(var(--ln-fg-rgb),0.3)", minWidth: 38, textAlign: "left" }}>{rating ? rating.toFixed(1) : ""}</span>
              </div>
              <div style={{ marginTop: 8, fontFamily: "var(--ln-body)", fontSize: 12.5, color: "rgba(var(--ln-fg-rgb),0.45)" }}>Tap to rate. That alone is a valid post.</div>
            </div>

            {/* depth */}
            <div style={{ marginTop: 22 }}>
              <DepthMeter depth={depth} />
            </div>

            {/* chips */}
            <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Chip label="Write a note" on={showLine} onToggle={() => setShowLine((v) => !v)} />
              <Chip label={`Mark moments${moments.length ? ` · ${moments.length}` : ""}`} on={showMoments} onToggle={() => setShowMoments((v) => !v)} />
            </div>

            {showLine && (
              <div style={{ marginTop: 13 }}>
                <textarea value={line} onChange={(e) => setLine(e.target.value)} rows={4} placeholder="Write as much as you want — one line, or the whole thing. Each line can be your caption…" style={cmpInput} maxLength={1000} />
                <CaptionPicker lines={lines} selected={capIdx} onSelect={setCaptionIdx} />
              </div>
            )}

            {showMoments && (
              <div style={{ marginTop: 13, padding: 14, borderRadius: 14, border: `1px solid ${gold}33`, background: `${gold}0a` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 11 }}>
                  <LNIcon name="save" size={16} color={gold} />
                  <span style={{ fontFamily: "var(--ln-mono)", fontSize: 11, letterSpacing: "0.06em", color: gold, textTransform: "uppercase" }}>the moments that got you</span>
                </div>
                <MomentsEditor
                  moments={moments}
                  onAdd={(m) => setMoments((a) => [...a, m].sort((x, y) => x.seconds - y.seconds))}
                  onRemove={(idx) => setMoments((a) => a.filter((_, i) => i !== idx))}
                  featuredIdx={featuredIdx}
                  onSetFeatured={(idx) => setFeaturedKey(momentSig(moments[idx]))}
                />

                {/* Bookmark lyrics — the same browser, now lives inside Mark moments */}
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${gold}26` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
                    <LNIcon name="save" size={16} color={gold} />
                    <span style={{ fontFamily: "var(--ln-mono)", fontSize: 11, letterSpacing: "0.06em", color: gold, textTransform: "uppercase" }}>Bookmark favorite lyrics</span>
                  </div>
                  <LyricsBrowser
                    trackName={track?.name || ""}
                    artistName={track?.artist || ""}
                    onBookmark={(m) => setMoments((a) => [...a, m].sort((x, y) => x.seconds - y.seconds))}
                    bookmarkedLines={new Set(moments.filter(m => m.lyric).map(m => m.lyric!))}
                  />
                </div>
              </div>
            )}

            <button type="submit" disabled={!canPost || submitting} className="ln-press" style={{ width: "100%", marginTop: 22, padding: "15px", borderRadius: 14, border: "none", cursor: canPost && !submitting ? "pointer" : "default", fontFamily: "var(--ln-body)", fontSize: 15.5, fontWeight: 700, background: canPost ? gold : "rgba(var(--ln-fg-rgb),0.1)", color: canPost ? "#2c1517" : "rgba(var(--ln-fg-rgb),0.4)", transition: "background 0.2s" }}>
              {submitting ? (editReviewId ? "Updating…" : "Posting…") : !canPost ? "Add a rating to post" : editReviewId ? "Update note" : depth === "full" ? "Post note" : depth === "caption" ? "Post" : "Post rating"}
            </button>
          </div>

          {/* LIVE PREVIEW */}
          <div className="lnw-cmp-prev">
            <PreviewShell ready={!!draft && (rating > 0 || !!take || moments.length > 0)}>
              {draft && <LNWCard vm={draft} />}
            </PreviewShell>
          </div>
        </form>
      )}

      <style>{`
        @media (max-width: 820px) {
          .lnw-cmp { grid-template-columns: 1fr !important; }
          .lnw-cmp-prev { display: none !important; }
        }
      `}</style>
    </div>
  );
}
