import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/playlists/[id]/repost - Toggle repost on a playlist
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

    const existing = await prisma.playlistRepost.findUnique({
      where: { userId_playlistId: { userId: currentUserId, playlistId } },
    });

    if (existing) {
      await prisma.playlistRepost.delete({ where: { id: existing.id } });
      const repostCount = await prisma.playlistRepost.count({ where: { playlistId } });
      return NextResponse.json({ reposted: false, repostCount });
    } else {
      await prisma.playlistRepost.create({ data: { userId: currentUserId, playlistId } });
      const repostCount = await prisma.playlistRepost.count({ where: { playlistId } });
      return NextResponse.json({ reposted: true, repostCount });
    }
  } catch (error) {
    console.error("Playlist repost toggle error:", error);
    return NextResponse.json({ error: "Failed to toggle repost" }, { status: 500 });
  }
}
