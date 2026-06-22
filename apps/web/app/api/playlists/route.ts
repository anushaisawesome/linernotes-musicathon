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

    // Create playlist with tracks
    const playlist = await prisma.playlist.create({
      data: {
        userId: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        tracks: {
          create: tracks.map((track: any, index: number) => ({
            trackId: track.trackId,
            name: track.name,
            artist: track.artist,
            album: track.album || null,
            artworkUrl: track.artworkUrl || null,
            note: track.note?.trim() || null,
            take: track.take?.trim() || null,
            reaction: track.reaction || null,
            order: index,
            // Store per-track moments structurally (mirrors Note on Review).
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
          })),
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
