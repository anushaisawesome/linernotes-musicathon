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
  const [translation, setTranslation] = useState<LyricLine[]>([]);
  const [showTranslation, setShowTranslation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());
  const [isAnnotating, setIsAnnotating] = useState(false);
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

        // Provider down / key expired — degrade with a clear message. The rest of
        // the composer (the take + manually-added timestamped moments) still works.
        if (data.unavailable) {
          setLyrics([]);
          setError("Lyrics are temporarily unavailable — you can still add timestamped moments manually.");
          return;
        }

        if (data.lyrics && Array.isArray(data.lyrics) && data.lyrics.length > 0) {
          // Musixmatch subtitle format
          const parsedLyrics = data.lyrics.map((line: any) => ({
            text: line.text || "",
            seconds: line.time?.total ? line.time.total / 1000 : 0,
          })).filter((line: LyricLine) => line.text.trim() !== "");

          console.log("[LyricsBrowser] Parsed lyrics count:", parsedLyrics.length);
          setLyrics(parsedLyrics);

          // Check for translation
          if (data.translation && Array.isArray(data.translation)) {
            const parsedTranslation = data.translation.map((line: any) => ({
              text: line.text || "",
              seconds: line.time?.total ? line.time.total / 1000 : 0,
            })).filter((line: LyricLine) => line.text.trim() !== "");

            setTranslation(parsedTranslation);
            setShowTranslation(true); // Show translation by default
            console.log("[LyricsBrowser] Translation available:", parsedTranslation.length, "lines");
          } else {
            setTranslation([]);
            setShowTranslation(false);
          }
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

    setSelectedLines(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleStartAnnotation = () => {
    if (selectedLines.size === 0) return;
    setIsAnnotating(true);
    setAnnotation("");
  };

  // Save the selected lines as a bookmark. The annotation is optional, so this
  // is shared by the quick "Save" button (no note) and the annotate flow.
  const commitBookmark = (noteText: string) => {
    if (selectedLines.size === 0) return;

    // Always save original lyrics (not translation)
    const selectedLyrics = Array.from(selectedLines)
      .sort((a, b) => a - b)
      .map(idx => lyrics[idx]);

    const firstLine = selectedLyrics[0];
    const combinedLyric = selectedLyrics.map(l => l.text).join("\n");
    const label = selectedLyrics.length > 1
      ? `${selectedLyrics.length} lines from ${formatTimestamp(firstLine.seconds)}`
      : firstLine.text.substring(0, 50) + (firstLine.text.length > 50 ? "..." : "");

    onBookmark({
      seconds: firstLine.seconds,
      label,
      note: noteText.trim(),
      lyric: combinedLyric, // The lyric line(s) - always original
    });

    setSelectedLines(new Set());
    setIsAnnotating(false);
    setAnnotation("");
  };

  const handleSaveAnnotation = () => commitBookmark(annotation);

  const handleCancelAnnotation = () => {
    setSelectedLines(new Set());
    setIsAnnotating(false);
    setAnnotation("");
  };

  const formatTimestamp = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ flex: 1, fontFamily: "var(--ln-body)", fontSize: 13, color: "rgba(var(--ln-fg-rgb),0.6)" }}>
          {selectedLines.size > 0
            ? `${selectedLines.size} line${selectedLines.size > 1 ? "s" : ""} selected. Click to add/remove lines.`
            : "Click lines to select them, then save — adding an annotation is optional. Select multiple lines to bookmark a verse or chorus together."}
        </div>
        {translation.length > 0 && (
          <button
            type="button"
            onClick={() => setShowTranslation(!showTranslation)}
            className="ln-press"
            style={{
              marginLeft: 12,
              background: "rgba(var(--ln-fg-rgb),0.06)",
              border: `1px solid ${showTranslation ? gold : "rgba(var(--ln-fg-rgb),0.16)"}`,
              borderRadius: 6,
              padding: "5px 10px",
              cursor: "pointer",
              fontFamily: "var(--ln-mono)",
              fontSize: 10,
              letterSpacing: "0.04em",
              color: showTranslation ? gold : "rgba(var(--ln-fg-rgb),0.6)",
              fontWeight: 600,
              transition: "all 0.2s",
              flexShrink: 0,
            }}
          >
            {showTranslation ? "EN" : "ORIG"}
          </button>
        )}
      </div>

      {selectedLines.size > 0 && !isAnnotating && (
        <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={handleStartAnnotation}
            className="ln-press"
            style={{
              padding: "8px 16px",
              fontFamily: "var(--ln-mono)",
              fontSize: 11,
              fontWeight: 700,
              border: `1px solid ${gold}`,
              borderRadius: 8,
              background: gold,
              color: "var(--ln-bg)",
              cursor: "pointer",
            }}
          >
            ANNOTATE {selectedLines.size} LINE{selectedLines.size > 1 ? "S" : ""}
          </button>
          <button
            type="button"
            onClick={() => commitBookmark("")}
            className="ln-press"
            style={{
              padding: "8px 16px",
              fontFamily: "var(--ln-mono)",
              fontSize: 11,
              fontWeight: 700,
              border: `1px solid ${gold}`,
              borderRadius: 8,
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
              padding: "8px 14px",
              fontFamily: "var(--ln-mono)",
              fontSize: 11,
              fontWeight: 600,
              border: "1px solid rgba(var(--ln-fg-rgb),0.2)",
              borderRadius: 8,
              background: "transparent",
              color: "var(--ln-fg)",
              cursor: "pointer",
            }}
          >
            CLEAR
          </button>
        </div>
      )}

      {isAnnotating && (
        <div style={{ marginBottom: 12, padding: 14, border: `1px solid ${gold}55`, borderRadius: 12, background: `${gold}08` }}>
          <div style={{ marginBottom: 10, fontFamily: "var(--ln-body)", fontSize: 13, color: "rgba(var(--ln-fg-rgb),0.7)" }}>
            Annotating {selectedLines.size} line{selectedLines.size > 1 ? "s" : ""}:
          </div>
          <input
            type="text"
            autoFocus
            placeholder="Add your annotation (optional, press Enter to save)"
            value={annotation}
            onChange={(e) => setAnnotation(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSaveAnnotation();
              } else if (e.key === "Escape") {
                handleCancelAnnotation();
              }
            }}
            style={{
              width: "100%",
              padding: "9px 11px",
              fontFamily: "var(--ln-body)",
              fontSize: 13,
              border: `1px solid ${gold}55`,
              borderRadius: 6,
              background: "var(--ln-bg)",
              color: "var(--ln-fg)",
              outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              type="button"
              onClick={handleSaveAnnotation}
              className="ln-press"
              style={{
                padding: "7px 13px",
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
                padding: "7px 13px",
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
      )}

      <div style={{ maxHeight: 400, overflowY: "auto", border: "1px solid rgba(var(--ln-fg-rgb),0.1)", borderRadius: 12, background: "rgba(var(--ln-fg-rgb),0.02)" }}>
        {lyrics.map((line, index) => {
          const isBookmarked = bookmarkedLines.has(line.text);
          const isSelected = selectedLines.has(index);
          const minutes = Math.floor(line.seconds / 60);
          const seconds = Math.floor(line.seconds % 60);
          const timestamp = `${minutes}:${seconds.toString().padStart(2, "0")}`;
          const translatedLine = translation[index];

          return (
            <button
              key={index}
              type="button"
              onClick={() => handleLineClick(line, index)}
              disabled={isBookmarked || isAnnotating}
              className={isBookmarked || isAnnotating ? "" : "ln-press"}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "10px 14px",
                border: "none",
                borderBottom: index < lyrics.length - 1 ? "1px solid rgba(var(--ln-fg-rgb),0.06)" : "none",
                background: isBookmarked ? `${gold}15` : isSelected ? `${gold}22` : "transparent",
                cursor: isBookmarked || isAnnotating ? "default" : "pointer",
                textAlign: "left",
                transition: "background 0.15s",
                opacity: isAnnotating ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isBookmarked && !isAnnotating) {
                  e.currentTarget.style.background = isSelected ? `${gold}22` : "rgba(var(--ln-fg-rgb),0.06)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isBookmarked && !isAnnotating) {
                  e.currentTarget.style.background = isSelected ? `${gold}22` : "transparent";
                }
              }}
            >
              <div style={{ fontFamily: "var(--ln-mono)", fontSize: 11, color: isBookmarked ? gold : isSelected ? gold : "rgba(var(--ln-fg-rgb),0.4)", minWidth: 40, flexShrink: 0 }}>
                {timestamp}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "var(--ln-body)", fontSize: 14.5, lineHeight: 1.5, color: isBookmarked ? gold : isSelected ? gold : "var(--ln-fg)" }}>
                  {line.text}
                </div>
                {showTranslation && translatedLine && translatedLine.text !== line.text && (
                  <div style={{ fontFamily: "var(--ln-body)", fontSize: 12, lineHeight: 1.4, color: "rgba(var(--ln-fg-rgb),0.5)", marginTop: 4, fontStyle: "italic" }}>
                    {translatedLine.text}
                  </div>
                )}
              </div>
              {isBookmarked && (
                <div style={{ fontSize: 16, color: gold }}>★</div>
              )}
              {isSelected && !isBookmarked && (
                <div style={{ fontSize: 14, color: gold, fontFamily: "var(--ln-mono)", fontWeight: 600 }}>✓</div>
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
