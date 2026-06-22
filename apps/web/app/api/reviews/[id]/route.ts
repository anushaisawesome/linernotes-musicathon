import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/reviews/[id] - Get a single review
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getAuthSession();
    const currentUserId = session?.user?.id;

    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        user: true,
        likes: true,
        saves: true,
        reposts: {
          include: { user: true },
        },
        notes: {
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { likes: true, reposts: true, saves: true },
        },
      },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Transform to match expected types
    const transformedReview = {
      id: review.id,
      userId: review.userId,
      user: review.user,
      track: {
        trackId: review.trackId,
        name: review.trackName,
        artist: review.trackArtist,
        album: review.trackAlbum,
        artworkUrl: review.artworkUrl,
        previewUrl: review.previewUrl || undefined,
      },
      rating: review.rating,
      take: review.take || undefined,
      moment: review.momentSeconds !== null && review.momentSeconds !== undefined ? {
        seconds: review.momentSeconds,
        label: review.momentLabel || undefined,
      } : undefined,
      notes: review.notes.map(note => ({
        id: note.id,
        seconds: note.seconds,
        label: note.label,
        note: note.note || undefined,
        lyric: note.lyric || undefined,
        createdAt: note.createdAt.toISOString(),
      })),
      featuredNoteId: review.featuredNoteId || undefined,
      createdAt: review.createdAt.toISOString(),
      likeCount: review._count.likes,
      repostCount: review._count.reposts,
      saveCount: review._count.saves,
      likedByMe: currentUserId ? review.likes.some((l) => l.userId === currentUserId) : false,
      repostedByMe: currentUserId ? review.reposts.some((r) => r.userId === currentUserId) : false,
      saved: currentUserId ? review.saves.some((s) => s.userId === currentUserId) : false,
    };

    return NextResponse.json({ review: transformedReview });
  } catch (error) {
    console.error("Get review error:", error);
    return NextResponse.json(
      { error: "Failed to fetch review" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/reviews/[id] - Update a review
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    const currentUserId = session?.user?.id;

    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { featuredNoteId, rating, take, notes } = body;

    // Check if review exists and belongs to user
    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        notes: true,
      },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    if (review.userId !== currentUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // If only updating featuredNoteId (backward compatibility)
    if (featuredNoteId !== undefined && rating === undefined && take === undefined && notes === undefined) {
      // Validate that the note belongs to this review
      if (featuredNoteId !== null) {
        const noteExists = review.notes.some(n => n.id === featuredNoteId);
        if (!noteExists) {
          return NextResponse.json(
            { error: "Note not found in this review" },
            { status: 400 }
          );
        }
      }

      const updatedReview = await prisma.review.update({
        where: { id },
        data: {
          featuredNoteId: featuredNoteId || null,
        },
        include: {
          user: true,
          notes: {
            orderBy: { createdAt: 'asc' },
          },
          _count: {
            select: { likes: true, reposts: true },
          },
        },
      });

      const transformedReview = {
        id: updatedReview.id,
        userId: updatedReview.userId,
        user: updatedReview.user,
        track: {
          trackId: updatedReview.trackId,
          name: updatedReview.trackName,
          artist: updatedReview.trackArtist,
          album: updatedReview.trackAlbum,
          artworkUrl: updatedReview.artworkUrl,
          previewUrl: updatedReview.previewUrl || undefined,
        },
        rating: updatedReview.rating,
        take: updatedReview.take || undefined,
        notes: updatedReview.notes.map(note => ({
          id: note.id,
          seconds: note.seconds,
          label: note.label,
          note: note.note || undefined,
          lyric: note.lyric || undefined,
          createdAt: note.createdAt.toISOString(),
        })),
        featuredNoteId: updatedReview.featuredNoteId || undefined,
        createdAt: updatedReview.createdAt.toISOString(),
        likeCount: updatedReview._count.likes,
        repostCount: updatedReview._count.reposts,
      };

      return NextResponse.json({ review: transformedReview });
    }

    // Full review update - delete old notes and create new ones
    if (notes !== undefined) {
      // Delete existing notes
      await prisma.note.deleteMany({
        where: { reviewId: id },
      });
    }

    // Update review with new data
    const updateData: any = {};
    if (rating !== undefined) updateData.rating = rating;
    if (take !== undefined) updateData.take = take || null;

    // Create new notes if provided
    if (notes && notes.length > 0) {
      updateData.notes = {
        create: notes.map((note: any) => ({
          seconds: note.seconds,
          label: note.label,
          note: note.note || null,
          lyric: note.lyric || null,
        })),
      };
    }

    const updatedReview = await prisma.review.update({
      where: { id },
      data: updateData,
      include: {
        user: true,
        notes: {
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { likes: true, reposts: true, saves: true },
        },
      },
    });

    // Feature the first submitted note if notes were provided
    if (notes && notes.length > 0 && updatedReview.notes.length > 0) {
      const want = notes[0];
      const match =
        updatedReview.notes.find(
          (n) =>
            n.seconds === want.seconds &&
            (n.label || null) === (want.label ?? null) &&
            (n.note || null) === (want.note || null) &&
            (n.lyric || null) === (want.lyric || null)
        ) || updatedReview.notes[0];
      await prisma.review.update({
        where: { id },
        data: { featuredNoteId: match.id },
      });
    }

    // Transform to match expected types
    const transformedReview = {
      id: updatedReview.id,
      userId: updatedReview.userId,
      user: updatedReview.user,
      track: {
        trackId: updatedReview.trackId,
        name: updatedReview.trackName,
        artist: updatedReview.trackArtist,
        album: updatedReview.trackAlbum,
        artworkUrl: updatedReview.artworkUrl,
        previewUrl: updatedReview.previewUrl || undefined,
      },
      rating: updatedReview.rating,
      take: updatedReview.take || undefined,
      notes: updatedReview.notes.map(note => ({
        id: note.id,
        seconds: note.seconds,
        label: note.label,
        note: note.note || undefined,
        lyric: note.lyric || undefined,
        createdAt: note.createdAt.toISOString(),
      })),
      featuredNoteId: updatedReview.featuredNoteId || undefined,
      createdAt: updatedReview.createdAt.toISOString(),
      likeCount: updatedReview._count.likes,
      repostCount: updatedReview._count.reposts,
      saveCount: updatedReview._count.saves,
    };

    return NextResponse.json({ review: transformedReview });
  } catch (error) {
    console.error("Update review error:", error);
    return NextResponse.json(
      { error: "Failed to update review" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reviews/[id] - Delete a review
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    const currentUserId = session?.user?.id;

    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if review exists and belongs to user
    const review = await prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    if (review.userId !== currentUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete review (likes and reposts will cascade)
    await prisma.review.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete review error:", error);
    return NextResponse.json(
      { error: "Failed to delete review" },
      { status: 500 }
    );
  }
}
