"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getReviews } from "@/lib/api";
import { toReviewVM } from "@/lib/view-adapter";

export default function ExperiencePlaylist() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPlaylist() {
      try {
        // Fetch all content types in parallel with detailed error handling
        const [trackReviews, albumReviews, playlists] = await Promise.all([
          getReviews({ feed: "friends" }).catch(e => {
            console.error("[Experience] Failed to fetch track reviews:", e);
            throw new Error(`Track reviews: ${e.message}`);
          }),
          fetch('/api/album-reviews?feed=friends')
            .then(async r => {
              if (!r.ok) {
                const errorText = await r.text();
                throw new Error(`Album reviews (${r.status}): ${errorText}`);
              }
              return r.json();
            })
            .then(d => d.albumReviews || [])
            .catch(e => {
              console.error("[Experience] Failed to fetch album reviews:", e);
              throw new Error(`Album reviews: ${e.message}`);
            }),
          fetch('/api/playlists?feed=friends')
            .then(async r => {
              if (!r.ok) {
                const errorText = await r.text();
                throw new Error(`Playlists (${r.status}): ${errorText}`);
              }
              return r.json();
            })
            .then(d => d.playlists || [])
            .catch(e => {
              console.error("[Experience] Failed to fetch playlists:", e);
              throw new Error(`Playlists: ${e.message}`);
            }),
        ]);

        // Collect all items with annotations (notes/moments)
        const annotatedItems: Array<{ id: string; type: string; createdAt: string; hasNotes: boolean }> = [];

        // Track reviews with notes
        trackReviews.forEach((review: any) => {
          if (review.notes && review.notes.length > 0) {
            annotatedItems.push({
              id: review.id,
              type: 'review',
              createdAt: review.createdAt,
              hasNotes: true,
            });
          }
        });

        // Album review tracks with notes
        albumReviews.forEach((albumReview: any) => {
          albumReview.trackReviews?.forEach((trackReview: any) => {
            if (trackReview.notes && trackReview.notes.length > 0) {
              annotatedItems.push({
                id: trackReview.id,
                type: 'review',
                createdAt: trackReview.createdAt,
                hasNotes: true,
              });
            }
          });
        });

        // Playlist tracks with notes
        playlists.forEach((playlist: any) => {
          playlist.tracks?.forEach((track: any) => {
            if (track.notes && track.notes.length > 0) {
              annotatedItems.push({
                id: track.id,
                type: 'playlist-track',
                createdAt: playlist.createdAt, // Use playlist creation time
                hasNotes: true,
              });
            }
          });
        });

        // Sort by most recent
        annotatedItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        if (annotatedItems.length > 0) {
          const firstItem = annotatedItems[0];
          // All items are reviews (track reviews or album track reviews)
          // Playlist tracks aren't playable in Experience yet
          if (firstItem.type === 'review') {
            router.replace(`/experience/${firstItem.id}?type=feed`);
          } else {
            // Fallback to regular feed
            router.replace("/feed");
          }
        } else {
          // No annotated content, go to feed
          router.replace("/feed");
        }
      } catch (error) {
        console.error("Failed to load experience playlist:", error);
        console.error("Error details:", error instanceof Error ? error.message : String(error));
        // Don't redirect immediately - show the error state
        setLoading(false);
        alert(`Failed to load reviews: ${error instanceof Error ? error.message : String(error)}\n\nCheck the console for details.`);
        router.replace("/feed");
      }
    }

    loadPlaylist();
  }, [router]);

  if (loading) {
    return (
      <div style={{ background: "var(--ln-bg)", color: "var(--ln-fg)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid rgba(var(--ln-fg-rgb),0.15)", borderTopColor: "var(--ln-accent)", animation: "ln-spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <div style={{ fontFamily: "var(--ln-body)", fontSize: 15, color: "var(--ln-muted)" }}>
            Loading the Experience...
          </div>
        </div>
      </div>
    );
  }

  return null;
}
