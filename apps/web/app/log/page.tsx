"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ComposeForm } from "@/components/compose";
import { TopBar, Footer } from "@/components/ln/nav";
import type { Track } from "@/lib/types";

// Search Spotify for tracks (returns real Spotify track IDs for playback).
// offset pages through results for the "show more" control.
async function searchSpotifyTracks(query: string, offset = 0): Promise<Track[]> {
  try {
    const response = await fetch(`/api/spotify/search?q=${encodeURIComponent(query)}&limit=10&offset=${offset}`);

    // If rate limited, return empty (user can try again in a moment)
    if (response.status === 429) {
      console.warn("[Search] Spotify rate limited, please wait");
      return [];
    }

    if (!response.ok) return [];

    const data = await response.json();
    return data.tracks || [];
  } catch (error) {
    console.error("[Search] Spotify search failed:", error);
    return [];
  }
}

function LogPageContent() {
  const searchParams = useSearchParams();
  const [initialTrack, setInitialTrack] = useState<Track | undefined>(undefined);
  const [isLookingUpSpotify, setIsLookingUpSpotify] = useState(false);

  // Check if we have track data from Last.fm prompt
  const trackName = searchParams.get("track");
  const artistName = searchParams.get("artist");
  const albumName = searchParams.get("album");
  const artworkUrl = searchParams.get("artwork");
  const promptText = searchParams.get("prompt");
  const promptTag = searchParams.get("tag");
  const initialRating = searchParams.get("rating");

  // Look up real Spotify track ID for Last.fm tracks
  useEffect(() => {
    if (!trackName || !artistName) return;

    async function lookupSpotifyTrack() {
      setIsLookingUpSpotify(true);
      try {
        // Clean up track name (remove trailing periods)
        const cleanTrack = trackName?.trim().replace(/\.\s*$/, '').trim() || '';
        const cleanArtist = artistName?.trim() || '';

        // Search Spotify directly for real track ID
        const query = encodeURIComponent(`${cleanTrack} ${cleanArtist}`);
        const response = await fetch(`/api/spotify/search?q=${query}&limit=1`);

        if (response.status === 429) {
          console.warn("[Log Page] Spotify rate limited - using Last.fm data");
          // Fall through to use Last.fm data
        } else if (response.ok) {
          const data = await response.json();
          if (data.tracks && data.tracks.length > 0) {
            const spotifyTrack = data.tracks[0];
            console.log("[Log Page] Found Spotify track:", spotifyTrack.trackId, "for", trackName);
            setInitialTrack(spotifyTrack);
            setIsLookingUpSpotify(false);
            return;
          }
        }

        // No Spotify match - use Last.fm data with fake ID (Experience will show preview mode)
        console.log("[Log Page] No Spotify match found for", trackName, "- using Last.fm data");
        setInitialTrack({
          trackId: `lastfm-${trackName}-${artistName}`,
          name: trackName || '',
          artist: artistName || '',
          album: albumName || "",
          artworkUrl: artworkUrl || "",
          previewUrl: "",
        });
      } catch (error) {
        console.error("[Log Page] Failed to lookup Spotify track:", error);
        // Fall back to Last.fm data
        setInitialTrack({
          trackId: `lastfm-${trackName}-${artistName}`,
          name: trackName || '',
          artist: artistName || '',
          album: albumName || "",
          artworkUrl: artworkUrl || "",
          previewUrl: "",
        });
      } finally {
        setIsLookingUpSpotify(false);
      }
    }

    lookupSpotifyTrack();
  }, [trackName, artistName, albumName, artworkUrl]);

  return (
    <div style={{ background: "var(--ln-bg)", color: "var(--ln-fg)", minHeight: "100vh", display: "flex", flexDirection: "column", flex: 1 }}>
      <TopBar />

      <main style={{ position: "relative", zIndex: 1, flex: 1 }}>
        <section style={{ maxWidth: 960, margin: "0 auto", padding: "112px 20px 90px" }}>
          <h1 style={{ margin: 0, fontFamily: "var(--ln-display)", fontWeight: 600, fontSize: 30, letterSpacing: "-0.01em" }}>Log a note</h1>
          <p style={{ margin: "8px 0 24px", fontFamily: "var(--ln-preview)", fontStyle: "italic", fontSize: 17, color: "var(--ln-muted)" }}>
            {promptText || "Search a track, rate it, and time-stamp the exact second it got you. A rating alone is a valid note."}
          </p>
          {promptTag && (
            <div style={{ marginBottom: 16, padding: "6px 12px", borderRadius: 999, background: "rgba(var(--ln-accent-rgb),0.12)", border: "1px solid rgba(var(--ln-accent-rgb),0.3)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: "var(--ln-mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ln-accent)", fontWeight: 700 }}>{promptTag}</span>
            </div>
          )}

          <ComposeForm
            searchAPI={searchSpotifyTracks}
            initialTrack={initialTrack}
            initialRating={initialRating ? parseInt(initialRating) : undefined}
          />
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default function LogPage() {
  return (
    <Suspense fallback={
      <div style={{ background: "var(--ln-bg)", color: "var(--ln-fg)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid rgba(var(--ln-fg-rgb),0.15)", borderTopColor: "var(--ln-accent)", animation: "ln-spin 0.8s linear infinite" }} />
      </div>
    }>
      <LogPageContent />
    </Suspense>
  );
}
