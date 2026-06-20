import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-helpers";

/**
 * GET /api/spotify/playlist?url=<spotify playlist link or id>
 * Returns the playlist's tracks in the app's Track shape, so a playlist can be
 * imported into the playlist composer. Uses an app-level (client-credentials)
 * Spotify token, so it works for any public playlist.
 */

// Accepts: https://open.spotify.com/playlist/<id>?si=...  |  spotify:playlist:<id>  |  bare <id>
function parsePlaylistId(input: string): string | null {
  const s = (input || "").trim();
  const m = s.match(/playlist[:/]([a-zA-Z0-9]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9]{16,}$/.test(s)) return s;
  return null;
}

let appToken: { token: string; expiresAt: number } | null = null;
async function getSpotifyAppToken(): Promise<string | null> {
  if (appToken && appToken.expiresAt > Date.now() + 5000) return appToken.token;
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;
  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    });
    if (!res.ok) return null;
    const d = await res.json();
    if (!d.access_token) return null;
    appToken = { token: d.access_token, expiresAt: Date.now() + (d.expires_in || 3600) * 1000 };
    return d.access_token;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parsePlaylistId(request.nextUrl.searchParams.get("url") || "");
  if (!id) {
    return NextResponse.json({ error: "That doesn't look like a Spotify playlist link." }, { status: 400 });
  }

  const token = await getSpotifyAppToken();
  if (!token) {
    return NextResponse.json({ error: "Spotify is unavailable right now." }, { status: 502 });
  }

  try {
    const tracks: Array<{ trackId: string; name: string; artist: string; album: string; artworkUrl: string; previewUrl?: string }> = [];
    let next: string | null =
      `https://api.spotify.com/v1/playlists/${id}/tracks?limit=100&fields=${encodeURIComponent(
        "items(track(id,name,artists(name),album(name,images),preview_url)),next"
      )}`;

    // Page through up to 200 tracks.
    while (next && tracks.length < 200) {
      const res: Response = await fetch(next, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        if (res.status === 404) {
          return NextResponse.json({ error: "Playlist not found (it may be private)." }, { status: 404 });
        }
        return NextResponse.json({ error: "Couldn't load that playlist." }, { status: 502 });
      }
      const data: { items?: Array<{ track: any }>; next: string | null } = await res.json();
      for (const item of data.items || []) {
        const t = item?.track;
        if (!t || !t.id) continue; // skip local/unavailable tracks
        tracks.push({
          trackId: String(t.id),
          name: t.name,
          artist: (t.artists || []).map((a: { name: string }) => a.name).filter(Boolean).join(", "),
          album: t.album?.name || "",
          artworkUrl: t.album?.images?.[0]?.url || "",
          previewUrl: t.preview_url || undefined,
        });
      }
      next = data.next;
    }

    return NextResponse.json({ tracks });
  } catch (error) {
    console.error("Spotify playlist import error:", error);
    return NextResponse.json({ error: "Couldn't load that playlist." }, { status: 502 });
  }
}
