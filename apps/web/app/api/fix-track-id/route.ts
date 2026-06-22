import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

async function getSpotifyToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) return null;

  const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!tokenResponse.ok) return null;
  const { access_token } = await tokenResponse.json();
  return access_token;
}

async function searchSpotify(query: string, type: 'track' | 'album', accessToken: string): Promise<string | null> {
  const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=1`;

  const response = await fetch(searchUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!response.ok) return null;

  const data = await response.json();
  const items = type === 'track' ? data.tracks?.items : data.albums?.items;
  return items?.[0]?.id || null;
}

/**
 * POST /api/fix-track-id
 *
 * Fixes a single UUID track/album ID by searching Spotify.
 * Send: { reviewId: "...", type: "track" | "album" }
 *
 * Or GET to list all UUIDs that need fixing
 */
export async function GET() {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const [reviews, albums] = await Promise.all([
    prisma.review.findMany({
      where: { trackId: { contains: '-' } },
      select: { id: true, trackId: true, trackName: true, trackArtist: true },
    }),
    prisma.albumReview.findMany({
      where: { albumId: { contains: '-' } },
      select: { id: true, albumId: true, albumName: true, albumArtist: true },
    }),
  ]);

  const trackReviews = reviews.filter(r => uuidRegex.test(r.trackId));
  const albumReviews = albums.filter(a => uuidRegex.test(a.albumId));

  return NextResponse.json({
    trackReviews: trackReviews.map(r => ({
      id: r.id,
      trackId: r.trackId,
      name: r.trackName,
      artist: r.trackArtist,
    })),
    albumReviews: albumReviews.map(a => ({
      id: a.id,
      albumId: a.albumId,
      name: a.albumName,
      artist: a.albumArtist,
    })),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { reviewId, type } = body;

  if (!reviewId || !type) {
    return NextResponse.json({ error: 'reviewId and type required' }, { status: 400 });
  }

  const accessToken = await getSpotifyToken();
  if (!accessToken) {
    return NextResponse.json({ error: 'Failed to get Spotify token' }, { status: 500 });
  }

  if (type === 'track') {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { trackName: true, trackArtist: true, trackId: true },
    });

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    const query = `track:${review.trackName} artist:${review.trackArtist}`;
    const spotifyId = await searchSpotify(query, 'track', accessToken);

    if (!spotifyId) {
      return NextResponse.json({
        error: 'Track not found on Spotify',
        searched: { name: review.trackName, artist: review.trackArtist }
      }, { status: 404 });
    }

    await prisma.review.update({
      where: { id: reviewId },
      data: { trackId: spotifyId },
    });

    return NextResponse.json({
      success: true,
      oldId: review.trackId,
      newId: spotifyId,
      track: `${review.trackName} by ${review.trackArtist}`,
    });

  } else if (type === 'album') {
    const album = await prisma.albumReview.findUnique({
      where: { id: reviewId },
      select: { albumName: true, albumArtist: true, albumId: true },
    });

    if (!album) {
      return NextResponse.json({ error: 'Album review not found' }, { status: 404 });
    }

    const query = `album:${album.albumName} artist:${album.albumArtist}`;
    const spotifyId = await searchSpotify(query, 'album', accessToken);

    if (!spotifyId) {
      return NextResponse.json({
        error: 'Album not found on Spotify',
        searched: { name: album.albumName, artist: album.albumArtist }
      }, { status: 404 });
    }

    await prisma.albumReview.update({
      where: { id: reviewId },
      data: { albumId: spotifyId },
    });

    return NextResponse.json({
      success: true,
      oldId: album.albumId,
      newId: spotifyId,
      album: `${album.albumName} by ${album.albumArtist}`,
    });

  } else {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }
}
