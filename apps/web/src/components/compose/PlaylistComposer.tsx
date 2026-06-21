"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { Track, Review } from "@/lib/types";
import { TrackSearch } from "./TrackSearch";
import { searchTracks, getReviews } from "@/lib/api";
import { LNArt, LNIcon } from "@/components/ln/atoms";
import { paletteFromString } from "@/lib/palette";
import { ModeTabs } from "./composer-ui";

interface PlaylistTrack extends Track {
  note?: string;
}

// Roll a review's take + timestamped moments into a single playlist note so the
// playlist carries your own words. It's a local copy — editing it here never
// touches the original review.
function reviewToNote(r: Review): string {
  const parts: string[] = [];
  if (r.take?.trim()) parts.push(r.take.trim());
  for (const n of r.notes || []) {
    const mm = Math.floor((n.seconds || 0) / 60);
    const ss = Math.floor((n.seconds || 0) % 60);
    const ts = `${mm}:${String(ss).padStart(2, "0")}`;
    const lyric = n.lyric ? `“${n.lyric}” ` : "";
    const body = (lyric + (n.note || (n.label && n.label !== "moment" ? n.label : ""))).trim();
    if (body) parts.push(`${ts} — ${body}`);
  }
  return parts.join("\n");
}

const cmpInput: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "rgba(var(--ln-fg-rgb),0.06)",
  color: "var(--ln-fg)",
  border: "1px solid rgba(var(--ln-line-rgb),0.16)",
  borderRadius: 13,
  padding: "13px 15px",
  fontFamily: "var(--ln-body)",
  fontSize: 15,
  outline: "none",
  resize: "vertical",
};

export function PlaylistComposer() {
  const { data: session } = useSession();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewedTracks, setReviewedTracks] = useState<{ track: Track; note: string }[]>([]);

  // The tracks you've reviewed (deduped), each carrying your note/moments — a quick
  // way to build a playlist from songs you've already logged.
  useEffect(() => {
    let cancelled = false;
    getReviews()
      .then((rs) => {
        if (cancelled) return;
        const seen = new Set<string>();
        const out: { track: Track; note: string }[] = [];
        for (const r of rs || []) {
          if (r.track?.trackId && !seen.has(r.track.trackId)) {
            seen.add(r.track.trackId);
            out.push({ track: r.track, note: reviewToNote(r) });
          }
        }
        setReviewedTracks(out);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const gold = "var(--ln-accent)";
  const canPost = title.trim() && tracks.length > 0;

  const handleAddTrack = (track: Track, note?: string) => {
    // Check if track already exists
    if (tracks.some((t) => t.trackId === track.trackId)) {
      alert("This track is already in your playlist");
      return;
    }
    setTracks([...tracks, { ...track, note: note?.trim() || undefined }]);
  };

  const handleRemoveTrack = (index: number) => {
    setTracks(tracks.filter((_, i) => i !== index));
  };

  const handleMoveTrack = (index: number, direction: "up" | "down") => {
    const newTracks = [...tracks];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= tracks.length) return;
    [newTracks[index], newTracks[newIndex]] = [newTracks[newIndex], newTracks[index]];
    setTracks(newTracks);
  };

  const handleSaveNote = () => {
    if (editingNoteIndex === null) return;
    const newTracks = [...tracks];
    newTracks[editingNoteIndex].note = noteText.trim() || undefined;
    setTracks(newTracks);
    setEditingNoteIndex(null);
    setNoteText("");
  };

  const handleEditNote = (index: number) => {
    setEditingNoteIndex(index);
    setNoteText(tracks[index].note || "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPost) return;

    setSubmitting(true);
    try {
      const playlistData = {
        title: title.trim(),
        description: description.trim() || undefined,
        tracks: tracks.map((t) => ({
          trackId: String(t.trackId),
          name: t.name,
          artist: t.artist,
          album: t.album || "",
          artworkUrl: t.artworkUrl || null,
          note: t.note,
        })),
      };

      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(playlistData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create playlist");
      }

      const { playlist } = await res.json();

      // Navigate to the playlist page
      router.push(`/playlist/${playlist.id}`);
    } catch (error) {
      console.error("Failed to create playlist:", error);
      const msg = error instanceof Error ? error.message : "Failed to create playlist";
      alert(msg === "Unauthorized" ? "Please log in to create a playlist." : `Couldn't create playlist: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <ModeTabs active="playlist" />

      <form onSubmit={handleSubmit} style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Playlist title */}
        <div>
          <label style={{ display: "block", fontFamily: "var(--ln-body)", fontSize: 14.5, fontWeight: 400, letterSpacing: "0.01em", color: gold, marginBottom: 10 }}>
            Playlist Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. My favourite songs"
            required
            maxLength={100}
            style={cmpInput}
          />
        </div>

        {/* Description */}
        <div>
          <label style={{ display: "block", fontFamily: "var(--ln-body)", fontSize: 14.5, fontWeight: 400, letterSpacing: "0.01em", color: gold, marginBottom: 10 }}>
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. A collection of my favourite songs at the moment, hope you enjoy them as much as I do!"
            maxLength={500}
            rows={3}
            style={cmpInput}
          />
          <div style={{ textAlign: "right", fontFamily: "var(--ln-mono)", fontSize: 10, color: "rgba(var(--ln-fg-rgb),0.4)", marginTop: 6 }}>
            {description.length}/500
          </div>
        </div>

      {/* Track Search */}
      <div>
        <div style={{ fontFamily: "var(--ln-body)", fontSize: 14.5, fontWeight: 400, letterSpacing: "0.01em", color: gold, marginBottom: 10 }}>
          Add tracks ({tracks.length})
        </div>
        <TrackSearch onTrackSelect={handleAddTrack} searchAPI={searchTracks} />
      </div>

      {/* Pick from tracks you've reviewed */}
      {reviewedTracks.length > 0 && (
        <div>
          <div style={{ fontFamily: "var(--ln-body)", fontSize: 14.5, fontWeight: 400, letterSpacing: "0.01em", color: gold, marginBottom: 10 }}>
            Or pick from your reviews
          </div>
          <div className="ln-scroll" style={{ display: "flex", gap: 13, overflowX: "auto", paddingBottom: 8 }}>
            {reviewedTracks.map(({ track: t, note }) => {
              const added = tracks.some((x) => x.trackId === t.trackId);
              return (
                <button
                  key={t.trackId}
                  type="button"
                  onClick={() => { if (!added) handleAddTrack(t, note); }}
                  className="ln-press"
                  style={{ width: 116, flexShrink: 0, display: "flex", flexDirection: "column", gap: 7, background: "none", border: "none", padding: 0, cursor: added ? "default" : "pointer", textAlign: "left", opacity: added ? 0.5 : 1 }}
                >
                  <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: added ? `2px solid ${gold}` : "2px solid transparent" }}>
                    <LNArt palette={paletteFromString(t.trackId || t.name)} src={t.artworkUrl} label="" radius={10} noTag />
                    <div style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: "50%", background: added ? gold : "rgba(8,7,6,0.62)", border: added ? "none" : "1px solid rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                        {added
                          ? <path d="M5 13l4 4L19 7" stroke="#2c1517" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                          : <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />}
                      </svg>
                    </div>
                  </div>
                  <div style={{ fontFamily: "var(--ln-album)", fontWeight: 600, fontSize: 13, color: "var(--ln-fg)", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                  <div style={{ fontFamily: "var(--ln-body)", fontSize: 11.5, color: "var(--ln-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: -3 }}>{t.artist}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Track List */}
      {tracks.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontFamily: "var(--ln-mono)", fontSize: 10, letterSpacing: "0.08em", color: gold, textTransform: "uppercase" }}>
            Your playlist
          </div>
          {tracks.map((track, index) => {
            const iconBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 7, background: "rgba(var(--ln-fg-rgb),0.06)", border: "1px solid rgba(var(--ln-fg-rgb),0.12)", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, cursor: "pointer" };
            return (
            <div key={`${track.trackId}-${index}`} style={{ display: "flex", gap: 11, padding: 10, borderRadius: 12, background: "var(--ln-surface)", border: "1px solid rgba(var(--ln-line-rgb),0.08)" }}>
              {/* Order number */}
              <div style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: gold, color: "#2c1517", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--ln-mono)", fontSize: 11, fontWeight: 700, marginTop: 3 }}>
                {index + 1}
              </div>

              {/* Album art */}
              <div style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                <LNArt palette={paletteFromString(track.trackId || track.name)} src={track.artworkUrl} label="" radius={8} noTag />
              </div>

              {/* Track info */}
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ fontFamily: "var(--ln-album)", fontWeight: 600, fontSize: 14, color: "var(--ln-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {track.name}
                </div>
                <div style={{ fontFamily: "var(--ln-body)", fontSize: 12, color: "var(--ln-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {track.artist}{track.album ? ` · ${track.album}` : ""}
                </div>
                {track.note && editingNoteIndex !== index && (
                  <div style={{ fontFamily: "var(--ln-body)", fontStyle: "italic", fontSize: 12.5, lineHeight: 1.45, color: "rgba(var(--ln-fg-rgb),0.72)", marginTop: 5, whiteSpace: "pre-wrap" }}>
                    {track.note}
                  </div>
                )}
                {editingNoteIndex === index && (
                  <div style={{ marginTop: 7 }}>
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Why this track? Add a note…"
                      maxLength={500}
                      rows={3}
                      style={{ ...cmpInput, fontSize: 13.5 }}
                      autoFocus
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button type="button" onClick={handleSaveNote} className="ln-press" style={{ padding: "8px 16px", borderRadius: 10, background: gold, color: "#2c1517", border: "none", cursor: "pointer", fontFamily: "var(--ln-body)", fontSize: 13, fontWeight: 700 }}>
                        Save note
                      </button>
                      <button type="button" onClick={() => { setEditingNoteIndex(null); setNoteText(""); }} className="ln-press" style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(var(--ln-fg-rgb),0.08)", color: "var(--ln-fg)", border: "1px solid rgba(var(--ln-fg-rgb),0.16)", cursor: "pointer", fontFamily: "var(--ln-body)", fontSize: 13, fontWeight: 600 }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions — reorder chevrons side by side, then note + remove */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0, alignItems: "flex-end" }}>
                <div style={{ display: "flex", gap: 4 }}>
                  <button type="button" onClick={() => handleMoveTrack(index, "up")} disabled={index === 0} className="ln-press" style={{ ...iconBtn, cursor: index === 0 ? "default" : "pointer", opacity: index === 0 ? 0.3 : 1 }} title="Move up">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 15l-6-6-6 6" stroke="var(--ln-fg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                  <button type="button" onClick={() => handleMoveTrack(index, "down")} disabled={index === tracks.length - 1} className="ln-press" style={{ ...iconBtn, cursor: index === tracks.length - 1 ? "default" : "pointer", opacity: index === tracks.length - 1 ? 0.3 : 1 }} title="Move down">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="var(--ln-fg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button type="button" onClick={() => editingNoteIndex === index ? setEditingNoteIndex(null) : handleEditNote(index)} className="ln-press" style={{ ...iconBtn, background: editingNoteIndex === index || track.note ? `${gold}1f` : iconBtn.background, borderColor: editingNoteIndex === index || track.note ? `${gold}66` : "rgba(var(--ln-fg-rgb),0.12)" }} title={track.note ? "Edit note" : "Add note"}>
                    <LNIcon name="edit" size={14} color={editingNoteIndex === index || track.note ? gold : "var(--ln-fg)"} />
                  </button>
                  <button type="button" onClick={() => handleRemoveTrack(index)} className="ln-press" style={{ ...iconBtn, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)" }} title="Remove">
                    <LNIcon name="close" size={14} color="#ef4444" />
                  </button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Submit Button */}
      <button type="submit" disabled={!canPost || submitting} className="ln-press" style={{ width: "100%", padding: "16px", borderRadius: 14, border: "none", cursor: canPost && !submitting ? "pointer" : "default", fontFamily: "var(--ln-body)", fontSize: 16, fontWeight: 700, background: canPost ? gold : "rgba(var(--ln-fg-rgb),0.1)", color: canPost ? "#2c1517" : "rgba(var(--ln-fg-rgb),0.4)", transition: "background 0.2s" }}>
        {submitting ? "Creating playlist..." : !title.trim() ? "Add a title" : tracks.length === 0 ? "Add at least one track" : `Create playlist with ${tracks.length} track${tracks.length !== 1 ? "s" : ""}`}
      </button>
      </form>
    </div>
  );
}
