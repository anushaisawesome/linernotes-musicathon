import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-helpers";

/**
 * GET /api/playlists/[id] - Get a specific playlist
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const { id: playlistId } = await params;

    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
      include: {
        user: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        tracks: {
          orderBy: { order: "asc" },
        },
        _count: {
          select: {
            likes: true,
            reposts: true,
            saves: true,
          },
        },
      },
    });

    if (!playlist) {
      return NextResponse.json(
        { error: "Playlist not found" },
        { status: 404 }
      );
    }

    // Check the current user's like / repost / save state.
    let likedByMe = false;
    let repostedByMe = false;
    let saved = false;

    if (session?.user?.id) {
      const [like, repost, save] = await Promise.all([
        prisma.playlistLike.findUnique({
          where: { userId_playlistId: { userId: session.user.id, playlistId: playlist.id } },
        }),
        prisma.playlistRepost.findUnique({
          where: { userId_playlistId: { userId: session.user.id, playlistId: playlist.id } },
        }),
        prisma.playlistSave.findUnique({
          where: { userId_playlistId: { userId: session.user.id, playlistId: playlist.id } },
        }),
      ]);

      likedByMe = !!like;
      repostedByMe = !!repost;
      saved = !!save;
    }

    const formattedPlaylist = {
      id: playlist.id,
      userId: playlist.userId,
      title: playlist.title,
      description: playlist.description,
      user: playlist.user,
      tracks: playlist.tracks,
      likeCount: playlist._count.likes,
      repostCount: playlist._count.reposts,
      saveCount: playlist._count.saves,
      likedByMe,
      repostedByMe,
      saved,
      createdAt: playlist.createdAt.toISOString(),
    };

    return NextResponse.json({ playlist: formattedPlaylist });
  } catch (error) {
    console.error("Failed to fetch playlist:", error);
    return NextResponse.json(
      { error: "Failed to fetch playlist" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/playlists/[id] - Delete a playlist (owner only)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const currentUserId = session?.user?.id;
    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: playlistId } = await params;
    const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
    if (!playlist) {
      return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
    }
    if (playlist.userId !== currentUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Tracks, likes, reposts and saves cascade via the schema relations.
    await prisma.playlist.delete({ where: { id: playlistId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete playlist:", error);
    return NextResponse.json(
      { error: "Failed to delete playlist" },
      { status: 500 }
    );
  }
}
