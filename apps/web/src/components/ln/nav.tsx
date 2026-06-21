"use client";

// Editorial top bar + footer. The bar is the funnel: browsing is open; signed-out
// users get "Log in" (quiet) + "Join the beta" (gold); signed-in users get a compose
// button + their profile. On immersive review pages the bar rides over the flood.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { LNIcon } from "./atoms";

export function TopBar({ transparent = false }: { transparent?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [friendNotif, setFriendNotif] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  const handle = session?.user?.handle;

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 8);
    h();
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  // Friends notification dot: lights up when there's a new incoming request or a
  // newly-accepted friend since you last opened the Friends page. Visiting
  // /friends marks the current state as seen.
  useEffect(() => {
    if (!session) { setFriendNotif(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const [fRes, rRes] = await Promise.all([
          fetch("/api/friends", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { friends: [] })),
          fetch("/api/friends?type=requests", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { requests: [] })),
        ]);
        if (cancelled) return;
        const friends = (fRes.friends || []).length;
        const incoming = (rRes.requests || []).length;
        const stored = typeof window !== "undefined" ? localStorage.getItem("ln_friends_seen") : null;
        const markSeen = () => { try { localStorage.setItem("ln_friends_seen", JSON.stringify({ friends, incoming })); } catch { /* ignore */ } };
        if (pathname === "/friends" || !stored) {
          // First load establishes a baseline; opening /friends clears the dot.
          markSeen();
          setFriendNotif(false);
        } else {
          let seen = { friends: 0, incoming: 0 };
          try { seen = JSON.parse(stored); } catch { /* ignore */ }
          setFriendNotif(incoming > seen.incoming || friends > seen.friends);
        }
      } catch { /* best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [session, pathname]);

  const accent = "var(--ln-accent)";
  const onFlood = transparent && !scrolled;
  const ink = transparent ? "#f1ebe0" : "var(--ln-fg)";
  const muted = transparent ? "rgba(241,235,224,0.62)" : "rgba(var(--ln-fg-rgb),0.6)";

  const bg = onFlood
    ? "linear-gradient(180deg, rgba(6,5,5,0.5) 0%, rgba(6,5,5,0) 100%)"
    : transparent
      ? "rgba(10,8,7,0.72)"
      : "rgba(var(--ln-surface-rgb),0.72)";

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        backdropFilter: onFlood ? "none" : "blur(18px) saturate(140%)",
        WebkitBackdropFilter: onFlood ? "none" : "blur(18px) saturate(140%)",
        background: bg,
        borderBottom: onFlood
          ? "1px solid transparent"
          : `1px solid rgba(${transparent ? "255,255,255" : "var(--ln-line-rgb)"},0.09)`,
        transition: "background 0.3s, border-color 0.3s, backdrop-filter 0.3s",
      }}
    >
      <div
        style={{ maxWidth: 1180, margin: "0 auto", height: 64, padding: "0 24px", display: "flex", alignItems: "center", gap: 26 }}
        className="lnw-nav-inner"
      >
        <Link href="/" className="ln-press" style={{ display: "inline-flex", alignItems: "baseline", gap: 7, textDecoration: "none" }}>
          <span style={{ fontFamily: "var(--ln-logo)", fontWeight: 800, fontSize: 21, color: ink, letterSpacing: "-0.02em", lineHeight: 1 }}>LinerNotes</span>
        </Link>

        <nav className="lnw-nav-links" style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <NavLink label="Home" href="/" active={pathname === "/"} ink={ink} muted={muted} accent={accent} />
          <NavLink label="Community Feed" href="/feed" active={pathname === "/feed"} ink={ink} muted={muted} accent={accent} />
        </nav>

        <div style={{ flex: 1 }} />

        <Link
          href="/log"
          className="ln-press lnw-nav-compose"
          title="Log a note"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "8px 13px",
            borderRadius: 999,
            textDecoration: "none",
            border: `1px solid ${transparent ? "rgba(241,235,224,0.22)" : "rgba(var(--ln-fg-rgb),0.18)"}`,
            background: transparent ? "rgba(241,235,224,0.06)" : "rgba(var(--ln-fg-rgb),0.04)",
            color: ink,
            fontFamily: "var(--ln-body)",
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          <LNIcon name="edit" size={15} color={ink} />
          Log a note
        </Link>

        {session ? (
          <>
            <Link
              href="/friends"
              className="ln-press lnw-nav-login"
              style={{ position: "relative", color: pathname === "/friends" ? ink : muted, textDecoration: "none", fontFamily: "var(--ln-body)", fontSize: 13.5, fontWeight: 600, padding: "6px 4px", whiteSpace: "nowrap" }}
            >
              Friends
              {friendNotif && (
                <span title="New friends activity" style={{ position: "absolute", top: 2, right: -5, width: 8, height: 8, borderRadius: "50%", background: "var(--ln-star)", boxShadow: `0 0 0 2px ${transparent ? "rgba(10,8,7,0.9)" : "var(--ln-surface)"}, 0 0 7px var(--ln-star)` }} />
              )}
            </Link>
            <Link
              href={handle ? `/profile/${handle}` : "/onboarding"}
              className="ln-press lnw-nav-login"
              style={{ color: pathname.startsWith("/profile") ? ink : muted, textDecoration: "none", fontFamily: "var(--ln-body)", fontSize: 13.5, fontWeight: 600, padding: "6px 4px", whiteSpace: "nowrap" }}
            >
              Profile
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="ln-press"
              style={{
                padding: "9px 17px",
                borderRadius: 999,
                border: `1px solid rgba(${transparent ? "241,235,224" : "var(--ln-fg-rgb)"},0.2)`,
                cursor: "pointer",
                background: "transparent",
                color: ink,
                fontFamily: "var(--ln-body)",
                fontSize: 13.5,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="ln-press lnw-nav-login"
              style={{ color: muted, textDecoration: "none", fontFamily: "var(--ln-body)", fontSize: 13.5, fontWeight: 600, padding: "6px 4px", whiteSpace: "nowrap" }}
            >
              Log in
            </Link>
            <Link
              href="/login"
              className="ln-press"
              style={{
                padding: "9px 17px",
                borderRadius: 999,
                border: "none",
                textDecoration: "none",
                background: accent,
                color: "#2c1517",
                fontFamily: "var(--ln-body)",
                fontSize: 13.5,
                fontWeight: 700,
                whiteSpace: "nowrap",
                boxShadow: `0 8px 22px -10px ${accent}`,
              }}
            >
              Sign up
            </Link>
          </>
        )}
      </div>

      <style>{`
        @media (max-width: 760px) {
          .lnw-nav-inner { gap: 10px !important; padding: 0 16px !important; }
          .lnw-nav-links { display: none !important; }
        }
        @media (max-width: 520px) {
          .lnw-nav-compose span { display: none !important; }
        }
      `}</style>
    </header>
  );
}

function NavLink({
  label,
  href,
  active,
  ink,
  muted,
  accent,
}: {
  label: string;
  href: string;
  active: boolean;
  ink: string;
  muted: string;
  accent: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        textDecoration: "none",
        padding: "6px 0",
        fontFamily: "var(--ln-label)",
        fontSize: 13.5,
        fontWeight: 600,
        letterSpacing: "0.01em",
        color: active ? ink : hover ? ink : muted,
        transition: "color 0.16s",
      }}
    >
      {label}
      <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, borderRadius: 2, background: accent, transform: `scaleX(${active ? 1 : 0})`, transformOrigin: "left", transition: "transform 0.2s" }} />
    </Link>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────────
export function Footer({ dark = true }: { dark?: boolean }) {
  const { data: session } = useSession();
  const handle = session?.user?.handle;
  const accent = "var(--ln-accent)";
  const fg = dark ? "#f1ebe0" : "var(--ln-fg)";
  const muted = dark ? "rgba(241,235,224,0.5)" : "rgba(var(--ln-fg-rgb),0.55)";
  const line = dark ? "rgba(241,235,224,0.12)" : "rgba(var(--ln-fg-rgb),0.12)";

  // Last.fm status for signed-in users (shown on the right of the footer).
  const [lastfm, setLastfm] = useState<{ connected: boolean; username: string } | null>(null);
  useEffect(() => {
    if (!session) { setLastfm(null); return; }
    let cancelled = false;
    fetch("/api/connect/lastfm")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d) setLastfm({ connected: !!d.connected, username: d.username || "" }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [session]);
  const connectLastfm = () => {
    const back = typeof window !== "undefined" ? window.location.pathname : "/";
    window.location.href = `/api/connect/lastfm?callbackUrl=${encodeURIComponent(back)}`;
  };

  return (
    <footer style={{ position: "relative", zIndex: 0, borderTop: `1px solid ${line}`, marginTop: "auto", background: "rgba(0,0,0,0.12)" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "44px 24px 52px", display: "flex", flexWrap: "wrap", gap: 30, alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ maxWidth: 360 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "baseline", gap: 7, textDecoration: "none" }}>
            <span style={{ fontFamily: "var(--ln-logo)", fontWeight: 800, fontSize: 20, color: fg, letterSpacing: "-0.02em" }}>LinerNotes</span>
          </Link>
          <p style={{ margin: "12px 0 0", fontFamily: "var(--ln-preview)", fontStyle: "italic", fontSize: 16, lineHeight: 1.45, color: muted }}>
            Press play. The song reads along with you.
          </p>
          <div style={{ marginTop: 16, fontFamily: "var(--ln-mono)", fontSize: 10.5, letterSpacing: "0.04em", color: muted }}>© 2026 LinerNotes · made for listeners</div>
        </div>

        <div style={{ flex: 1, display: "flex", gap: 90, flexWrap: "wrap", justifyContent: "center" }}>
          <FootCol head="Product" links={[["Community Feed", "/feed"], ["Log a note", "/log"]]} fg={fg} muted={muted} />
          <FootCol head="You" links={[["Friends", "/friends"], ["Profile", handle ? `/profile/${handle}` : "/login"]]} fg={fg} muted={muted} />
        </div>

        {session ? (
          <div style={{ minWidth: 220, maxWidth: 240 }}>
            <div style={{ fontFamily: "var(--ln-label)", fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: accent, marginBottom: 12 }}>Last.fm</div>
            {lastfm?.connected ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 13px", borderRadius: 12, background: "rgba(127,207,155,0.1)", border: "1px solid rgba(127,207,155,0.28)" }}>
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}><circle cx="9" cy="9" r="9" fill="#7fcf9b" /><path d="M5 9l2.5 2.5 5-5" stroke="#0a0908" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span style={{ fontFamily: "var(--ln-body)", fontSize: 13, fontWeight: 600, color: fg }}>Last.fm connected successfully</span>
              </div>
            ) : (
              <button onClick={connectLastfm} className="ln-press" style={{ display: "block", textAlign: "center", width: "100%", boxSizing: "border-box", padding: "13px", borderRadius: 12, background: accent, color: "#2c1517", border: "none", cursor: "pointer", fontFamily: "var(--ln-body)", fontSize: 14, fontWeight: 700, boxShadow: `0 10px 26px -12px ${accent}` }}>
                Connect Last.fm
              </button>
            )}
          </div>
        ) : (
          <div style={{ minWidth: 220 }}>
            <div style={{ fontFamily: "var(--ln-label)", fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: accent, marginBottom: 12 }}>get started</div>
            <Link href="/login" className="ln-press" style={{ display: "block", textAlign: "center", textDecoration: "none", width: "100%", boxSizing: "border-box", padding: "13px", borderRadius: 12, background: accent, color: "#2c1517", fontFamily: "var(--ln-body)", fontSize: 14, fontWeight: 700, boxShadow: `0 10px 26px -12px ${accent}` }}>
              Sign up
            </Link>
            <p style={{ margin: "10px 0 0", fontFamily: "var(--ln-mono)", fontSize: 10, lineHeight: 1.5, color: muted, letterSpacing: "0.02em" }}>Start logging your listening moments</p>
          </div>
        )}
      </div>
    </footer>
  );
}

function FootCol({
  head,
  links,
  fg,
  muted,
}: {
  head: string;
  links: [string, string][];
  fg: string;
  muted: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontFamily: "var(--ln-label)", fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: muted }}>{head}</div>
      {links.map(([label, href]) => (
        <Link key={label} href={href} style={{ fontFamily: "var(--ln-body)", fontSize: 13.5, color: fg, opacity: 0.82, textDecoration: "none" }}>{label}</Link>
      ))}
    </div>
  );
}
