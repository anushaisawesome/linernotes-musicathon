import { NextRequest, NextResponse } from 'next/server';
import { getSpotifyAppToken } from '@/lib/spotify-token-cache';

/**
 * GET /api/spotify-search?track=...&artist=...
 *
 * Spotify-only search for Experience playback fallback
 * Returns only Spotify track IDs (never iTunes/MusicBrainz)
 */

// Cache search results (5 minutes)
const searchCache = new Map<string, { result: any; expiresAt: number }>();

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const trackName = searchParams.get('track');
  const artistName = searchParams.get('artist');

  if (!trackName || !artistName) {
    return NextResponse.json(
      { error: 'track and artist parameters required' },
      { status: 400 }
    );
  }

  // Check cache first
  const cacheKey = `${trackName.toLowerCase()}:${artistName.toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    console.log('[Spotify Search] Cache hit for', cacheKey);
    return NextResponse.json(cached.result);
  }

  try {
    // Get cached or new Spotify token
    const access_token = await getSpotifyAppToken();

    // Search Spotify
    const query = encodeURIComponent(`track:${trackName} artist:${artistName}`);
    const searchUrl = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`;

    const searchResponse = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${access_token}` },
    });

    if (!searchResponse.ok) {
      if (searchResponse.status === 429) {
        const retryAfter = searchResponse.headers.get('Retry-After');
        const waitSeconds = retryAfter ? parseInt(retryAfter) : 30;
        console.warn(`[Spotify Search] Rate limit hit, retry after ${waitSeconds}s`);
        return NextResponse.json(
          {
            error: `Spotify rate limit exceeded, please wait ${waitSeconds} seconds`,
            retryAfter: waitSeconds
          },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: 'Spotify search failed' },
        { status: searchResponse.status }
      );
    }

    const searchData = await searchResponse.json();
    const spotifyTrack = searchData.tracks?.items?.[0];

    if (!spotifyTrack) {
      return NextResponse.json(
        { error: 'Track not found on Spotify' },
        { status: 404 }
      );
    }

    const result = {
      trackId: spotifyTrack.id,
      name: spotifyTrack.name,
      artist: spotifyTrack.artists[0]?.name,
      album: spotifyTrack.album.name,
      artworkUrl: spotifyTrack.album.images[0]?.url,
    };

    // Cache the result for 5 minutes
    searchCache.set(cacheKey, {
      result,
      expiresAt: Date.now() + (5 * 60 * 1000),
    });
    console.log('[Spotify Search] Cached result for', cacheKey);

    return NextResponse.json(result);

  } catch (error) {
    console.error('[Spotify Search] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
