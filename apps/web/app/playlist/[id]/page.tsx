"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Playlist, Review } from "@/lib/types";
import { TopBar } from "@/components/ln/nav";
import { ImmersiveReview, ReviewActions } from "@/components/ln/review";
import { ShareModal } from "@/components/share";
import { toPlaylistVM } from "@/lib/view-adapter";

export default function PlaylistPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [related, setRelated] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const loadPlaylist = async () => {
      try {
        const res = await fetch(`/api/playlists/${id}`);
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = await res.json();
        setPlaylist(data.playlist);

        const authRes = await fetch("/api/auth/me");
        if (authRes.ok) {
          const authData = await authRes.json();
          setIsOwner(authData.user?.id === data.playlist.userId);
        }

        // "more on LinerNotes" pulls other playlists from the community.
        fetch("/api/playlists")
          .then((r) => (r.ok ? r.json() : { playlists: [] }))
          .then((d) => setRelated((d.playlists || []).filter((p: Playlist) => p.id !== id).slice(0, 4)))
          .catch(() => {});
      } catch (error) {
        console.error("Failed to fetch playlist:", error);
      } finally {
        setLoading(false);
      }
    };

    if (id) loadPlaylist();
  }, [id]);

  const handleDelete = async () => {
    if (!playlist) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/playlists/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete playlist");
      }
      router.push("/");
    } catch (error) {
      console.error("Failed to delete playlist:", error);
      alert("Failed to delete playlist: " + (error as Error).message);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0807" }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", border: "3px solid rgba(241,235,224,0.15)", borderTopColor: "var(--ln-accent)", animation: "ln-spin 0.8s linear infinite" }} />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0807", color: "#f1ebe0", textAlign: "center", padding: 24 }}>
        <div>
          <h1 style={{ fontFamily: "var(--ln-display)", fontSize: 30, fontWeight: 600, margin: 0 }}>Playlist not found</h1>
          <p style={{ fontFamily: "var(--ln-body)", opacity: 0.7, marginTop: 8 }}>This playlist doesn&apos;t exist or has been deleted.</p>
        </div>
      </div>
    );
  }

  const vm = toPlaylistVM(playlist);
  const relatedVms = related.map((p) => toPlaylistVM(p));

  // Build a track-shaped review (using the cover = first track) so the share
  // card can render the playlist.
  const cover = playlist.tracks?.[0];
  const shareReview: Review = {
    id: playlist.id,
    userId: playlist.userId,
    user: playlist.user,
    track: {
      trackId: playlist.id,
      name: playlist.title,
      artist: playlist.user?.displayName || playlist.user?.handle || "playlist",
      album: playlist.title,
      artworkUrl: cover?.artworkUrl || "",
    },
    rating: 0,
    take: playlist.description,
    createdAt: playlist.createdAt,
    likeCount: playlist.likeCount,
    repostCount: playlist.repostCount,
  };

  return (
    <div style={{ background: "#0a0807", minHeight: "100vh" }}>
      <TopBar transparent />

      <ImmersiveReview
        vm={vm}
        related={relatedVms}
        isSelf={isOwner}
        actions={
          <ReviewActions
            onShareCard={() => setShowShare(true)}
            onDelete={() => setShowDeleteConfirm(true)}
            isOwner={isOwner}
          />
        }
      />

      {showShare && <ShareModal review={shareReview} onClose={() => setShowShare(false)} />}

      {showDeleteConfirm && (
        <div onClick={() => !deleting && setShowDeleteConfirm(false)} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(6,4,4,0.66)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", animation: "ln-fade 0.2s ease both" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "var(--ln-bg)", borderRadius: 20, border: "1px solid rgba(var(--ln-line-rgb),0.14)", boxShadow: "0 50px 110px -34px rgba(0,0,0,0.8)", padding: "26px 24px", animation: "ln-pop 0.3s cubic-bezier(.16,1,.3,1) both" }}>
            <h3 style={{ margin: 0, fontFamily: "var(--ln-display)", fontSize: 22, fontWeight: 600, color: "#f1ebe0" }}>Delete this playlist?</h3>
            <p style={{ margin: "10px 0 18px", fontFamily: "var(--ln-body)", fontSize: 14.5, color: "rgba(241,235,224,0.7)" }}>This removes the playlist and its track notes. It can&apos;t be undone.</p>
            <div style={{ display: "flex", gap: 11 }}>
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting} className="ln-press" style={{ flex: 1, padding: "12px", borderRadius: 12, cursor: "pointer", background: "rgba(241,235,224,0.08)", color: "#f1ebe0", border: "1px solid rgba(241,235,224,0.16)", fontFamily: "var(--ln-body)", fontWeight: 600 }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="ln-press" style={{ flex: 1, padding: "12px", borderRadius: 12, cursor: "pointer", background: "#dc2626", color: "white", border: "none", fontFamily: "var(--ln-body)", fontWeight: 600 }}>{deleting ? "Deleting…" : "Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
