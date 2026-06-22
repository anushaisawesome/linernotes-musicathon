import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/playlists/[id]/like - Toggle like on a playlist
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    const currentUserId = session?.user?.id;

    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: playlistId } = await params;

    const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
    if (!playlist) {
      return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
    }

    const existing = await prisma.playlistLike.findUnique({
      where: { userId_playlistId: { userId: currentUserId, playlistId } },
    });

    if (existing) {
      await prisma.playlistLike.delete({ where: { id: existing.id } });
      const likeCount = await prisma.playlistLike.count({ where: { playlistId } });
      return NextResponse.json({ liked: false, likeCount });
    } else {
      await prisma.playlistLike.create({ data: { userId: currentUserId, playlistId } });
      const likeCount = await prisma.playlistLike.count({ where: { playlistId } });
      return NextResponse.json({ liked: true, likeCount });
    }
  } catch (error) {
    console.error("Playlist like toggle error:", error);
    return NextResponse.json({ error: "Failed to toggle like" }, { status: 500 });
  }
}
