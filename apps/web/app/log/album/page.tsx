"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlbumComposeForm } from "@/components/compose/AlbumComposeForm";
import { TopBar, Footer } from "@/components/ln/nav";
import type { AlbumReview } from "@/lib/types";

function LogAlbumContent() {
  const searchParams = useSearchParams();
  const album = searchParams.get("album");
  const artist = searchParams.get("artist");
  const artwork = searchParams.get("artwork");
  const editId = searchParams.get("edit");

  const [editingReview, setEditingReview] = useState<AlbumReview | null>(null);
  const [loading, setLoading] = useState(!!editId);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing album review if editing
  useEffect(() => {
    if (!editId) return;

    const fetchReview = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/album-reviews/${editId}`);
        if (!res.ok) {
          throw new Error("Failed to fetch album review");
        }
        const data = await res.json();
        setEditingReview(data.albumReview);
      } catch (err) {
        console.error("Error fetching album review:", err);
        setError("Failed to load album review for editing");
      } finally {
        setLoading(false);
      }
    };

    fetchReview();
  }, [editId]);

  // A "worth a note" album prompt deep-links here with the album pre-filled.
  const initialAlbum = album && artist ? { album, artist, artworkUrl: artwork || undefined } : undefined;

  if (loading) {
    return (
      <div style={{ background: "var(--ln-bg)", color: "var(--ln-fg)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid rgba(var(--ln-fg-rgb),0.15)", borderTopColor: "var(--ln-accent)", animation: "ln-spin 0.8s linear infinite" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: "var(--ln-bg)", color: "var(--ln-fg)", minHeight: "100vh", display: "flex", flexDirection: "column", flex: 1 }}>
        <TopBar />
        <main style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", padding: "20px" }}>
            <p style={{ fontFamily: "var(--ln-body)", fontSize: 16, color: "var(--ln-muted)" }}>{error}</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div style={{ background: "var(--ln-bg)", color: "var(--ln-fg)", minHeight: "100vh", display: "flex", flexDirection: "column", flex: 1 }}>
      <TopBar />

      <main style={{ position: "relative", zIndex: 1, flex: 1 }}>
        <section style={{ maxWidth: 960, margin: "0 auto", padding: "112px 20px 90px" }}>
          <h1 style={{ margin: 0, fontFamily: "var(--ln-display)", fontWeight: 600, fontSize: 30, letterSpacing: "-0.01em" }}>
            {editingReview ? "Edit album review" : "Review an album"}
          </h1>
          <p style={{ margin: "8px 0 24px", fontFamily: "var(--ln-preview)", fontStyle: "italic", fontSize: 17, color: "var(--ln-muted)" }}>
            You don&apos;t need to rate every track. React to the ones that stuck, mark the moments, and let the rest fade.
          </p>

          <AlbumComposeForm
            initialAlbum={initialAlbum}
            initialAlbumReview={editingReview || undefined}
          />
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default function LogAlbumPage() {
  return (
    <Suspense fallback={
      <div style={{ background: "var(--ln-bg)", color: "var(--ln-fg)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid rgba(var(--ln-fg-rgb),0.15)", borderTopColor: "var(--ln-accent)", animation: "ln-spin 0.8s linear infinite" }} />
      </div>
    }>
      <LogAlbumContent />
    </Suspense>
  );
}
