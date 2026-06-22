import { NextRequest, NextResponse } from 'next/server';
import { getSpotifyAppToken } from '@/lib/spotify-token-cache';

/**
 * GET /api/spotify-search?track=...&artist=...
 *
 * Spotify-only search for Experience playback fallback
 * Returns only Spotify track IDs (never iTunes/MusicBrainz)
 */

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
        console.warn('[Spotify Search] Rate limit hit, returning 429');
        return NextResponse.json(
          { error: 'Spotify rate limit exceeded, please wait' },
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

    return NextResponse.json({
      trackId: spotifyTrack.id,
      name: spotifyTrack.name,
      artist: spotifyTrack.artists[0]?.name,
      album: spotifyTrack.album.name,
      artworkUrl: spotifyTrack.album.images[0]?.url,
    });

  } catch (error) {
    console.error('[Spotify Search] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
