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
        // Get recent community track reviews
        const reviews = await getReviews({ feed: "friends" });
        const trackReviews = reviews
          .filter((r) => r.track?.trackId && !r.track.trackId.startsWith("lastfm-"))
          .slice(0, 10); // Get top 10 recent reviews

        if (trackReviews.length > 0) {
          // Open the community-feed experience starting at the most recent post,
          // so prev/next walks the whole feed playlist.
          router.replace(`/experience/${trackReviews[0].id}?type=feed`);
        } else {
          // No reviews yet, go to feed
          router.replace("/feed");
        }
      } catch (error) {
        console.error("Failed to load experience playlist:", error);
        router.replace("/feed");
      } finally {
        setLoading(false);
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
