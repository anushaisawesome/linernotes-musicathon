"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AlbumComposeForm } from "@/components/compose/AlbumComposeForm";
import { TopBar, Footer } from "@/components/ln/nav";

function LogAlbumContent() {
  const searchParams = useSearchParams();
  const album = searchParams.get("album");
  const artist = searchParams.get("artist");
  const artwork = searchParams.get("artwork");
  // A "worth a note" album prompt deep-links here with the album pre-filled.
  const initialAlbum = album && artist ? { album, artist, artworkUrl: artwork || undefined } : undefined;

  return (
    <div style={{ background: "var(--ln-bg)", color: "var(--ln-fg)", minHeight: "100vh", display: "flex", flexDirection: "column", flex: 1 }}>
      <TopBar />

      <main style={{ position: "relative", zIndex: 1, flex: 1 }}>
        <section style={{ maxWidth: 960, margin: "0 auto", padding: "112px 20px 90px" }}>
          <h1 style={{ margin: 0, fontFamily: "var(--ln-display)", fontWeight: 600, fontSize: 30, letterSpacing: "-0.01em" }}>Review an album</h1>
          <p style={{ margin: "8px 0 24px", fontFamily: "var(--ln-preview)", fontStyle: "italic", fontSize: 17, color: "var(--ln-muted)" }}>
            You don&apos;t need to rate every track. React to the ones that stuck, mark the moments, and let the rest fade.
          </p>

          <AlbumComposeForm initialAlbum={initialAlbum} />
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
