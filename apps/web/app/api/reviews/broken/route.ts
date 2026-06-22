import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/reviews/broken
 *
 * Lists all reviews with non-Spotify track IDs
 */
export async function GET() {
  try {
    const reviews = await prisma.review.findMany({
      select: {
        id: true,
        trackId: true,
        trackName: true,
        trackArtist: true,
        userId: true,
      },
    });

    const albumReviews = await prisma.albumReview.findMany({
      select: {
        id: true,
        albumId: true,
        albumName: true,
        albumArtist: true,
      },
    });

    const spotifyIdRegex = /^[a-zA-Z0-9]{22}$/;

    const brokenReviews = reviews.filter(r => !spotifyIdRegex.test(r.trackId));
    const brokenAlbums = albumReviews.filter(a => !spotifyIdRegex.test(a.albumId));

    return NextResponse.json({
      brokenReviews: brokenReviews.map(r => ({
        id: r.id,
        trackId: r.trackId,
        trackName: r.trackName,
        trackArtist: r.trackArtist,
        userId: r.userId,
      })),
      brokenAlbums: brokenAlbums.map(a => ({
        id: a.id,
        albumId: a.albumId,
        albumName: a.albumName,
        albumArtist: a.albumArtist,
      })),
      summary: {
        totalReviews: reviews.length,
        brokenReviews: brokenReviews.length,
        totalAlbums: albumReviews.length,
        brokenAlbums: brokenAlbums.length,
      },
    });
  } catch (error) {
    console.error('Error checking broken reviews:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
