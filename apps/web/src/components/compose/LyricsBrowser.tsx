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
  const [annotatingIndex, setAnnotatingIndex] = useState<number | null>(null);
  const [annotation, setAnnotation] = useState("");

  useEffect(() => {
    if (!trackIsrc && (!trackName || !artistName)) return;

    const fetchLyrics = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (trackIsrc) {
          params.set("isrc", trackIsrc);
          console.log("[LyricsBrowser] Fetching lyrics by ISRC:", trackIsrc);
        } else {
          params.set("track", trackName);
          params.set("artist", artistName);
          console.log("[LyricsBrowser] Fetching lyrics by track/artist:", trackName, "/", artistName);
        }

        const res = await fetch(`/api/lyrics?${params.toString()}`);
        console.log("[LyricsBrowser] API response status:", res.status);

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          console.error("[LyricsBrowser] API error:", errorData);
          throw new Error(errorData.error || errorData.message || "No lyrics available");
        }

        const data = await res.json();
        console.log("[LyricsBrowser] API response data:", data);

        if (data.lyrics && Array.isArray(data.lyrics)) {
          // Musixmatch subtitle format
          const parsedLyrics = data.lyrics.map((line: any) => ({
            text: line.text || "",
            seconds: line.time?.total ? line.time.total / 1000 : 0,
          })).filter((line: LyricLine) => line.text.trim() !== "");

          console.log("[LyricsBrowser] Parsed lyrics count:", parsedLyrics.length);
          setLyrics(parsedLyrics);
        } else if (data.message) {
          setError(data.message);
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

  const handleLineClick = (line: LyricLine, index: number) => {
    if (bookmarkedLines.has(line.text)) return;
    setAnnotatingIndex(index);
    setAnnotation("");
  };

  const handleSaveAnnotation = (line: LyricLine) => {
    if (!annotation.trim()) {
      // If no annotation provided, just save the lyric
      onBookmark({
        seconds: line.seconds,
        label: line.text.substring(0, 50) + (line.text.length > 50 ? "..." : ""),
        note: "", // No annotation
        lyric: line.text,
      });
    } else {
      // Save both lyric and annotation
      onBookmark({
        seconds: line.seconds,
        label: line.text.substring(0, 50) + (line.text.length > 50 ? "..." : ""),
        note: annotation.trim(), // Your personal annotation
        lyric: line.text, // The lyric line
      });
    }
    setAnnotatingIndex(null);
    setAnnotation("");
  };

  const handleCancelAnnotation = () => {
    setAnnotatingIndex(null);
    setAnnotation("");
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
        Click any line to add your annotation. The lyric and your note will appear together during playback.
      </div>

      <div style={{ maxHeight: 400, overflowY: "auto", border: "1px solid rgba(var(--ln-fg-rgb),0.1)", borderRadius: 12, background: "rgba(var(--ln-fg-rgb),0.02)" }}>
        {lyrics.map((line, index) => {
          const isBookmarked = bookmarkedLines.has(line.text);
          const isAnnotating = annotatingIndex === index;
          const minutes = Math.floor(line.seconds / 60);
          const seconds = Math.floor(line.seconds % 60);
          const timestamp = `${minutes}:${seconds.toString().padStart(2, "0")}`;

          if (isAnnotating) {
            return (
              <div
                key={index}
                style={{
                  padding: "12px 14px",
                  borderBottom: index < lyrics.length - 1 ? "1px solid rgba(var(--ln-fg-rgb),0.06)" : "none",
                  background: `${gold}08`,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                  <div style={{ fontFamily: "var(--ln-mono)", fontSize: 11, color: gold, minWidth: 40 }}>
                    {timestamp}
                  </div>
                  <div style={{ flex: 1, fontFamily: "var(--ln-preview)", fontStyle: "italic", fontSize: 14.5, lineHeight: 1.5, color: "var(--ln-fg)" }}>
                    "{line.text}"
                  </div>
                </div>
                <div style={{ marginLeft: 52 }}>
                  <input
                    type="text"
                    autoFocus
                    placeholder="Add your annotation (optional, press Enter to save)"
                    value={annotation}
                    onChange={(e) => setAnnotation(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSaveAnnotation(line);
                      } else if (e.key === "Escape") {
                        handleCancelAnnotation();
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      fontFamily: "var(--ln-body)",
                      fontSize: 13,
                      border: `1px solid ${gold}55`,
                      borderRadius: 6,
                      background: "var(--ln-bg)",
                      color: "var(--ln-fg)",
                      outline: "none",
                    }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => handleSaveAnnotation(line)}
                      className="ln-press"
                      style={{
                        padding: "6px 12px",
                        fontFamily: "var(--ln-mono)",
                        fontSize: 10,
                        fontWeight: 600,
                        border: `1px solid ${gold}`,
                        borderRadius: 6,
                        background: gold,
                        color: "var(--ln-bg)",
                        cursor: "pointer",
                      }}
                    >
                      SAVE
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelAnnotation}
                      className="ln-press"
                      style={{
                        padding: "6px 12px",
                        fontFamily: "var(--ln-mono)",
                        fontSize: 10,
                        fontWeight: 600,
                        border: "1px solid rgba(var(--ln-fg-rgb),0.2)",
                        borderRadius: 6,
                        background: "transparent",
                        color: "var(--ln-fg)",
                        cursor: "pointer",
                      }}
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <button
              key={index}
              type="button"
              onClick={() => handleLineClick(line, index)}
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
