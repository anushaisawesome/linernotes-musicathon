"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams } from "next/navigation";
import { WebPlaybackSDK, type PlayerState } from "@/lib/spotify-player";
import { getActiveAnnotations, type SyncedLyrics, type ActiveAnnotations } from "@/lib/sync-engine";
import type { Review } from "@/lib/types";

function ExperienceContent() {
  const params = useParams();
  const reviewId = params.id as string;

  const [review, setReview] = useState<Review | null>(null);
  const [lyrics, setLyrics] = useState<SyncedLyrics | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [annotations, setAnnotations] = useState<ActiveAnnotations | null>(null);
  const [player, setPlayer] = useState<WebPlaybackSDK | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch review data
  useEffect(() => {
    async function fetchReview() {
      try {
        const res = await fetch(`/api/reviews/${reviewId}`);
        if (!res.ok) throw new Error("Failed to load review");

        const data = await res.json();
        setReview(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load review");
      }
    }

    fetchReview();
  }, [reviewId]);

  // Initialize Spotify player
  useEffect(() => {
    if (!review) return;

    async function initPlayer() {
      try {
        // Load SDK
        await WebPlaybackSDK.loadSDK();

        // Get access token
        const tokenRes = await fetch("/api/spotify/token");
        if (!tokenRes.ok) throw new Error("Failed to get Spotify token");

        const { access_token } = await tokenRes.json();

        // Initialize player
        const sdk = new WebPlaybackSDK(access_token);
        await sdk.initialize((state) => {
          setPlayerState(state);
        });

        setPlayer(sdk);

        // Note: Auto-play requires user to manually select track in Spotify
        // For demo, user will need to start playback from Spotify app
        // Then transfer to this Web Playback device

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize player");
        setLoading(false);
      }
    }

    initPlayer();

    return () => {
      if (player) {
        player.disconnect();
      }
    };
  }, [review, player]);

  // Fetch lyrics when track changes
  useEffect(() => {
    if (!playerState?.isrc) return;

    async function fetchLyrics() {
      try {
        const res = await fetch(`/api/lyrics?isrc=${encodeURIComponent(playerState?.isrc || '')}`);

        // Graceful degradation: If Musixmatch key expired, show message but don't crash
        if (res.status === 401 || res.status === 403) {
          setError("Musixmatch trial key has expired. See the video for the full experience!");
          return;
        }

        if (!res.ok) {
          console.log("No lyrics available for this track");
          setLyrics(null);
          return;
        }

        const data = await res.json();
        setLyrics(data.lyrics);
      } catch (err) {
        console.error("Failed to fetch lyrics:", err);
        setLyrics(null);
      }
    }

    fetchLyrics();
  }, [playerState?.isrc]);

  // Update annotations whenever player state changes
  useEffect(() => {
    if (!playerState) return;

    const newAnnotations = getActiveAnnotations(playerState, lyrics, review);
    setAnnotations(newAnnotations);
  }, [playerState, lyrics, review]);

  if (error) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h1>Error</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (loading || !review) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <div style={{ animation: "spin 1s linear infinite" }}>Loading Experience...</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--ln-bg)",
      color: "var(--ln-fg)",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <header style={{
        padding: "20px",
        borderBottom: "1px solid rgba(var(--ln-line-rgb), 0.1)",
      }}>
        <h1 style={{ margin: 0, fontSize: "24px" }}>Experience</h1>
        <p style={{ margin: "8px 0 0", opacity: 0.7 }}>
          {playerState?.trackName || review.track.name} · {playerState?.artistName || review.track.artist}
        </p>
      </header>

      {/* Main content */}
      <main style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        maxWidth: "800px",
        width: "100%",
        margin: "0 auto",
        padding: "40px 20px",
      }}>
        {/* Album art */}
        {review.track.artworkUrl && (
          <div style={{
            width: "200px",
            height: "200px",
            margin: "0 auto 40px",
            borderRadius: "8px",
            overflow: "hidden",
          }}>
            <img
              src={review.track.artworkUrl}
              alt={review.track.album}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        )}

        {/* Current note (if active) */}
        {annotations?.currentNote && (
          <div style={{
            padding: "24px",
            marginBottom: "40px",
            background: "rgba(var(--ln-accent-rgb), 0.1)",
            border: "2px solid var(--ln-accent)",
            borderRadius: "12px",
            animation: "fadeIn 0.3s ease-in",
          }}>
            <div style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--ln-accent)",
              marginBottom: "8px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}>
              {annotations.currentNote.label || `${Math.floor(annotations.currentNote.timestampSeconds / 60)}:${(annotations.currentNote.timestampSeconds % 60).toString().padStart(2, '0')}`}
            </div>
            <div style={{
              fontSize: "18px",
              fontStyle: "italic",
              lineHeight: 1.6,
            }}>
              "{annotations.currentNote.note}"
            </div>
          </div>
        )}

        {/* Synced lyrics */}
        {lyrics && lyrics.lines && (
          <div style={{
            flex: 1,
            overflowY: "auto",
          }}>
            {lyrics.lines.map((line, index) => {
              const isActive = index === annotations?.activeLineIndex;
              const hasMoment = annotations?.firedMoments.some(
                m => Math.abs(m.timestampSeconds - line.time.total / 1000) < 1
              );

              return (
                <div
                  key={index}
                  style={{
                    padding: "16px 24px",
                    fontSize: isActive ? "24px" : "18px",
                    fontWeight: isActive ? 600 : 400,
                    opacity: isActive ? 1 : 0.4,
                    transition: "all 0.3s ease",
                    color: hasMoment ? "var(--ln-accent)" : "inherit",
                    borderLeft: hasMoment ? "4px solid var(--ln-accent)" : "none",
                    paddingLeft: hasMoment ? "20px" : "24px",
                  }}
                >
                  {line.text}
                </div>
              );
            })}
          </div>
        )}

        {!lyrics && (
          <div style={{
            textAlign: "center",
            padding: "40px",
            opacity: 0.5,
          }}>
            No synced lyrics available for this track
          </div>
        )}
      </main>

      {/* Playback controls */}
      {player && playerState && (
        <footer style={{
          padding: "20px",
          borderTop: "1px solid rgba(var(--ln-line-rgb), 0.1)",
          background: "var(--ln-surface)",
        }}>
          <div style={{
            maxWidth: "800px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}>
            <button
              onClick={() => player.togglePlay()}
              style={{
                padding: "12px 24px",
                background: "var(--ln-accent)",
                color: "var(--ln-bg)",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {playerState.isPlaying ? "Pause" : "Play"}
            </button>

            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: "12px",
                marginBottom: "4px",
                opacity: 0.7,
              }}>
                {Math.floor(playerState.positionMs / 60000)}:{((playerState.positionMs % 60000) / 1000).toFixed(0).padStart(2, '0')} / {Math.floor(playerState.durationMs / 60000)}:{((playerState.durationMs % 60000) / 1000).toFixed(0).padStart(2, '0')}
              </div>
              <input
                type="range"
                min="0"
                max={playerState.durationMs}
                value={playerState.positionMs}
                onChange={(e) => player.seek(parseInt(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

export default function ExperiencePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ExperienceContent />
    </Suspense>
  );
}
