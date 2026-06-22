import { NextRequest, NextResponse } from 'next/server';

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
    // Get Spotify app token
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Spotify not configured' },
        { status: 500 }
      );
    }

    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to get Spotify token' },
        { status: 500 }
      );
    }

    const { access_token } = await tokenResponse.json();

    // Search Spotify
    const query = encodeURIComponent(`track:${trackName} artist:${artistName}`);
    const searchUrl = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`;

    const searchResponse = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${access_token}` },
    });

    if (!searchResponse.ok) {
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
