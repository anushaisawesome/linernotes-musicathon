"use client";

/**
 * Musicathon Share Modal - Profile / Top-4 Share
 * Condensed profile card (avatar, bio, stats, top albums) baked onto a tint canvas.
 * Format toggle (Story / Square / Link), copy-link + share-to chips.
 * Ported from mu-share.jsx → MUShareProfile.
 */

import { useEffect, useState } from "react";
import { LNArt, LNIcon } from "@/components/ln/atoms";
import { paletteFromString } from "@/lib/palette";

export type ProfileShareTile = {
  musicId: string;
  title: string;
  artworkUrl?: string | null;
};

interface ProfileShareModalProps {
  user: { handle: string; displayName: string; avatarUrl?: string | null; bio?: string | null };
  top4: ProfileShareTile[];
  reviewCount: number;
  moments: number;
  friends: number;
  accent?: string;
  onClose: () => void;
}

export function ProfileShareModal({ user, top4, reviewCount, moments, friends, accent: accentProp, onClose }: ProfileShareModalProps) {
  const acc = accentProp || "#d5896f";
  const tint = accentProp || acc;
  const favs = (top4 || []).slice(0, 4);
  const name = user.displayName || user.handle || "User";
  const [format, setFormat] = useState<"story" | "square" | "link">("link");
  const [copied, setCopied] = useState(false);
  const url = `linernotes.app/@${user.handle}`;

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
  const stats: [number, string][] = [[reviewCount, "notes"], [moments, "moments"], [friends, "friends"]];

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 350, background: "rgba(6,4,4,0.72)", backdropFilter: "blur(7px)", WebkitBackdropFilter: "blur(7px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "56px 20px 40px", overflowY: "auto", animation: "ln-fade 0.2s ease both" }}>
      <div onClick={(e) => e.stopPropagation()} className="mu-share" style={{ width: "100%", maxWidth: 860, display: "grid", gridTemplateColumns: "1fr 320px", background: "var(--ln-surface)", borderRadius: 22, border: "1px solid rgba(var(--ln-line-rgb),0.12)", boxShadow: "0 48px 100px -34px var(--ln-shadow)", overflow: "hidden", animation: "ln-pop 0.28s cubic-bezier(.16,1,.3,1) both" }}>

        {/* PREVIEW STAGE */}
        <div className="mu-share-stage" style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", padding: "34px 24px", borderRight: "1px solid rgba(var(--ln-fg-rgb),0.08)", background: "rgba(0,0,0,0.16)", minHeight: 420 }}>
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(60% 50% at 50% 36%, ${tint}33, transparent 70%)`, pointerEvents: "none" }} />

          {format === "link" ? (
            <div style={{ width: 320, borderRadius: 16, overflow: "hidden", background: "var(--ln-surface)", border: "1px solid rgba(var(--ln-line-rgb),0.12)", boxShadow: "0 24px 50px -26px rgba(0,0,0,0.7)" }}>
              <div style={{ height: 110, position: "relative", background: `radial-gradient(110% 120% at 26% 10%, ${tint}, ${tint}66 60%, ${tint}22)` }}>
                <div style={{ position: "absolute", left: 14, top: 13, fontFamily: "var(--ln-logo)", fontWeight: 800, fontSize: 15, color: "#f4ecdd", letterSpacing: "-0.02em" }}>LinerNotes</div>
              </div>
              <div style={{ padding: "13px 15px 15px" }}>
                <div style={{ fontFamily: "var(--ln-display)", fontWeight: 700, fontSize: 19, color: "var(--ln-fg)" }}>{name}</div>
                <div style={{ fontFamily: "var(--ln-mono)", fontSize: 12, color: "var(--ln-muted)", marginTop: 1 }}>@{user.handle}</div>
                {user.bio && <p style={{ margin: "9px 0 0", fontFamily: "var(--ln-body)", fontSize: 13, lineHeight: 1.4, color: "rgba(var(--ln-fg-rgb),0.78)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{user.bio}</p>}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 11, borderTop: "1px solid rgba(var(--ln-fg-rgb),0.08)" }}>
                  <span style={{ fontFamily: "var(--ln-mono)", fontSize: 11, color: "var(--ln-muted)" }}>{reviewCount} notes · {friends} friends</span>
                  <span style={{ fontFamily: "var(--ln-mono)", fontSize: 10.5, color: acc }}>{url}</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ position: "relative", width: frameW, borderRadius: 22, overflow: "hidden", boxShadow: "0 30px 70px -26px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06)" }}>
              <div style={{ position: "absolute", inset: 0, background: `radial-gradient(80% 60% at 50% 6%, ${tint}cc 0%, ${tint}55 40%, #1a0d0e 100%)` }} />
              <div style={{ position: "absolute", inset: 0, background: `radial-gradient(60% 40% at 84% 92%, ${acc}44, transparent 60%)` }} />
              <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 14px)", mixBlendMode: "overlay" }} />

              <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", padding: isStory ? "22px 18px 20px" : "18px 14px 16px", gap: isStory ? 14 : 11, minHeight: isStory ? 470 : 0 }}>
                <span style={{ fontFamily: "var(--ln-logo)", fontWeight: 800, fontSize: isStory ? 16 : 14, color: "#f4ecdd", letterSpacing: "-0.02em" }}>LinerNotes</span>

                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt={name} style={{ width: isStory ? 84 : 70, height: isStory ? 84 : 70, borderRadius: "50%", objectFit: "cover", border: `2px solid ${tint}`, marginTop: isStory ? 8 : 2 }} />
                ) : (
                  <div style={{ width: isStory ? 84 : 70, height: isStory ? 84 : 70, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: `${tint}33`, border: `2px solid ${tint}`, color: "#f4ecdd", fontFamily: "var(--ln-display)", fontWeight: 600, fontSize: isStory ? 36 : 30, marginTop: isStory ? 8 : 2 }}>{name[0]?.toUpperCase()}</div>
                )}

                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--ln-display)", fontWeight: 700, fontSize: isStory ? 24 : 20, color: "#f4ecdd", lineHeight: 1.1 }}>{name}</div>
                  <div style={{ fontFamily: "var(--ln-mono)", fontSize: 11.5, color: "rgba(244,236,221,0.66)", marginTop: 3 }}>@{user.handle}</div>
                </div>

                {user.bio && (
                  <p style={{ margin: 0, maxWidth: 230, textAlign: "center", fontFamily: "var(--ln-preview)", fontStyle: "italic", fontSize: isStory ? 14.5 : 13, lineHeight: 1.4, color: "rgba(244,236,221,0.9)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{user.bio}</p>
                )}

                {/* stats */}
                <div style={{ display: "flex", gap: 0, width: "100%", maxWidth: 240, padding: "10px 0", borderTop: "1px solid rgba(244,236,221,0.16)", borderBottom: "1px solid rgba(244,236,221,0.16)" }}>
                  {stats.map(([n, label], i) => (
                    <div key={label} style={{ flex: 1, textAlign: "center", borderLeft: i ? "1px solid rgba(244,236,221,0.12)" : "none" }}>
                      <div style={{ fontFamily: "var(--ln-display)", fontWeight: 600, fontSize: 17, color: "#f4ecdd" }}>{n}</div>
                      <div style={{ fontFamily: "var(--ln-label)", fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(244,236,221,0.55)", marginTop: 2 }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* favourites strip */}
                {favs.length > 0 && (
                  <div style={{ width: "100%" }}>
                    <div style={{ fontFamily: "var(--ln-label)", fontSize: 8.5, letterSpacing: "0.14em", textTransform: "uppercase", color: acc, textAlign: "center", marginBottom: 7 }}>top albums</div>
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${favs.length}, 1fr)`, gap: 6 }}>
                      {favs.map((e, i) => (
                        <div key={i} style={{ aspectRatio: "1/1", borderRadius: 7, overflow: "hidden", boxShadow: "0 6px 14px -8px rgba(0,0,0,0.7)" }}>
                          <LNArt palette={paletteFromString(e.musicId || e.title)} src={e.artworkUrl} label="" radius={7} noTag />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isStory && <div style={{ flex: 1 }} />}
                <span style={{ fontFamily: "var(--ln-mono)", fontSize: 10, color: "rgba(244,236,221,0.6)", letterSpacing: "0.04em" }}>{url}</span>
              </div>
            </div>
          )}
        </div>

        {/* CONTROLS */}
        <div style={{ padding: "22px 22px 24px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <span style={{ fontFamily: "var(--ln-display)", fontWeight: 700, fontSize: 20, color: "var(--ln-fg)" }}>Share your profile</span>
            <button onClick={onClose} className="ln-press" style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(var(--ln-fg-rgb),0.14)", background: "rgba(var(--ln-fg-rgb),0.05)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
              <LNIcon name="close" size={16} color="var(--ln-fg)" />
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

          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(var(--ln-fg-rgb),0.14)", background: "rgba(var(--ln-fg-rgb),0.03)", marginBottom: 12 }}>
            <LNIcon name="save" size={15} color="rgba(var(--ln-fg-rgb),0.5)" />
            <span style={{ flex: 1, fontFamily: "var(--ln-mono)", fontSize: 12, color: "rgba(var(--ln-fg-rgb),0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</span>
            <button onClick={copy} className="ln-press" style={{ flexShrink: 0, padding: "7px 13px", borderRadius: 999, border: "none", cursor: "pointer", background: copied ? "#1db954" : acc, color: copied ? "#fff" : "#2c1517", fontFamily: "var(--ln-body)", fontSize: 12.5, fontWeight: 700 }}>{copied ? "Copied ✓" : "Copy"}</button>
          </div>

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
            A condensed overview — your avatar, bio, stats and top albums — with your @{user.handle} link baked in.
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
