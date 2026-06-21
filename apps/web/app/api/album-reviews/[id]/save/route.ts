import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/album-reviews/[id]/save - Toggle save on an album review
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

    const { id: albumReviewId } = await params;

    const albumReview = await prisma.albumReview.findUnique({
      where: { id: albumReviewId },
    });

    if (!albumReview) {
      return NextResponse.json({ error: "Album review not found" }, { status: 404 });
    }

    const existing = await prisma.albumSave.findUnique({
      where: { userId_albumReviewId: { userId: currentUserId, albumReviewId } },
    });

    if (existing) {
      await prisma.albumSave.delete({ where: { id: existing.id } });
      const saveCount = await prisma.albumSave.count({ where: { albumReviewId } });
      return NextResponse.json({ saved: false, saveCount });
    } else {
      await prisma.albumSave.create({ data: { userId: currentUserId, albumReviewId } });
      const saveCount = await prisma.albumSave.count({ where: { albumReviewId } });
      return NextResponse.json({ saved: true, saveCount });
    }
  } catch (error) {
    console.error("Album save toggle error:", error);
    return NextResponse.json({ error: "Failed to toggle save" }, { status: 500 });
  }
}
