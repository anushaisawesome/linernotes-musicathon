"use client";

// Editorial review cards — the three-depth feed card (landscape, reflowing to tall),
// the vertical card (profile grid), the per-track strip, and the action row. All
// consume the ReviewVM produced by view-adapter.ts.

import { useState, useEffect, useRef, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { LNArt, LNStars, LNReact, LNIcon, LNAvatar, LNMoment, lnRel } from "./atoms";
import type { ReviewVM, AlbumVM, MomentVM } from "@/lib/view-adapter";
import type { Palette } from "@/lib/palette";

const GOLD = "var(--ln-accent)";

function momentCount(album: AlbumVM): number {
  return (album.tracks || []).reduce((a, t) => a + (t.moments?.length || 0), 0);
}

function featuredMoment(vm: ReviewVM): MomentVM | null {
  if (vm.notes && vm.notes.length) return vm.notes[0];
  for (const t of vm.album.tracks || []) {
    if (t.moments && t.moments.length) return { ...t.moments[0], label: t.moments[0].label || t.name };
  }
  return null;
}

export function LNWCardStrip({ album, gold = GOLD, bare = false, limit }: { album: AlbumVM; gold?: string; bare?: boolean; limit?: number }) {
  const total = momentCount(album);
  const shown = typeof limit === "number" ? album.tracks.slice(0, limit) : album.tracks;
  const hidden = album.tracks.length - shown.length;
  const heading: string | null = null; // no "the ones that stuck" header
  const showHeader = !!heading; // moment count moved to the bottom row
  return (
    <div style={{ borderRadius: bare ? 0 : 12, border: bare ? "none" : "1px solid rgba(var(--ln-fg-rgb),0.09)", overflow: "hidden", background: bare ? "transparent" : "rgba(var(--ln-fg-rgb),0.02)" }}>
      {showHeader && (
        <div style={{ padding: "9px 13px", borderBottom: "1px solid rgba(var(--ln-fg-rgb),0.07)" }}>
          <span style={{ fontFamily: "var(--ln-mono)", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(var(--ln-fg-rgb),0.5)" }}>{heading}</span>
        </div>
      )}
      {shown.map((t) => {
        const mc = t.moments?.length || 0;
        return (
          <div key={t.n} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 13px", borderBottom: "1px solid rgba(var(--ln-fg-rgb),0.05)" }}>
            <span style={{ fontFamily: "var(--ln-mono)", fontSize: 10.5, color: "rgba(var(--ln-fg-rgb),0.38)", width: 16 }}>{String(t.n).padStart(2, "0")}</span>
            <span style={{ flex: 1, fontFamily: "var(--ln-body)", fontSize: 14, color: t.reaction ? "var(--ln-fg)" : "rgba(var(--ln-fg-rgb),0.55)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
            {mc > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontFamily: "var(--ln-mono)", fontSize: 10, color: gold, background: `${gold}16`, borderRadius: 999, padding: "2px 7px" }}>
                <LNIcon name="save" size={10} color={gold} />
                {mc}
              </span>
            )}
            {t.reaction ? <LNReact kind={t.reaction} size={16} /> : <span style={{ width: 16, height: 16, borderRadius: "50%", border: "1.5px dashed rgba(var(--ln-fg-rgb),0.18)" }} />}
          </div>
        );
      })}
      {(hidden > 0 || total > 0) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 13px" }}>
          <span style={{ fontFamily: "var(--ln-mono)", fontSize: 10, letterSpacing: "0.04em", color: "rgba(var(--ln-fg-rgb),0.45)" }}>{hidden > 0 ? `+${hidden} more track${hidden > 1 ? "s" : ""}` : ""}</span>
          {total > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "var(--ln-mono)", fontSize: 10, color: gold }}>
              <LNIcon name="save" size={11} color={gold} />
              {`${total} moment${total > 1 ? "s" : ""}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function LNWActionBtn({
  onClick,
  active,
  activeColor,
  icon,
  count,
}: {
  onClick: (e: MouseEvent) => void;
  active?: boolean;
  activeColor: string;
  icon: "repost" | "save" | "like";
  count?: number;
}) {
  const [hover, setHover] = useState(false);
  const color = active ? activeColor : hover ? "var(--ln-fg)" : "rgba(var(--ln-fg-rgb),0.62)";
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 10, background: hover ? "rgba(var(--ln-fg-rgb),0.05)" : "transparent", border: "none", cursor: "pointer", color, fontFamily: "var(--ln-mono)", fontSize: 12.5, transition: "color 0.15s, background 0.15s" }}
    >
      <LNIcon name={icon} size={20} filled={active} color={color} />
      {typeof count === "number" && <span style={{ minWidth: 12, textAlign: "left" }}>{count}</span>}
    </button>
  );
}

function LNWFeedArt({ album, gold, rating, onPaletteExtracted }: { album: AlbumVM; gold: string; rating: number; onPaletteExtracted?: (palette: Palette) => void }) {
  const isPlaylist = album.kind === "playlist";
  return (
    <div className="lnw-fcard-art" style={{ width: 192, flexShrink: 0, display: "flex", flexDirection: "column", background: "rgba(var(--ln-fg-rgb),0.02)" }}>
      <div className="lnw-fcard-cover" style={{ position: "relative" }}>
        <LNArt palette={album.palette} src={album.artworkUrl} label={album.title} dim onPaletteExtracted={onPaletteExtracted} />
      </div>
      <div className="lnw-fcard-rating" style={{ padding: "13px 15px 10px", display: "flex", alignItems: "center", gap: 8 }}>
        {isPlaylist ? (
          <span style={{ fontFamily: "var(--ln-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: gold }}>curated set</span>
        ) : rating > 0 ? (
          <LNStars rating={rating} size={18} color={gold} showNum />
        ) : (
          <span style={{ fontFamily: "var(--ln-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(var(--ln-fg-rgb),0.4)" }}>unrated</span>
        )}
      </div>
    </div>
  );
}

// Landscape feed card — art left, the take in the middle, the album's tracks on the side.
export function LNWFeedCard({ vm, accent = GOLD, onOpen }: { vm: ReviewVM; accent?: string; onOpen?: () => void }) {
  const { album } = vm;
  const [palette, setPalette] = useState<Palette>(album.palette);
  const p = palette;
  const gold = accent;
  const [hover, setHover] = useState(false);
  const isAlbum = album.kind === "album" && album.tracks.length > 0;
  const hasTracks = isAlbum || album.kind === "playlist";
  const badgeLabel = album.kind === "playlist" ? "playlist" : isAlbum ? "album review" : null;
  const fm = featuredMoment(vm);
  const hasMore = !!vm.body || (!!vm.take && vm.take.trim().includes("\n")) || (hasTracks && album.tracks.length > 5);

  return (
    <article
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="lnw-fcard ln-card-hover"
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "row",
        borderRadius: 18,
        overflow: "hidden",
        cursor: onOpen ? "pointer" : "default",
        background: "var(--ln-surface)",
        border: `1px solid rgba(var(--ln-line-rgb),${hover ? 0.16 : 0.08})`,
        boxShadow: hover
          ? "0 1px 2px rgba(var(--ln-line-rgb),0.05), 0 26px 56px -26px var(--ln-shadow)"
          : "0 1px 2px rgba(var(--ln-line-rgb),0.05), 0 16px 38px -22px var(--ln-shadow)",
        transform: hover && onOpen ? "translateY(-3px)" : "none",
      }}
    >
      <LNWFeedArt album={album} gold={gold} rating={vm.rating} onPaletteExtracted={setPalette} />

      <div className="lnw-fcard-main" style={{ position: "relative", flex: 1, minWidth: 0, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12, justifyContent: "center" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 80, background: `linear-gradient(${p.accent}14, transparent 80%)`, pointerEvents: "none" }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 3 }}>
          {badgeLabel && <span style={{ fontFamily: "var(--ln-mono)", fontSize: 9.5, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(var(--ln-fg-rgb),0.5)" }}>{badgeLabel}</span>}
          <h3 style={{ margin: 0, fontFamily: "var(--ln-album)", fontWeight: 600, fontSize: 23, lineHeight: 1.1, color: "var(--ln-fg)", letterSpacing: "-0.01em" }}>{album.title}</h3>
          <span style={{ fontFamily: "var(--ln-body)", fontSize: 14, color: "var(--ln-muted)" }}>{album.artist}{album.year ? ` · ${album.year}` : ""}</span>
        </div>

        {vm.take && <p style={{ position: "relative", margin: 0, fontFamily: "var(--ln-preview)", fontStyle: "italic", fontWeight: 500, fontSize: 16.5, lineHeight: 1.38, color: "var(--ln-fg)" }}>{vm.take.split("\n")[0]}</p>}

        {fm && (
          <div style={{ position: "relative" }}>
            <LNMoment note={fm} accent={gold} />
          </div>
        )}

        {hasMore && (
          <div style={{ position: "relative", marginTop: 2, display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start", fontFamily: "var(--ln-body)", fontSize: 12.5, fontWeight: 600, color: gold }}>
            Tap to view full review
            <span style={{ fontSize: 14, lineHeight: 1, transform: hover ? "translateX(3px)" : "none", transition: "transform 0.18s" }}>→</span>
          </div>
        )}
      </div>

      {hasTracks && (
        <div className="lnw-fcard-tracks" style={{ width: 280, flexShrink: 0, borderLeft: "1px solid rgba(var(--ln-fg-rgb),0.08)", alignSelf: "stretch", background: "rgba(var(--ln-fg-rgb),0.015)" }}>
          <LNWCardStrip album={album} gold={gold} bare limit={5} />
        </div>
      )}
    </article>
  );
}

// Vertical card (profile grids / compact lists).
export function LNWCard({ vm, accent = GOLD, onOpen, showCounts = false, repostedBadge = false, onToggleSave, onToggleRepost }: { vm: ReviewVM; accent?: string; onOpen?: () => void; showCounts?: boolean; repostedBadge?: boolean; onToggleSave?: () => void; onToggleRepost?: () => void }) {
  const { album } = vm;
  const [palette, setPalette] = useState<Palette>(album.palette);
  const p = palette;
  const gold = accent;
  const [hover, setHover] = useState(false);
  const isAlbum = album.kind === "album" && album.tracks.length > 0;
  const badgeLabel = album.kind === "playlist" ? "playlist" : isAlbum ? "album review" : null;
  const fm = featuredMoment(vm);
  const depth = !vm.take ? "floor" : vm.body ? "full" : "caption";
  const showPill = vm.rating > 0 && album.kind !== "playlist";
  // Uniform card size: the body is clipped to a fixed height; if the review
  // overflows it, surface a "Tap to view full review" hint.
  const bodyRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const el = bodyRef.current;
    if (el) setOverflowing(el.scrollHeight > el.clientHeight + 4);
  }, [vm]);
  // The card only renders the first line of the take, so also flag "more" when
  // there's a full body or a multi-line take that the card can't show inline.
  const hasMore = overflowing || !!vm.body || (!!vm.take && vm.take.trim().includes("\n"));

  return (
    <article
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="ln-card-hover"
      style={{
        position: "relative",
        borderRadius: 18,
        overflow: "hidden",
        cursor: onOpen ? "pointer" : "default",
        background: "var(--ln-surface)",
        border: `1px solid rgba(var(--ln-line-rgb),${hover ? 0.24 : 0.14})`,
        boxShadow: hover
          ? "0 18px 34px -10px rgba(0,0,0,0.62), 0 4px 10px rgba(0,0,0,0.3)"
          : "0 12px 26px -8px rgba(0,0,0,0.5), 0 3px 8px rgba(0,0,0,0.26)",
        transform: hover && onOpen ? "translateY(-3px)" : "none",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "60%", background: `linear-gradient(${p.accent}${depth === "full" ? "20" : depth === "caption" ? "16" : "12"}, transparent 75%)`, pointerEvents: "none" }} />

      <LNArt palette={p} src={album.artworkUrl} label={album.title} dim onPaletteExtracted={setPalette}>
        {showPill && (
          <div style={{ position: "absolute", top: 13, right: 13, padding: "6px 9px", borderRadius: 999, background: "rgba(8,7,6,0.55)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", border: "1px solid rgba(var(--ln-line-rgb),0.1)" }}>
            <LNStars rating={vm.rating} size={12} color={gold} />
          </div>
        )}
        {badgeLabel && (
          <div style={{ position: "absolute", top: 13, left: 13, padding: "5px 9px", borderRadius: 999, background: "rgba(8,7,6,0.5)", backdropFilter: "blur(8px)", border: "1px solid rgba(var(--ln-line-rgb),0.1)", fontFamily: "var(--ln-mono)", fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "#f1ebe0" }}>{badgeLabel}</div>
        )}
        {repostedBadge && (
          <div style={{ position: "absolute", bottom: 12, left: 12, display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: gold, border: "none", fontFamily: "var(--ln-mono)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#2c1517", boxShadow: "0 8px 20px -8px rgba(0,0,0,0.6)" }}>
            <LNIcon name="repost" size={13} color="#2c1517" /> reposted
          </div>
        )}
      </LNArt>

      <div style={{ position: "relative", padding: "18px 19px 16px", display: "flex", flexDirection: "column", gap: 12, height: 224, boxSizing: "border-box" }}>
        <div ref={bodyRef} style={{ position: "relative", flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: 13 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <h3 style={{ margin: 0, fontFamily: "var(--ln-album)", fontWeight: 600, fontSize: 23, lineHeight: 1.12, color: "var(--ln-fg)", letterSpacing: "-0.01em" }}>{album.title}</h3>
            <span style={{ fontFamily: "var(--ln-body)", fontSize: 14, color: "var(--ln-muted)" }}>{album.artist}</span>
          </div>

          {vm.take && <p style={{ margin: 0, fontFamily: "var(--ln-preview)", fontStyle: "italic", fontWeight: 500, fontSize: 16, lineHeight: 1.4, color: "var(--ln-fg)" }}>{vm.take.split("\n")[0]}</p>}

          {depth === "floor" && album.kind !== "playlist" && vm.rating > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 1 }}>
              <LNStars rating={vm.rating} size={18} color={gold} showNum={false} />
              <span style={{ fontFamily: "var(--ln-mono)", fontSize: 15, color: gold, letterSpacing: "-0.02em" }}>{vm.rating.toFixed(1)}</span>
              <span style={{ fontFamily: "var(--ln-mono)", fontSize: 10, letterSpacing: "0.08em", color: "rgba(var(--ln-fg-rgb),0.38)", textTransform: "uppercase", marginLeft: 2 }}>rated</span>
            </div>
          )}

          {fm && (
            <div style={{ paddingTop: 1 }}>
              <LNMoment note={fm} accent={gold} />
            </div>
          )}

          {(isAlbum || album.kind === "playlist") && <LNWCardStrip album={album} gold={gold} limit={2} />}

          {overflowing && (
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 44, background: "linear-gradient(transparent, var(--ln-surface))", pointerEvents: "none" }} />
          )}
        </div>

        {hasMore && (
          <div style={{ fontFamily: "var(--ln-body)", fontSize: 12.5, fontWeight: 600, color: gold }}>Tap to view full review →</div>
        )}

        {(showCounts || onToggleSave || onToggleRepost) && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 12, borderTop: "1px solid rgba(var(--ln-fg-rgb),0.08)" }}>
            {showCounts ? (
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                {([["like", vm.likeCount], ["repost", vm.repostCount], ["save", vm.saveCount ?? 0]] as const).map(([icon, n]) => (
                  <span key={icon} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--ln-mono)", fontSize: 12.5, color: "rgba(var(--ln-fg-rgb),0.6)" }}>
                    <LNIcon name={icon} size={17} color="rgba(var(--ln-fg-rgb),0.6)" />
                    {n}
                  </span>
                ))}
              </div>
            ) : <span />}
            {onToggleRepost && (
              <button onClick={(e) => { e.stopPropagation(); onToggleRepost(); }} className="ln-press" style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, cursor: "pointer", background: `${gold}1a`, border: `1px solid ${gold}55`, color: gold, fontFamily: "var(--ln-body)", fontSize: 12, fontWeight: 600 }}>
                <LNIcon name="repost" size={14} color={gold} /> Unrepost
              </button>
            )}
            {onToggleSave && (
              <button onClick={(e) => { e.stopPropagation(); onToggleSave(); }} className="ln-press" style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, cursor: "pointer", background: `${gold}1a`, border: `1px solid ${gold}55`, color: gold, fontFamily: "var(--ln-body)", fontSize: 12, fontWeight: 600 }}>
                <LNIcon name="save" size={14} filled color={gold} /> Unsave
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

// Poster row + card + the three independent actions (repost / save / like).
export function FeedItem({
  vm,
  accent = GOLD,
  onOpenProfile,
  onLike,
  onRepost,
  onSave,
}: {
  vm: ReviewVM;
  accent?: string;
  onOpenProfile?: (handle: string) => void;
  onLike?: () => void;
  onRepost?: () => void;
  onSave?: () => void;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  // You can't repost/save/like your own review.
  const isOwn = !!session?.user?.handle && session.user.handle === vm.user.handle;
  const gold = accent;
  const [like, setLike] = useState({ on: !!vm.likedByMe, n: vm.likeCount });
  const [save, setSave] = useState(!!vm.saved);
  const [repost, setRepost] = useState({ on: !!vm.repostedByMe, n: vm.repostCount });
  const [loading, setLoading] = useState({ like: false, repost: false, save: false });

  // Re-sync with fresh server data when the feed refetches. The card key is stable
  // (`kind-id`), so React reuses this instance across refetches — without this the
  // initial useState would keep showing stale like/repost/save state (e.g. a like
  // saved on another page wouldn't appear when you return).
  useEffect(() => { setLike({ on: !!vm.likedByMe, n: vm.likeCount }); }, [vm.id, vm.likedByMe, vm.likeCount]);
  useEffect(() => { setRepost({ on: !!vm.repostedByMe, n: vm.repostCount }); }, [vm.id, vm.repostedByMe, vm.repostCount]);
  useEffect(() => { setSave(!!vm.saved); }, [vm.id, vm.saved]);

  const stop = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };
  const goProfile = (e: MouseEvent) => {
    e.stopPropagation();
    if (onOpenProfile) onOpenProfile(vm.user.handle);
    else router.push(`/profile/${vm.user.handle}`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 3px" }}>
        <button onClick={goProfile} className="ln-press" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", borderRadius: "50%" }}>
          <LNAvatar user={vm.user} size={34} />
        </button>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25, flex: 1, minWidth: 0 }}>
          <button onClick={goProfile} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: "var(--ln-body)", fontSize: 14, color: "var(--ln-fg)", fontWeight: 600, width: "fit-content" }}>{vm.user.name}</button>
          <span style={{ fontFamily: "var(--ln-mono)", fontSize: 11, color: "rgba(var(--ln-fg-rgb),0.45)", letterSpacing: "0.02em" }}>@{vm.user.handle}{vm.at ? ` · ${lnRel(vm.at)}` : ""}</span>
          {vm.via && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 3, fontFamily: "var(--ln-mono)", fontSize: 9.5, letterSpacing: "0.03em", color: "rgba(var(--ln-fg-rgb),0.5)" }}>
              <LNIcon name="repost" size={11} color="rgba(var(--ln-fg-rgb),0.42)" /> via {vm.via.name}
            </span>
          )}
        </div>
      </div>

      <LNWFeedCard vm={vm} accent={gold} onOpen={() => router.push(vm.href)} />

      {!isOwn && (
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 4px" }}>
        <LNWActionBtn
          onClick={stop(async () => {
            if (loading.repost) return;
            setLoading((l) => ({ ...l, repost: true }));

            const wasReposted = repost.on;
            setRepost((s) => ({ on: !s.on, n: s.n + (s.on ? -1 : 1) }));

            try {
              await onRepost?.();
            } catch (error) {
              // Revert on error
              setRepost({ on: wasReposted, n: repost.n + (wasReposted ? 1 : -1) });
            } finally {
              setLoading((l) => ({ ...l, repost: false }));
            }
          })}
          active={repost.on}
          activeColor="#d98aa0"
          icon="repost"
          count={repost.n}
        />
        <LNWActionBtn
          onClick={stop(async () => {
            if (loading.save) return;
            setLoading((l) => ({ ...l, save: true }));

            const wasSaved = save;
            setSave((s) => !s);

            try {
              await onSave?.();
            } catch (error) {
              // Revert on error
              setSave(wasSaved);
            } finally {
              setLoading((l) => ({ ...l, save: false }));
            }
          })}
          active={save}
          activeColor="#c8a45c"
          icon="save"
        />
        <div style={{ flex: 1 }} />
        <LNWActionBtn
          onClick={stop(async () => {
            if (loading.like) return;
            setLoading((l) => ({ ...l, like: true }));

            const wasLiked = like.on;
            setLike((s) => ({ on: !s.on, n: s.n + (s.on ? -1 : 1) }));

            try {
              await onLike?.();
            } catch (error) {
              // Revert on error
              setLike({ on: wasLiked, n: like.n + (wasLiked ? 1 : -1) });
            } finally {
              setLoading((l) => ({ ...l, like: false }));
            }
          })}
          active={like.on}
          activeColor="#e0762f"
          icon="like"
          count={like.n}
        />
      </div>
      )}
    </div>
  );
}
