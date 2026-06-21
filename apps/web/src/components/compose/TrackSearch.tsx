"use client";

import { useState, useEffect, useRef } from "react";
import type { Track } from "@/lib/types";
import { cmpInput } from "./composer-ui";

interface TrackSearchProps {
  onTrackSelect: (track: Track) => void;
  searchAPI?: (query: string, offset?: number) => Promise<Track[]>;
}

// Spotify (dev mode) caps this app's search at 10 results per page; we page
// through with an offset when the user wants to see more.
const PAGE = 10;
const DEBOUNCE_MS = 500; // Wait 500ms after user stops typing

export function TrackSearch({ onTrackSelect, searchAPI }: TrackSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Debounce query input
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query]);

  const resolveApi = async () => {
    if (searchAPI) return searchAPI;
    const { mockAPI } = await import("@/lib/mocks");
    return mockAPI.searchTracks as (query: string, offset?: number) => Promise<Track[]>;
  };

  // Perform actual search when debounced query changes
  useEffect(() => {
    const performSearch = async () => {
      if (debouncedQuery.trim().length < 2) {
        setResults([]);
        setShowResults(false);
        setHasMore(false);
        return;
      }

      const api = await resolveApi();
      setLoading(true);
      try {
        const tracks = await api(debouncedQuery, 0);
        setResults(tracks);
        setHasMore(tracks.length >= PAGE);
        setShowResults(true);
      } catch (error) {
        console.error("Search failed:", error);
        setResults([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    };

    performSearch();
  }, [debouncedQuery]);

  const loadMore = async () => {
    if (loadingMore) return;
    const api = await resolveApi();
    setLoadingMore(true);
    try {
      const more = await api(debouncedQuery, results.length);
      // Dedup by trackId in case pages overlap.
      setResults((prev) => {
        const seen = new Set(prev.map((t) => t.trackId));
        const fresh = more.filter((t) => !seen.has(t.trackId));
        return [...prev, ...fresh];
      });
      setHasMore(more.length >= PAGE);
    } catch (error) {
      console.error("Load more failed:", error);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  const selectTrack = (track: Track) => {
    onTrackSelect(track);
    setQuery("");
    setResults([]);
    setShowResults(false);
    setHasMore(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for a track…"
        style={cmpInput}
      />

      {loading && (
        <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)" }}>
          <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(var(--ln-fg-rgb),0.2)", borderTopColor: "var(--ln-accent)", animation: "ln-spin 0.8s linear infinite" }} />
        </div>
      )}

      {showResults && (results.length > 0 || !loading) && (
        <div className="ln-scroll" style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 8, borderRadius: 14, overflow: "hidden", overflowY: "auto", overscrollBehavior: "contain", maxHeight: "min(360px, 50vh)", zIndex: 80, background: "var(--ln-bg)", border: "1px solid rgba(var(--ln-line-rgb),0.18)", boxShadow: "0 26px 56px -26px var(--ln-shadow)" }}>
          {results.length > 0 ? (
            results.map((track) => (
              <button key={track.trackId} type="button" onClick={() => selectTrack(track)} style={{ width: "100%", padding: "11px 13px", display: "flex", alignItems: "center", gap: 12, textAlign: "left", background: "none", border: "none", borderBottom: "1px solid rgba(var(--ln-fg-rgb),0.06)", cursor: "pointer" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={track.artworkUrl} alt={track.album} style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--ln-body)", fontSize: 14, fontWeight: 600, color: "var(--ln-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.name}</div>
                  <div style={{ fontFamily: "var(--ln-mono)", fontSize: 11, color: "var(--ln-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.artist} · {track.album}</div>
                </div>
              </button>
            ))
          ) : (
            <div style={{ padding: "16px", textAlign: "center", fontFamily: "var(--ln-body)", fontSize: 13.5, color: "var(--ln-muted)" }}>No tracks found</div>
          )}

          {results.length > 0 && hasMore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="ln-press"
              style={{ width: "100%", padding: "12px 13px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "rgba(var(--ln-fg-rgb),0.03)", border: "none", borderTop: "1px solid rgba(var(--ln-fg-rgb),0.08)", cursor: loadingMore ? "default" : "pointer", fontFamily: "var(--ln-body)", fontSize: 13, fontWeight: 600, color: "var(--ln-accent)" }}
            >
              {loadingMore ? (
                <div style={{ width: 15, height: 15, borderRadius: "50%", border: "2px solid rgba(var(--ln-accent-rgb),0.3)", borderTopColor: "var(--ln-accent)", animation: "ln-spin 0.8s linear infinite" }} />
              ) : (
                "Show more results"
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
