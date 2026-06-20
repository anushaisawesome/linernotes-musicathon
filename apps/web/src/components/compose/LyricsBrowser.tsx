"use client";

import { useState, useEffect } from "react";
import type { DraftMoment } from "./composer-ui";

interface LyricLine {
  text: string;
  seconds: number;
}

interface LyricsBrowserProps {
  trackIsrc?: string;
  trackName: string;
  artistName: string;
  onBookmark: (moment: DraftMoment) => void;
  bookmarkedLines: Set<string>;
}

export function LyricsBrowser({ trackIsrc, trackName, artistName, onBookmark, bookmarkedLines }: LyricsBrowserProps) {
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!trackIsrc && (!trackName || !artistName)) return;

    const fetchLyrics = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (trackIsrc) {
          params.set("isrc", trackIsrc);
        } else {
          params.set("track", trackName);
          params.set("artist", artistName);
        }

        const res = await fetch(`/api/lyrics?${params.toString()}`);

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || "No lyrics available");
        }

        const data = await res.json();

        if (data.lyrics && Array.isArray(data.lyrics)) {
          // Musixmatch subtitle format
          const parsedLyrics = data.lyrics.map((line: any) => ({
            text: line.text || "",
            seconds: line.time?.total ? line.time.total / 1000 : 0,
          })).filter((line: LyricLine) => line.text.trim() !== "");

          setLyrics(parsedLyrics);
        } else {
          setError("No synced lyrics available");
        }
      } catch (err) {
        console.error("[LyricsBrowser] Error fetching lyrics:", err);
        setError(err instanceof Error ? err.message : "Failed to load lyrics");
      } finally {
        setLoading(false);
      }
    };

    fetchLyrics();
  }, [trackIsrc, trackName, artistName]);

  const handleLineClick = (line: LyricLine) => {
    // Add as a bookmarked lyric moment
    onBookmark({
      seconds: line.seconds,
      label: line.text.substring(0, 50) + (line.text.length > 50 ? "..." : ""), // Truncate for label
      note: line.text, // Full lyric text in note
      lyric: line.text, // Mark this as a lyric bookmark
    });
  };

  const gold = "var(--ln-accent)";

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <div style={{ width: 24, height: 24, borderRadius: "50%", border: "3px solid rgba(var(--ln-fg-rgb),0.15)", borderTopColor: gold, animation: "ln-spin 0.8s linear infinite", margin: "0 auto" }} />
        <div style={{ marginTop: 12, fontFamily: "var(--ln-body)", fontSize: 13, color: "rgba(var(--ln-fg-rgb),0.5)" }}>
          Fetching synced lyrics from Musixmatch...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, textAlign: "center", background: "rgba(var(--ln-fg-rgb),0.04)", borderRadius: 12 }}>
        <div style={{ fontFamily: "var(--ln-body)", fontSize: 14, color: "rgba(var(--ln-fg-rgb),0.6)" }}>
          {error}
        </div>
        <div style={{ marginTop: 8, fontFamily: "var(--ln-body)", fontSize: 12, color: "rgba(var(--ln-fg-rgb),0.4)" }}>
          Lyrics may not be available for this track
        </div>
      </div>
    );
  }

  if (lyrics.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: "center", background: "rgba(var(--ln-fg-rgb),0.04)", borderRadius: 12 }}>
        <div style={{ fontFamily: "var(--ln-body)", fontSize: 14, color: "rgba(var(--ln-fg-rgb),0.6)" }}>
          No lyrics found for this track
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 12, fontFamily: "var(--ln-body)", fontSize: 13, color: "rgba(var(--ln-fg-rgb),0.6)" }}>
        Click any line to bookmark it as a favorite moment. Your bookmarks will appear with synced timing when the track plays.
      </div>

      <div style={{ maxHeight: 400, overflowY: "auto", border: "1px solid rgba(var(--ln-fg-rgb),0.1)", borderRadius: 12, background: "rgba(var(--ln-fg-rgb),0.02)" }}>
        {lyrics.map((line, index) => {
          const isBookmarked = bookmarkedLines.has(line.text);
          const minutes = Math.floor(line.seconds / 60);
          const seconds = Math.floor(line.seconds % 60);
          const timestamp = `${minutes}:${seconds.toString().padStart(2, "0")}`;

          return (
            <button
              key={index}
              type="button"
              onClick={() => handleLineClick(line)}
              disabled={isBookmarked}
              className={isBookmarked ? "" : "ln-press"}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "10px 14px",
                border: "none",
                borderBottom: index < lyrics.length - 1 ? "1px solid rgba(var(--ln-fg-rgb),0.06)" : "none",
                background: isBookmarked ? `${gold}15` : "transparent",
                cursor: isBookmarked ? "default" : "pointer",
                textAlign: "left",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!isBookmarked) {
                  e.currentTarget.style.background = "rgba(var(--ln-fg-rgb),0.06)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isBookmarked) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <div style={{ fontFamily: "var(--ln-mono)", fontSize: 11, color: isBookmarked ? gold : "rgba(var(--ln-fg-rgb),0.4)", minWidth: 40 }}>
                {timestamp}
              </div>
              <div style={{ flex: 1, fontFamily: "var(--ln-body)", fontSize: 14.5, lineHeight: 1.5, color: isBookmarked ? gold : "var(--ln-fg)" }}>
                {line.text}
              </div>
              {isBookmarked && (
                <div style={{ fontSize: 16, color: gold }}>★</div>
              )}
            </button>
          );
        })}
      </div>

      {lyrics.length > 0 && (
        <div style={{ marginTop: 10, fontFamily: "var(--ln-mono)", fontSize: 10, color: "rgba(var(--ln-fg-rgb),0.45)", textAlign: "center" }}>
          {lyrics.length} synced lines · Powered by Musixmatch
        </div>
      )}
    </div>
  );
}
