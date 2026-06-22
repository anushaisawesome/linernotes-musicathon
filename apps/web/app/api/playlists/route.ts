import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

// Include shape that carries everything needed to compute counts + the viewer's
// own like/repost/save state for a playlist.
const playlistInclude = {
  user: { select: { id: true, handle: true, displayName: true, avatarUrl: true } },
  tracks: {
    orderBy: { order: "asc" as const },
    include: { notes: { orderBy: { seconds: "asc" as const } } },
  },
  likes: true,
  reposts: true,
  saves: true,
  _count: { select: { likes: true, reposts: true, saves: true } },
};

function formatPlaylist(p: any, currentUserId?: string) {
  return {
    id: p.id,
    userId: p.userId,
    title: p.title,
    description: p.description,
    user: p.user,
    tracks: p.tracks,
    likeCount: p._count?.likes ?? 0,
    repostCount: p._count?.reposts ?? 0,
    saveCount: p._count?.saves ?? 0,
    likedByMe: currentUserId ? (p.likes || []).some((l: any) => l.userId === currentUserId) : false,
    repostedByMe: currentUserId ? (p.reposts || []).some((r: any) => r.userId === currentUserId) : false,
    saved: currentUserId ? (p.saves || []).some((s: any) => s.userId === currentUserId) : false,
    createdAt: p.createdAt.toISOString(),
  };
}

/**
 * GET /api/playlists - Get user's playlists, the public feed, or the current
 * user's reposted/saved collections (type=reposts|saved).
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    const currentUserId = session?.user?.id;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const type = searchParams.get("type"); // "reposts" | "saved" | null

    // Reposts / saves — the current user's own collections, keyed off the session.
    if (type === "reposts" || type === "saved") {
      if (!currentUserId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (type === "reposts") {
        const reposts = await prisma.playlistRepost.findMany({
          where: { userId: currentUserId },
          include: { playlist: { include: playlistInclude } },
          orderBy: { createdAt: "desc" },
        });
        const playlists = reposts
          .map((r) => r.playlist)
          .filter(Boolean)
          .map((p) => formatPlaylist(p, currentUserId));
        return NextResponse.json({ playlists });
      }
      const saves = await prisma.playlistSave.findMany({
        where: { userId: currentUserId },
        include: { playlist: { include: playlistInclude } },
        orderBy: { createdAt: "desc" },
      });
      const playlists = saves
        .map((s) => s.playlist)
        .filter(Boolean)
        .map((p) => formatPlaylist(p, currentUserId));
      return NextResponse.json({ playlists });
    }

    const where = userId ? { userId } : {};

    const playlists = await prisma.playlist.findMany({
      where,
      include: playlistInclude,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      playlists: playlists.map((p) => formatPlaylist(p, currentUserId)),
    });
  } catch (error) {
    console.error("Failed to fetch playlists:", error);
    return NextResponse.json(
      { error: "Failed to fetch playlists" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/playlists - Create a new playlist
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const { title, description, tracks } = body;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json(
        { error: "At least one track is required" },
        { status: 400 }
      );
    }

    // Get ONE Spotify token for all track lookups
    let spotifyToken: string | null = null;
    const needsLookup = tracks.some((t: any) => !(/^[a-zA-Z0-9]{22}$/.test(t.trackId)));

    if (needsLookup) {
      try {
        const clientId = process.env.SPOTIFY_CLIENT_ID;
        const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

        if (clientId && clientSecret) {
          const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            },
            body: 'grant_type=client_credentials',
          });

          if (tokenResponse.ok) {
            const { access_token } = await tokenResponse.json();
            spotifyToken = access_token;
            console.log("[Playlists] Got Spotify token for track lookups");
          }
        }
      } catch (error) {
        console.error("[Playlists] Failed to get Spotify token:", error);
      }
    }

    // Look up Spotify IDs for any non-Spotify tracks
    const finalTracks = await Promise.all(
      tracks.map(async (track: any, index: number) => {
        let finalTrackId = track.trackId;
        const isSpotifyId = /^[a-zA-Z0-9]{22}$/.test(track.trackId);

        if (!isSpotifyId && spotifyToken) {
          console.log("[Playlists] Looking up Spotify ID for:", track.trackId);
          try {
            const query = encodeURIComponent(`track:${track.name} artist:${track.artist}`);
            const searchUrl = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`;
            const searchResponse = await fetch(searchUrl, {
              headers: { Authorization: `Bearer ${spotifyToken}` },
            });

            if (searchResponse.ok) {
              const searchData = await searchResponse.json();
              const spotifyTrack = searchData.tracks?.items?.[0];
              if (spotifyTrack) {
                finalTrackId = spotifyTrack.id;
                console.log("[Playlists] Found Spotify ID:", finalTrackId);
              } else {
                console.warn("[Playlists] No Spotify match, using original ID:", track.trackId);
              }
            }
          } catch (error) {
            console.error("[Playlists] Spotify track lookup failed:", error);
          }
        }

        return {
          trackId: finalTrackId,
          name: track.name,
          artist: track.artist,
          album: track.album || null,
          artworkUrl: track.artworkUrl || null,
          note: track.note?.trim() || null,
          take: track.take?.trim() || null,
          reaction: track.reaction || null,
          order: index,
          notes:
            Array.isArray(track.moments) && track.moments.length > 0
              ? {
                  create: track.moments.map((m: any) => ({
                    seconds: m.seconds || 0,
                    label: m.label || "moment",
                    note: m.note || null,
                    lyric: m.lyric || null,
                  })),
                }
              : undefined,
        };
      })
    );

    // Create playlist with tracks
    const playlist = await prisma.playlist.create({
      data: {
        userId: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        tracks: {
          create: finalTracks,
        },
      },
      include: {
        tracks: {
          orderBy: { order: "asc" },
          include: { notes: { orderBy: { seconds: "asc" } } },
        },
        user: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({ playlist }, { status: 201 });
  } catch (error) {
    console.error("Failed to create playlist:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to create playlist" },
      { status: 500 }
    );
  }
}
