"use client";

/**
 * Musicathon Share Modal - Review Share
 * Shows preview of how the shared IMAGE looks: review card baked onto album-color story canvas
 * Format toggle (Story / Square / Link), copy-link + share-to chips
 */

import { useEffect, useState } from "react";
import type { Review } from "@/lib/types";
import { LNArt, LNStars, lnFmt } from "@/components/ln/atoms";
import { paletteFromString } from "@/lib/palette";

interface ShareModalProps {
  review: Review;
  accent?: string;
  onClose: () => void;
}

export function ShareModal({ review, accent: accentProp, onClose }: ShareModalProps) {
  const acc = accentProp || "#d5896f";
  const p = paletteFromString(review.track.trackId || review.track.album || review.track.name);
  const user = review.user;
  const hasFull = !!review.take;
  const [format, setFormat] = useState<"story" | "square" | "link">("story");
  const [copied, setCopied] = useState(false);
  const url = `linernotes.app/r/${review.id}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = () => {
    try {
      navigator.clipboard && navigator.clipboard.writeText("https://" + url);
    } catch (e) {
      console.error(e);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const FORMATS = [
    { id: "story" as const, label: "Story", sub: "9:16" },
    { id: "square" as const, label: "Square", sub: "1:1" },
    { id: "link" as const, label: "Link", sub: "URL" },
  ];

  const CHANNELS = [
    { id: "ig", label: "Instagram", c: "#d98aa0" },
    { id: "tiktok", label: "TikTok", c: "#3fc8ea" },
    { id: "snap", label: "Snapchat", c: "#f5d90a" },
    { id: "x", label: "X", c: "rgba(var(--ln-fg-rgb),0.7)" },
  ];

  const isStory = format === "story";
  const frameW = format === "square" ? 320 : 280;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 350, background: "rgba(6,4,4,0.72)", backdropFilter: "blur(7px)", WebkitBackdropFilter: "blur(7px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "56px 20px 40px", overflowY: "auto", animation: "ln-fade 0.2s ease both" }}>
      <div onClick={(e) => e.stopPropagation()} className="mu-share" style={{ width: "100%", maxWidth: 860, display: "grid", gridTemplateColumns: "1fr 320px", background: "var(--ln-surface)", borderRadius: 22, border: "1px solid rgba(var(--ln-line-rgb),0.12)", boxShadow: "0 48px 100px -34px var(--ln-shadow)", overflow: "hidden", animation: "ln-pop 0.28s cubic-bezier(.16,1,.3,1) both" }}>

        {/* PREVIEW STAGE */}
        <div className="mu-share-stage" style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", padding: "34px 24px", borderRight: "1px solid rgba(var(--ln-fg-rgb),0.08)", background: "rgba(0,0,0,0.16)", minHeight: 420 }}>
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(60% 50% at 50% 36%, ${p.glow || acc}33, transparent 70%)`, pointerEvents: "none" }} />

          {format === "link" ? (
            <ShareLinkCard review={review} acc={acc} url={url} />
          ) : (
            <div style={{ position: "relative", width: frameW, borderRadius: 22, overflow: "hidden", boxShadow: "0 30px 70px -26px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06)" }}>
              {/* Album-color story flood */}
              <div style={{ position: "absolute", inset: 0, background: `radial-gradient(80% 60% at 50% 8%, ${p.mid || acc} 0%, ${p.deep || "#1a0d0e"} 56%, ${p.lo || "#0a0505"} 100%)` }} />
              <div style={{ position: "absolute", inset: 0, background: `radial-gradient(60% 40% at 84% 92%, ${acc}44, transparent 60%)` }} />
              <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 14px)", mixBlendMode: "overlay" }} />

              <div style={{ position: "relative", display: "flex", flexDirection: "column", padding: isStory ? "20px 18px 18px" : "16px 14px 14px", gap: isStory ? 14 : 12, minHeight: isStory ? 470 : 0, justifyContent: "flex-start" }}>
                {/* Brand mark */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <span style={{ fontFamily: "var(--ln-logo)", fontWeight: 800, fontSize: isStory ? 17 : 15, color: "#f4ecdd", letterSpacing: "-0.02em" }}>LinerNotes</span>
                </div>

                {/* Share sticker */}
                <ShareSticker review={review} acc={acc} compact={!isStory} />

                {/* Link-sticker zone (Story only) */}
                {isStory && <LinkSlot acc={acc} label={hasFull ? "Add your link sticker — taps reach the full note" : "Add your link sticker — taps open this note"} />}

                {isStory && <div style={{ flex: 1, minHeight: 4 }} />}

                {/* Footer: handle */}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <span style={{ fontFamily: "var(--ln-mono)", fontSize: 11, color: "rgba(244,236,221,0.72)", letterSpacing: "0.04em" }}>@{user?.handle || "user"}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CONTROLS */}
        <div style={{ padding: "22px 22px 24px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <span style={{ fontFamily: "var(--ln-display)", fontWeight: 700, fontSize: 20, color: "var(--ln-fg)" }}>Share this note</span>
            <button onClick={onClose} className="ln-press" style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(var(--ln-fg-rgb),0.14)", background: "rgba(var(--ln-fg-rgb),0.05)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="var(--ln-fg)" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>

          <div style={{ fontFamily: "var(--ln-label)", fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: "rgba(var(--ln-fg-rgb),0.5)", marginBottom: 9 }}>format</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {FORMATS.map((f) => {
              const sel = format === f.id;
              return (
                <button key={f.id} onClick={() => setFormat(f.id)} className="ln-press" style={{ flex: 1, padding: "11px 0", borderRadius: 12, cursor: "pointer", border: `1px solid ${sel ? acc : "rgba(var(--ln-fg-rgb),0.16)"}`, background: sel ? `${acc}1e` : "transparent", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <span style={{ fontFamily: "var(--ln-body)", fontSize: 13.5, fontWeight: 600, color: sel ? acc : "var(--ln-fg)" }}>{f.label}</span>
                  <span style={{ fontFamily: "var(--ln-mono)", fontSize: 9, letterSpacing: "0.06em", color: "rgba(var(--ln-fg-rgb),0.45)" }}>{f.sub}</span>
                </button>
              );
            })}
          </div>

          {/* Link row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(var(--ln-fg-rgb),0.14)", background: "rgba(var(--ln-fg-rgb),0.03)", marginBottom: 12 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 15l6-6M10 8h5a4 4 0 010 8h-2M14 16H9a4 4 0 010-8h2" stroke="rgba(var(--ln-fg-rgb),0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span style={{ flex: 1, fontFamily: "var(--ln-mono)", fontSize: 12, color: "rgba(var(--ln-fg-rgb),0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</span>
            <button onClick={copy} className="ln-press" style={{ flexShrink: 0, padding: "7px 13px", borderRadius: 999, border: "none", cursor: "pointer", background: copied ? "#1db954" : acc, color: copied ? "#fff" : "#2c1517", fontFamily: "var(--ln-body)", fontSize: 12.5, fontWeight: 700 }}>
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>

          {/* Primary action */}
          <button onClick={copy} className="ln-press" style={{ width: "100%", padding: "13px", borderRadius: 13, border: "none", cursor: "pointer", background: acc, color: "#2c1517", fontFamily: "var(--ln-body)", fontSize: 14.5, fontWeight: 700, boxShadow: `0 12px 28px -12px ${acc}`, marginBottom: 16 }}>
            {format === "link" ? "Copy link" : "Download image"}
          </button>

          <div style={{ fontFamily: "var(--ln-label)", fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: "rgba(var(--ln-fg-rgb),0.5)", marginBottom: 10 }}>share to</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
            {CHANNELS.map((ch) => (
              <button key={ch.id} onClick={copy} className="ln-press" style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 12px", borderRadius: 11, cursor: "pointer", border: "1px solid rgba(var(--ln-fg-rgb),0.14)", background: "rgba(var(--ln-fg-rgb),0.03)", color: "var(--ln-fg)" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: ch.c, flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--ln-body)", fontSize: 13, fontWeight: 600 }}>{ch.label}</span>
              </button>
            ))}
          </div>

          <p style={{ marginTop: "auto", paddingTop: 16, fontFamily: "var(--ln-mono)", fontSize: 9.5, lineHeight: 1.6, color: "rgba(var(--ln-fg-rgb),0.42)", letterSpacing: "0.02em" }}>
            The image bakes in the LinerNotes mark and @{user?.handle || "user"}. The link is pre-copied — drop it as a sticker so taps reach the full note.
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .mu-share { grid-template-columns: 1fr !important; max-width: 380px !important; }
          .mu-share-stage { border-right: none !important; border-bottom: 1px solid rgba(var(--ln-fg-rgb),0.08); }
        }
      `}</style>
    </div>
  );
}

// Link sticker drop zone
function LinkSlot({ acc, label }: { acc: string; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "12px 14px", borderRadius: 13, border: `1.5px dashed ${acc}99`, background: `${acc}12` }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
        <span style={{ width: 18, height: 18, borderRadius: 5, background: acc, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M9 15l6-6M10 8h5a4 4 0 010 8h-2M14 16H9a4 4 0 010-8h2" stroke="#2c1517" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <span style={{ fontFamily: "var(--ln-body)", fontSize: 12, fontWeight: 700, color: "#f4ecdd" }}>Link sticker</span>
      </div>
      <span style={{ fontFamily: "var(--ln-mono)", fontSize: 9, lineHeight: 1.4, color: "rgba(244,236,221,0.66)", letterSpacing: "0.02em", textAlign: "center" }}>{label}</span>
    </div>
  );
}

// Compact share sticker
function ShareSticker({ review, acc, compact }: { review: Review; acc: string; compact: boolean }) {
  const p = paletteFromString(review.track.trackId || review.track.album || review.track.name);
  const featured = review.notes && review.notes.length > 0
    ? { sec: review.notes[0].seconds, label: review.notes[0].label || "moment", note: review.notes[0].note }
    : null;

  return (
    <div style={{ width: "100%", borderRadius: 16, overflow: "hidden", background: "var(--ln-surface)", border: "1px solid rgba(var(--ln-line-rgb),0.1)", boxShadow: "0 18px 38px -20px rgba(0,0,0,0.55)" }}>
      <div style={{ position: "relative" }}>
        <LNArt palette={p} src={review.track.artworkUrl} radius={0} noTag />
        {review.rating && review.rating > 0 && (
          <div style={{ position: "absolute", top: 10, right: 10, padding: "5px 8px", borderRadius: 999, background: "rgba(8,7,6,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(var(--ln-line-rgb),0.1)" }}>
            <LNStars rating={review.rating} size={11} color="#e6b450" showNum={false} />
          </div>
        )}
      </div>
      <div style={{ padding: compact ? "11px 13px 13px" : "13px 14px 15px", display: "flex", flexDirection: "column", gap: compact ? 7 : 9 }}>
        <div>
          <div style={{ fontFamily: "var(--ln-album)", fontWeight: 600, fontSize: compact ? 17 : 19, color: "var(--ln-fg)", lineHeight: 1.12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {review.track.name}
          </div>
          <div style={{ fontFamily: "var(--ln-body)", fontSize: 12.5, color: "var(--ln-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {review.track.artist}
          </div>
        </div>
        {review.take && (
          <p style={{ margin: 0, fontFamily: "var(--ln-preview)", fontStyle: "italic", fontWeight: 500, fontSize: compact ? 14 : 15.5, lineHeight: 1.36, color: "var(--ln-fg)", display: "-webkit-box", WebkitLineClamp: compact ? 2 : 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {review.take}
          </p>
        )}
        {featured && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, borderRadius: 10, background: `${acc}16`, border: `1px solid ${acc}3a`, padding: compact ? "7px 9px" : "9px 11px" }}>
            <span style={{ fontFamily: "var(--ln-mono)", fontSize: 10.5, color: "#2c1517", background: "#e6b450", borderRadius: 5, padding: "1px 6px", fontWeight: 600, flexShrink: 0, marginTop: 1 }}>
              {lnFmt(featured.sec)}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "var(--ln-body)", fontSize: 12.5, fontWeight: 600, color: "var(--ln-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {featured.label}
              </div>
              {featured.note && (
                <div style={{ fontFamily: "var(--ln-body)", fontSize: compact ? 11.5 : 12.5, lineHeight: 1.4, color: "rgba(var(--ln-fg-rgb),0.7)", display: "-webkit-box", WebkitLineClamp: compact ? 1 : 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginTop: 1 }}>
                  {featured.note}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Link card preview
function ShareLinkCard({ review, acc, url }: { review: Review; acc: string; url: string }) {
  const p = paletteFromString(review.track.trackId || review.track.album || review.track.name);
  const user = review.user;

  return (
    <div style={{ width: 320, borderRadius: 16, overflow: "hidden", background: "var(--ln-surface)", border: "1px solid rgba(var(--ln-line-rgb),0.12)", boxShadow: "0 24px 50px -26px rgba(0,0,0,0.7)" }}>
      <div style={{ height: 150, position: "relative", background: `radial-gradient(110% 110% at 28% 18%, ${p.mid || acc}, ${p.deep || "#1a0d0e"} 60%, ${p.lo || "#0a0505"})` }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 13px)", mixBlendMode: "overlay" }} />
        <div style={{ position: "absolute", left: 14, top: 13, fontFamily: "var(--ln-logo)", fontWeight: 800, fontSize: 15, color: "#f4ecdd", letterSpacing: "-0.02em" }}>LinerNotes</div>
        {review.rating && review.rating > 0 && (
          <div style={{ position: "absolute", right: 12, top: 12, padding: "5px 8px", borderRadius: 999, background: "rgba(8,6,7,0.55)", backdropFilter: "blur(6px)" }}>
            <LNStars rating={review.rating} size={11} color="#e6b450" showNum={false} />
          </div>
        )}
      </div>
      <div style={{ padding: "13px 15px 15px" }}>
        <div style={{ fontFamily: "var(--ln-album)", fontWeight: 600, fontSize: 18, color: "var(--ln-fg)", lineHeight: 1.12 }}>{review.track.name}</div>
        <div style={{ fontFamily: "var(--ln-body)", fontSize: 13, color: "var(--ln-muted)", marginTop: 1 }}>{review.track.artist}</div>
        {review.take && (
          <p style={{ margin: "9px 0 0", fontFamily: "var(--ln-preview)", fontStyle: "italic", fontSize: 14, lineHeight: 1.4, color: "rgba(var(--ln-fg-rgb),0.82)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {review.take}
          </p>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 11, borderTop: "1px solid rgba(var(--ln-fg-rgb),0.08)" }}>
          <span style={{ fontFamily: "var(--ln-mono)", fontSize: 11, color: "var(--ln-muted)" }}>@{user?.handle || "user"}</span>
          <span style={{ fontFamily: "var(--ln-mono)", fontSize: 10.5, color: acc }}>{url}</span>
        </div>
      </div>
    </div>
  );
}
