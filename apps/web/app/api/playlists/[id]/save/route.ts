import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/playlists/[id]/save - Toggle save on a playlist
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

    const existing = await prisma.playlistSave.findUnique({
      where: { userId_playlistId: { userId: currentUserId, playlistId } },
    });

    if (existing) {
      await prisma.playlistSave.delete({ where: { id: existing.id } });
      const saveCount = await prisma.playlistSave.count({ where: { playlistId } });
      return NextResponse.json({ saved: false, saveCount });
    } else {
      await prisma.playlistSave.create({ data: { userId: currentUserId, playlistId } });
      const saveCount = await prisma.playlistSave.count({ where: { playlistId } });
      return NextResponse.json({ saved: true, saveCount });
    }
  } catch (error) {
    console.error("Playlist save toggle error:", error);
    return NextResponse.json({ error: "Failed to toggle save" }, { status: 500 });
  }
}
