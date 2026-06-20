"use client";

import { signIn } from "next-auth/react";
import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const INK = "#f8ecdb";
const PAPER = "#1a0a0c";
const LINE = "rgba(255,205,165,0.16)";
const muted = (a: number) => `rgba(248,236,219,${a})`;

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "rgba(248,236,219,0.06)",
  color: INK,
  border: `1px solid ${LINE}`,
  borderRadius: 14,
  padding: "14px 15px",
  fontFamily: "var(--ln-body)",
  fontSize: 15,
  outline: "none",
};

function LoginForm() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const errorParam = searchParams.get("error");

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        displayName,
        action: isSignup ? "signup" : "login",
        redirect: false,
      });
      if (result?.error) {
        setError(result.error);
      } else if (result?.ok) {
        // Redirect new signups to onboarding, existing users to callback URL
        router.push(isSignup ? "/onboarding" : callbackUrl);
        router.refresh();
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSpotifySignIn = () => signIn("spotify", { callbackUrl });

  const gold = "var(--ln-accent)";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", background: "#0a0908", position: "relative", overflow: "hidden" }}>
      {/* card */}
      <div style={{ position: "relative", width: "100%", maxWidth: 440, background: PAPER, borderRadius: 22, overflow: "hidden", border: "1px solid rgba(255,205,165,0.14)", boxShadow: "0 50px 110px -34px rgba(0,0,0,0.8)", animation: "ln-pop 0.3s cubic-bezier(.16,1,.3,1) both" }}>
        {/* garnet glow */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(90% 50% at 50% -8%, #7a1d24 0%, #3a0f14 40%, ${PAPER} 72%)` }} />
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(64% 32% at 50% 0%, ${gold}4d 0%, transparent 60%)` }} />
        </div>

        <div style={{ position: "relative", padding: "44px 32px 32px" }}>
          <div style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: "var(--ln-logo)", fontWeight: 800, fontSize: 26, color: INK, letterSpacing: "-0.02em" }}>LinerNotes</span>
          </div>

          <h2 style={{ margin: "20px 0 0", fontFamily: "var(--ln-syne)", fontWeight: 700, fontSize: 25, lineHeight: 1.16, color: INK, letterSpacing: "-0.01em" }}>
            {isSignup ? "Join LinerNotes." : "Welcome back."}
          </h2>
          <p style={{ margin: "10px 0 0", fontFamily: "var(--ln-body)", fontSize: 14.5, lineHeight: 1.5, color: muted(0.64) }}>
            {isSignup
              ? "Create your account to start logging your listening moments."
              : "Pick up where you left off — your notes and the friends you'd tell."}
          </p>

          {(errorParam || error) && (
            <div style={{ marginTop: 18, padding: "11px 13px", borderRadius: 12, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.45)", color: "#ffb4b4", fontFamily: "var(--ln-body)", fontSize: 13.5 }}>
              {error || "Authentication error. Please try again."}
            </div>
          )}

          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 11 }}>
            <button onClick={handleSpotifySignIn} className="ln-press" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", padding: "14px", borderRadius: 14, border: "none", cursor: "pointer", background: "#1DB954", color: "#fff", fontFamily: "var(--ln-body)", fontSize: 15, fontWeight: 600, boxShadow: "0 10px 26px -14px rgba(0,0,0,0.8)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              Continue with Spotify
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "3px 0" }}>
              <span style={{ flex: 1, height: 1, background: LINE }} />
              <span style={{ fontFamily: "var(--ln-mono)", fontSize: 10, color: muted(0.45), letterSpacing: "0.05em" }}>or</span>
              <span style={{ flex: 1, height: 1, background: LINE }} />
            </div>

            <form onSubmit={handleEmailAuth} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {isSignup && (
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required={isSignup} placeholder="Your name" style={inputStyle} />
              )}
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="you@email.com" inputMode="email" style={inputStyle} />
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={6} placeholder="••••••••" style={inputStyle} />
              <button type="submit" disabled={loading} className="ln-press" style={{ width: "100%", padding: "14px", borderRadius: 14, border: "none", cursor: loading ? "default" : "pointer", background: gold, color: "#1a0a04", fontFamily: "var(--ln-body)", fontSize: 15, fontWeight: 700, boxShadow: `0 12px 30px -10px ${gold}cc`, opacity: loading ? 0.6 : 1 }}>
                {loading ? "Please wait…" : isSignup ? "Sign up" : "Log in"}
              </button>
            </form>

            <div style={{ textAlign: "center", marginTop: 6, fontFamily: "var(--ln-body)", fontSize: 13, color: muted(0.64) }}>
              {isSignup ? "Already have an account?" : "New to LinerNotes?"}{" "}
              <button onClick={() => { setIsSignup(!isSignup); setError(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: gold, fontFamily: "inherit", fontSize: 13, fontWeight: 700, padding: 0 }}>
                {isSignup ? "Log in" : "Sign up"}
              </button>
            </div>

            <p style={{ textAlign: "center", marginTop: 8, fontFamily: "var(--ln-mono)", fontSize: 9.5, lineHeight: 1.5, color: muted(0.38), letterSpacing: "0.02em" }}>
              No Spotify or Last.fm account needed. Connect your listening later, in the app.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0908", color: INK }}>
          <span style={{ fontFamily: "var(--ln-logo)", fontWeight: 800, fontSize: 26 }}>LinerNotes</span>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
