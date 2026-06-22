"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ComposeForm } from "@/components/compose";
import { TopBar, Footer } from "@/components/ln/nav";
import type { Track } from "@/lib/types";

// Search tracks using iTunes/MusicBrainz (no rate limits)
// Spotify ID will be looked up server-side during review submission
async function searchSpotifyTracks(query: string, offset = 0): Promise<Track[]> {
  try {
    const response = await fetch(`/api/music/search/tracks?q=${encodeURIComponent(query)}&limit=10`);
    if (!response.ok) return [];

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("[Search] Track search failed:", error);
    return [];
  }
}

function LogPageContent() {
  const searchParams = useSearchParams();
  const [initialTrack, setInitialTrack] = useState<Track | undefined>(undefined);
  const [isLookingUpSpotify, setIsLookingUpSpotify] = useState(false);
  const [editReview, setEditReview] = useState<any>(null);
  const [isLoadingReview, setIsLoadingReview] = useState(false);

  // Check if we're editing an existing review
  const editId = searchParams.get("edit");

  // Check if we have track data from Last.fm prompt
  const trackName = searchParams.get("track");
  const artistName = searchParams.get("artist");
  const albumName = searchParams.get("album");
  const artworkUrl = searchParams.get("artwork");
  const promptText = searchParams.get("prompt");
  const promptTag = searchParams.get("tag");
  const initialRating = searchParams.get("rating");

  // Fetch review data if editing
  useEffect(() => {
    if (!editId) return;

    async function fetchReview() {
      setIsLoadingReview(true);
      try {
        const response = await fetch(`/api/reviews/${editId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch review");
        }
        const { review } = await response.json();
        setEditReview(review);

        // Set initial track from review
        setInitialTrack({
          trackId: review.track.trackId,
          name: review.track.name,
          artist: review.track.artist,
          album: review.track.album,
          artworkUrl: review.track.artworkUrl,
          previewUrl: review.track.previewUrl || "",
        });
      } catch (error) {
        console.error("[Log Page] Failed to fetch review:", error);
        alert("Failed to load review for editing");
      } finally {
        setIsLoadingReview(false);
      }
    }

    fetchReview();
  }, [editId]);

  // Look up real Spotify track ID for Last.fm tracks
  useEffect(() => {
    if (!trackName || !artistName || editId) return;

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

        // Upgrade Last.fm artwork from 64s to 300x300
        let upgradedArtwork = artworkUrl || "";
        if (upgradedArtwork.includes("/64s/")) {
          upgradedArtwork = upgradedArtwork.replace("/64s/", "/300x300/");
        }

        setInitialTrack({
          trackId: `lastfm-${trackName}-${artistName}`,
          name: trackName || '',
          artist: artistName || '',
          album: albumName || "",
          artworkUrl: upgradedArtwork,
          previewUrl: "",
        });
      } catch (error) {
        console.error("[Log Page] Failed to lookup Spotify track:", error);

        // Upgrade Last.fm artwork from 64s to 300x300
        let upgradedArtwork = artworkUrl || "";
        if (upgradedArtwork.includes("/64s/")) {
          upgradedArtwork = upgradedArtwork.replace("/64s/", "/300x300/");
        }

        // Fall back to Last.fm data
        setInitialTrack({
          trackId: `lastfm-${trackName}-${artistName}`,
          name: trackName || '',
          artist: artistName || '',
          album: albumName || "",
          artworkUrl: upgradedArtwork,
          previewUrl: "",
        });
      } finally {
        setIsLookingUpSpotify(false);
      }
    }

    lookupSpotifyTrack();
  }, [trackName, artistName, albumName, artworkUrl]);

  // Show loading state while fetching review
  if (isLoadingReview) {
    return (
      <div style={{ background: "var(--ln-bg)", color: "var(--ln-fg)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid rgba(var(--ln-fg-rgb),0.15)", borderTopColor: "var(--ln-accent)", animation: "ln-spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ background: "var(--ln-bg)", color: "var(--ln-fg)", minHeight: "100vh", display: "flex", flexDirection: "column", flex: 1 }}>
      <TopBar />

      <main style={{ position: "relative", zIndex: 1, flex: 1 }}>
        <section style={{ maxWidth: 960, margin: "0 auto", padding: "112px 20px 90px" }}>
          <h1 style={{ margin: 0, fontFamily: "var(--ln-display)", fontWeight: 600, fontSize: 30, letterSpacing: "-0.01em" }}>
            {editId ? "Edit note" : "Log a note"}
          </h1>
          <p style={{ margin: "8px 0 24px", fontFamily: "var(--ln-preview)", fontStyle: "italic", fontSize: 17, color: "var(--ln-muted)" }}>
            {editId
              ? "Update your rating, note, or moments below."
              : promptText || "Search a track, rate it, and time-stamp the exact second it got you. A rating alone is a valid note."}
          </p>
          {promptTag && (
            <div style={{ marginBottom: 16, padding: "6px 12px", borderRadius: 999, background: "rgba(var(--ln-accent-rgb),0.12)", border: "1px solid rgba(var(--ln-accent-rgb),0.3)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: "var(--ln-mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ln-accent)", fontWeight: 700 }}>{promptTag}</span>
            </div>
          )}

          <ComposeForm
            searchAPI={searchSpotifyTracks}
            initialTrack={initialTrack}
            initialRating={editReview ? editReview.rating : (initialRating ? parseInt(initialRating) : undefined)}
            editReviewId={editId || undefined}
            initialTake={editReview?.take}
            initialNotes={editReview?.notes}
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
