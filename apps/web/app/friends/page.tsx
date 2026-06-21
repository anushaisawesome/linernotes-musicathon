"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { getFriends, sendFriendRequest, updateFriendRequest, removeFriend } from "@/lib/api";
import type { User } from "@/lib/types";
import { TopBar, Footer } from "@/components/ln/nav";
import { LNAvatar, LNIcon } from "@/components/ln/atoms";
import { tintFromString } from "@/lib/palette";

type Incoming = { id: string; requester: User };
type Sent = { id: string; addressee: User };

const gold = "var(--ln-accent)";

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  boxSizing: "border-box",
  background: "rgba(var(--ln-fg-rgb),0.06)",
  color: "var(--ln-fg)",
  border: "1px solid rgba(var(--ln-line-rgb),0.16)",
  borderRadius: 12,
  padding: "12px 14px",
  fontFamily: "var(--ln-body)",
  fontSize: 15,
  outline: "none",
};

function avatarUser(u: User) {
  return { name: u.displayName || u.handle, tint: tintFromString(u.id || u.handle), avatarUrl: u.avatarUrl };
}

function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 12 }}>
      <span style={{ fontFamily: "var(--ln-label)", fontSize: 11.5, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: gold }}>{children}</span>
      {typeof count === "number" && <span style={{ fontFamily: "var(--ln-mono)", fontSize: 10, color: "rgba(var(--ln-fg-rgb),0.4)" }}>{count}</span>}
      <span style={{ flex: 1, height: 1, background: "rgba(var(--ln-fg-rgb),0.1)", alignSelf: "center" }} />
    </div>
  );
}

function PersonRow({ user, right, onOpen }: { user: User; right?: React.ReactNode; onOpen?: () => void }) {
  const body = (
    <>
      <LNAvatar user={avatarUser(user)} size={42} />
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
        <div style={{ fontFamily: "var(--ln-body)", fontSize: 14, fontWeight: 600, color: "var(--ln-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.displayName || user.handle}</div>
        <div style={{ fontFamily: "var(--ln-mono)", fontSize: 10.5, color: "rgba(var(--ln-fg-rgb),0.5)" }}>@{user.handle}</div>
      </div>
    </>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 2px" }}>
      {onOpen ? (
        <button onClick={onOpen} className="ln-press" style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
          {body}
        </button>
      ) : (
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12 }}>{body}</div>
      )}
      {right}
    </div>
  );
}

export default function FriendsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const myHandle = session?.user?.handle;

  const [friends, setFriends] = useState<User[]>([]);
  const [incoming, setIncoming] = useState<Incoming[]>([]);
  const [sent, setSent] = useState<Sent[]>([]);
  const [reqTab, setReqTab] = useState<"incoming" | "sent">("incoming");
  const [loading, setLoading] = useState(true);

  const [addHandle, setAddHandle] = useState("");
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [shareMsg, setShareMsg] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<User | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const [f, reqs, snt] = await Promise.all([
          getFriends(),
          getFriends("requests"),
          getFriends("sent"),
        ]);
        setFriends(f.friends || []);
        setIncoming(reqs.requests || []);
        setSent(snt.requests || []);
      } catch (error) {
        console.error("Failed to load friends:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [session, status]);

  const handleAccept = async (userId: string) => {
    try {
      await updateFriendRequest(userId, "accept");
      const req = incoming.find((r) => r.requester.id === userId);
      setIncoming((arr) => arr.filter((r) => r.requester.id !== userId));
      if (req) setFriends((arr) => [...arr, req.requester]);
    } catch (error) {
      console.error("Failed to accept:", error);
    }
  };

  // Remove an accepted friend — opens an on-screen confirmation first.
  const confirmRemoveFriend = async () => {
    if (!confirmRemove) return;
    const f = confirmRemove;
    setRemoving(true);
    try {
      await removeFriend(f.id);
      setFriends((arr) => arr.filter((x) => x.id !== f.id));
      setConfirmRemove(null);
    } catch (error) {
      console.error("Failed to remove friend:", error);
      alert("Couldn't remove friend. Please try again.");
    } finally {
      setRemoving(false);
    }
  };

  const handleReject = async (userId: string) => {
    try {
      await updateFriendRequest(userId, "reject");
      setIncoming((arr) => arr.filter((r) => r.requester.id !== userId));
    } catch (error) {
      console.error("Failed to reject:", error);
    }
  };

  // Cancel an outgoing request: deletes the pending friendship (DELETE works at
  // any status, so it withdraws the request the current user sent).
  const handleCancel = async (addresseeId: string) => {
    try {
      await removeFriend(addresseeId);
      setSent((arr) => arr.filter((s) => s.addressee.id !== addresseeId));
    } catch (error) {
      console.error("Failed to cancel request:", error);
    }
  };

  const addByHandle = async (e: React.FormEvent) => {
    e.preventDefault();
    const h = addHandle.trim().replace(/^@/, "").toLowerCase();
    if (h.length < 2) {
      setAddMsg({ text: "Enter a handle", ok: false });
      return;
    }
    if (h === myHandle) {
      setAddMsg({ text: "That's you.", ok: false });
      return;
    }
    setAdding(true);
    setAddMsg(null);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(h)}`);
      if (!res.ok) {
        setAddMsg({ text: `No one found with @${h}`, ok: false });
        return;
      }
      const data = await res.json();
      const target: User = data.user;
      if (friends.some((f) => f.id === target.id)) {
        setAddMsg({ text: `You're already friends with @${target.handle}`, ok: false });
        return;
      }
      await sendFriendRequest(target.id);
      setSent((s) => [...s.filter((x) => x.addressee.id !== target.id), { id: `local-${target.id}`, addressee: target }]);
      setAddHandle("");
      setAddMsg({ text: `Request sent to @${target.handle}`, ok: true });
    } catch (error) {
      setAddMsg({ text: error instanceof Error ? error.message : "Couldn't send request", ok: false });
    } finally {
      setAdding(false);
    }
  };

  const shareProfile = async () => {
    if (!myHandle) return;
    const url = `${window.location.origin}/profile/${myHandle}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "My LinerNotes profile", text: `Find me on LinerNotes — @${myHandle}`, url });
        return;
      }
    } catch {
      /* user dismissed share — fall through to copy */
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareMsg("Profile link copied");
      setTimeout(() => setShareMsg(""), 2200);
    } catch {
      setShareMsg(url);
    }
  };

  return (
    <div style={{ background: "var(--ln-bg)", color: "var(--ln-fg)", minHeight: "100vh", display: "flex", flexDirection: "column", flex: 1 }}>
      <TopBar />

      <main style={{ position: "relative", zIndex: 1, flex: 1 }}>
        <section style={{ maxWidth: 620, margin: "0 auto", padding: "112px 20px 90px" }}>
          <h1 style={{ margin: "0 0 26px", fontFamily: "var(--ln-display)", fontWeight: 600, fontSize: 30, letterSpacing: "-0.01em" }}>Friends</h1>

          {!loading && !session && (
            <div style={{ textAlign: "center", padding: "60px 24px", borderRadius: 18, background: "var(--ln-surface)", border: "1px solid rgba(var(--ln-line-rgb),0.08)" }}>
              <p style={{ margin: "0 0 18px", fontFamily: "var(--ln-preview)", fontStyle: "italic", fontSize: 20, color: "var(--ln-fg)" }}>Log in to find your people.</p>
              <Link href="/login" className="ln-press" style={{ display: "inline-block", padding: "13px 26px", borderRadius: 999, textDecoration: "none", background: gold, color: "#2c1517", fontFamily: "var(--ln-body)", fontSize: 15, fontWeight: 700 }}>Log in</Link>
            </div>
          )}

          {loading && session && (
            <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid rgba(var(--ln-fg-rgb),0.15)", borderTopColor: gold, animation: "ln-spin 0.8s linear infinite" }} />
            </div>
          )}

          {!loading && session && (
            <>
              {/* Add a friend by handle */}
              <div style={{ padding: "18px 18px 20px", borderRadius: 16, background: "var(--ln-surface)", border: "1px solid rgba(var(--ln-line-rgb),0.08)" }}>
                <div style={{ fontFamily: "var(--ln-mono)", fontSize: 9.5, letterSpacing: "0.06em", color: gold, textTransform: "uppercase", marginBottom: 10 }}>add a friend</div>
                <form onSubmit={addByHandle} style={{ display: "flex", gap: 8 }}>
                  <input
                    value={addHandle}
                    onChange={(e) => { setAddHandle(e.target.value); setAddMsg(null); }}
                    placeholder="@handle"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    style={inputStyle}
                  />
                  <button type="submit" disabled={adding} className="ln-press" style={{ flexShrink: 0, padding: "12px 18px", borderRadius: 12, border: "none", cursor: adding ? "default" : "pointer", background: gold, color: "#2c1517", fontFamily: "var(--ln-body)", fontSize: 14, fontWeight: 700, opacity: adding ? 0.6 : 1 }}>
                    {adding ? "Sending…" : "Send request"}
                  </button>
                </form>
                {addMsg && (
                  <div style={{ marginTop: 10, fontFamily: "var(--ln-body)", fontSize: 13, color: addMsg.ok ? "#7fcf9b" : "rgba(var(--ln-fg-rgb),0.6)" }}>{addMsg.text}</div>
                )}

                {/* Share your profile */}
                <button onClick={shareProfile} disabled={!myHandle} className="ln-press" style={{ width: "100%", marginTop: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: 12, cursor: myHandle ? "pointer" : "default", background: "rgba(var(--ln-fg-rgb),0.05)", color: "var(--ln-fg)", border: "1px solid rgba(var(--ln-fg-rgb),0.18)", fontFamily: "var(--ln-body)", fontSize: 14, fontWeight: 600 }}>
                  <LNIcon name="share" size={16} color="var(--ln-fg)" />
                  {shareMsg || "Share your profile"}
                </button>
              </div>

              {/* Confirmed friends */}
              <div style={{ marginTop: 34 }}>
                <SectionLabel count={friends.length}>your friends</SectionLabel>
                {friends.length === 0 ? (
                  <div style={{ padding: "14px 2px", fontFamily: "var(--ln-body)", fontSize: 13.5, color: "rgba(var(--ln-fg-rgb),0.45)" }}>
                    No friends yet — add someone by their @handle, or share your profile.
                  </div>
                ) : (
                  <div>
                    {friends.map((f) => (
                      <PersonRow
                        key={f.id}
                        user={f}
                        onOpen={() => router.push(`/profile/${f.handle}`)}
                        right={
                          <button onClick={() => setConfirmRemove(f)} className="ln-press" title="Remove friend" style={{ flexShrink: 0, padding: "7px 13px", borderRadius: 999, border: "1px solid rgba(var(--ln-line-rgb),0.2)", background: "transparent", cursor: "pointer", color: "rgba(var(--ln-fg-rgb),0.6)", fontFamily: "var(--ln-body)", fontSize: 12.5, fontWeight: 600 }}>
                            Remove
                          </button>
                        }
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Requests — toggle between incoming (friend requests) and outgoing (pending) */}
              <div style={{ marginTop: 34 }}>
                <div style={{ display: "inline-flex", gap: 4, padding: 3, borderRadius: 999, background: "rgba(var(--ln-fg-rgb),0.04)", marginBottom: 18 }}>
                  {([["incoming", "Friend requests", incoming.length], ["sent", "Pending requests", sent.length]] as const).map(([id, label, n]) => {
                    const on = reqTab === id;
                    return (
                      <button key={id} onClick={() => setReqTab(id)} className="ln-press" style={{ padding: "6px 13px", borderRadius: 999, border: "none", cursor: "pointer", background: on ? "rgba(var(--ln-fg-rgb),0.09)" : "transparent", color: on ? "var(--ln-fg)" : "rgba(var(--ln-fg-rgb),0.5)", fontFamily: "var(--ln-body)", fontSize: 12.5, fontWeight: on ? 600 : 500, whiteSpace: "nowrap", transition: "color 0.15s, background 0.15s" }}>
                        {label}{n > 0 ? ` · ${n}` : ""}
                      </button>
                    );
                  })}
                </div>

                {reqTab === "incoming" ? (
                  incoming.length === 0 ? (
                    <div style={{ padding: "14px 2px", fontFamily: "var(--ln-body)", fontSize: 13.5, color: "rgba(var(--ln-fg-rgb),0.45)" }}>No friend requests right now.</div>
                  ) : (
                    <div>
                      {incoming.map((r) => (
                        <PersonRow
                          key={r.id}
                          user={r.requester}
                          right={
                            <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
                              <button onClick={() => handleAccept(r.requester.id)} className="ln-press" style={{ padding: "7px 14px", borderRadius: 999, border: "none", cursor: "pointer", background: gold, color: "#2c1517", fontFamily: "var(--ln-body)", fontSize: 12.5, fontWeight: 700 }}>Accept</button>
                              <button onClick={() => handleReject(r.requester.id)} className="ln-press" title="Decline" style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(var(--ln-line-rgb),0.18)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                                <LNIcon name="close" size={14} color="rgba(var(--ln-fg-rgb),0.5)" />
                              </button>
                            </div>
                          }
                        />
                      ))}
                    </div>
                  )
                ) : (
                  sent.length === 0 ? (
                    <div style={{ padding: "14px 2px", fontFamily: "var(--ln-body)", fontSize: 13.5, color: "rgba(var(--ln-fg-rgb),0.45)" }}>No pending requests — you haven&apos;t asked anyone yet.</div>
                  ) : (
                    <div>
                      {sent.map((s) => (
                        <PersonRow
                          key={s.id}
                          user={s.addressee}
                          right={
                            <button onClick={() => handleCancel(s.addressee.id)} className="ln-press" style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 999, border: "1px solid rgba(var(--ln-line-rgb),0.2)", background: "transparent", cursor: "pointer", color: "rgba(var(--ln-fg-rgb),0.7)", fontFamily: "var(--ln-body)", fontSize: 12.5, fontWeight: 600 }}>Cancel request</button>
                          }
                        />
                      ))}
                    </div>
                  )
                )}
              </div>

              <div style={{ textAlign: "center", marginTop: 30, fontFamily: "var(--ln-mono)", fontSize: 10, lineHeight: 1.5, color: "rgba(var(--ln-fg-rgb),0.32)", letterSpacing: "0.02em" }}>
                your feed is built from the people you keep here.
              </div>
            </>
          )}
        </section>
      </main>

      {/* Remove-friend confirmation — an on-screen dialog, not a native prompt */}
      {confirmRemove && (
        <div
          onClick={() => !removing && setConfirmRemove(null)}
          style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(6,4,4,0.66)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", animation: "ln-fade 0.2s ease both" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 380, background: "var(--ln-bg)", borderRadius: 20, border: "1px solid rgba(var(--ln-line-rgb),0.14)", boxShadow: "0 50px 110px -34px rgba(0,0,0,0.8)", padding: "24px 22px", animation: "ln-pop 0.3s cubic-bezier(.16,1,.3,1) both" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <LNAvatar user={avatarUser(confirmRemove)} size={40} />
              <div style={{ minWidth: 0, lineHeight: 1.3 }}>
                <div style={{ fontFamily: "var(--ln-body)", fontSize: 14, fontWeight: 600, color: "var(--ln-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{confirmRemove.displayName || confirmRemove.handle}</div>
                <div style={{ fontFamily: "var(--ln-mono)", fontSize: 10.5, color: "rgba(var(--ln-fg-rgb),0.5)" }}>@{confirmRemove.handle}</div>
              </div>
            </div>
            <h3 style={{ margin: 0, fontFamily: "var(--ln-display)", fontSize: 20, fontWeight: 600, color: "var(--ln-fg)" }}>Remove this friend?</h3>
            <p style={{ margin: "8px 0 18px", fontFamily: "var(--ln-body)", fontSize: 14, lineHeight: 1.45, color: "rgba(var(--ln-fg-rgb),0.65)" }}>
              You&apos;ll no longer see @{confirmRemove.handle} in your friends or your feed. You can always add them again.
            </p>
            <div style={{ display: "flex", gap: 11 }}>
              <button onClick={() => setConfirmRemove(null)} disabled={removing} className="ln-press" style={{ flex: 1, padding: "12px", borderRadius: 12, cursor: removing ? "default" : "pointer", background: "rgba(var(--ln-fg-rgb),0.06)", color: "var(--ln-fg)", border: "1px solid rgba(var(--ln-fg-rgb),0.16)", fontFamily: "var(--ln-body)", fontSize: 14, fontWeight: 600 }}>Cancel</button>
              <button onClick={confirmRemoveFriend} disabled={removing} className="ln-press" style={{ flex: 1, padding: "12px", borderRadius: 12, cursor: removing ? "default" : "pointer", background: "#dc2626", color: "#fff", border: "none", fontFamily: "var(--ln-body)", fontSize: 14, fontWeight: 700, opacity: removing ? 0.6 : 1 }}>{removing ? "Removing…" : "Remove"}</button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
