import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

let globalLog: ((msg: string) => void) | null = null;

async function getSpotifyToken(): Promise<string | null> {
  try {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      globalLog?.('ERROR: Missing Spotify credentials');
      return null;
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
      const errorText = await tokenResponse.text();
      globalLog?.(`ERROR: Failed to get Spotify token: ${tokenResponse.status} - ${errorText}`);
      return null;
    }

    const { access_token } = await tokenResponse.json();
    globalLog?.('✓ Got Spotify access token');
    return access_token;
  } catch (error) {
    globalLog?.(`ERROR: Exception getting Spotify token: ${error}`);
    return null;
  }
}

async function searchSpotifyTrack(trackName: string, artistName: string, accessToken: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(`track:${trackName} artist:${artistName}`);
    const searchUrl = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`;

    const searchResponse = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      globalLog?.(`  ERROR: Spotify API returned ${searchResponse.status}: ${errorText.substring(0, 200)}`);
      return null;
    }

    const searchData = await searchResponse.json();
    const resultCount = searchData.tracks?.items?.length || 0;
    globalLog?.(`  Search returned ${resultCount} result(s)`);

    const spotifyTrack = searchData.tracks?.items?.[0];

    if (spotifyTrack) {
      globalLog?.(`  ✓ Matched: "${spotifyTrack.name}" by ${spotifyTrack.artists[0].name}`);
      return spotifyTrack.id;
    }

    globalLog?.(`  ✗ No results`);
    return null;
  } catch (error) {
    globalLog?.(`  ERROR: Exception during search: ${error}`);
    return null;
  }
}

async function searchSpotifyAlbum(albumName: string, artistName: string, accessToken: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(`album:${albumName} artist:${artistName}`);
    const searchUrl = `https://api.spotify.com/v1/search?q=${query}&type=album&limit=1`;

    const searchResponse = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      globalLog?.(`  ERROR: Spotify API returned ${searchResponse.status}: ${errorText.substring(0, 200)}`);
      return null;
    }

    const searchData = await searchResponse.json();
    const resultCount = searchData.albums?.items?.length || 0;
    globalLog?.(`  Search returned ${resultCount} result(s)`);

    const spotifyAlbum = searchData.albums?.items?.[0];

    if (spotifyAlbum) {
      globalLog?.(`  ✓ Matched: "${spotifyAlbum.name}" by ${spotifyAlbum.artists[0].name}`);
      return spotifyAlbum.id;
    }

    globalLog?.(`  ✗ No results`);
    return null;
  } catch (error) {
    globalLog?.(`  ERROR: Exception during album search: ${error}`);
    return null;
  }
}

export async function GET() {
  const output: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    output.push(msg);
  };

  // Set global log so helper functions can use it
  globalLog = log;

  try {
    log('Starting track ID migration...\n');

    // Get Spotify access token once
    const accessToken = await getSpotifyToken();
    if (!accessToken) {
      log('ERROR: Failed to get Spotify access token');
      return NextResponse.json({
        success: false,
        error: 'Failed to get Spotify access token',
        log: output,
      }, { status: 500 });
    }

    // Find all reviews with UUID track IDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    const reviews = await prisma.review.findMany({
      select: {
        id: true,
        trackId: true,
        trackName: true,
        trackArtist: true,
      },
    });

    const reviewsToMigrate = reviews.filter(r => uuidRegex.test(r.trackId));

    log(`Found ${reviewsToMigrate.length} reviews with UUID track IDs\n`);

    let successCount = 0;
    let failCount = 0;

    for (const review of reviewsToMigrate) {
      log(`Migrating: "${review.trackName}" by ${review.trackArtist}`);
      log(`  Old ID: ${review.trackId}`);

      const spotifyId = await searchSpotifyTrack(review.trackName, review.trackArtist, accessToken);

      if (spotifyId) {
        await prisma.review.update({
          where: { id: review.id },
          data: { trackId: spotifyId },
        });
        log(`  New ID: ${spotifyId} ✓\n`);
        successCount++;
      } else {
        log(`  Failed to find Spotify ID ✗\n`);
        failCount++;
      }

      // Rate limit: wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    log('\n=== Track Reviews Migration Summary ===');
    log(`Total reviews: ${reviewsToMigrate.length}`);
    log(`Successful: ${successCount}`);
    log(`Failed: ${failCount}`);

    // Migrate AlbumReview.albumId
    log('\n\nMigrating album IDs...\n');

    const albumReviews = await prisma.albumReview.findMany({
      select: {
        id: true,
        albumId: true,
        albumName: true,
        albumArtist: true,
      },
    });

    const albumsToMigrate = albumReviews.filter(a => uuidRegex.test(a.albumId));
    log(`Found ${albumsToMigrate.length} albums with UUID IDs\n`);

    let albumSuccessCount = 0;
    let albumFailCount = 0;

    for (const album of albumsToMigrate) {
      log(`Migrating album: "${album.albumName}" by ${album.albumArtist}`);
      log(`  Old ID: ${album.albumId}`);

      const spotifyId = await searchSpotifyAlbum(album.albumName, album.albumArtist, accessToken);

      if (spotifyId) {
        await prisma.albumReview.update({
          where: { id: album.id },
          data: { albumId: spotifyId },
        });
        log(`  New ID: ${spotifyId} ✓\n`);
        albumSuccessCount++;
      } else {
        log(`  Failed to find Spotify album ID ✗\n`);
        albumFailCount++;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    log('\n=== Album Reviews Migration Summary ===');
    log(`Total albums: ${albumsToMigrate.length}`);
    log(`Successful: ${albumSuccessCount}`);
    log(`Failed: ${albumFailCount}`);

    // Migrate PlaylistTrack.trackId
    log('\n\nMigrating playlist tracks...\n');

    const playlistTracks = await prisma.playlistTrack.findMany({
      select: {
        id: true,
        trackId: true,
        name: true,
        artist: true,
      },
    });

    const playlistTracksToMigrate = playlistTracks.filter(t => uuidRegex.test(t.trackId));
    log(`Found ${playlistTracksToMigrate.length} playlist tracks with UUID IDs\n`);

    let playlistSuccessCount = 0;
    let playlistFailCount = 0;

    for (const track of playlistTracksToMigrate) {
      log(`Migrating playlist track: "${track.name}" by ${track.artist}`);
      log(`  Old ID: ${track.trackId}`);

      const spotifyId = await searchSpotifyTrack(track.name, track.artist, accessToken);

      if (spotifyId) {
        await prisma.playlistTrack.update({
          where: { id: track.id },
          data: { trackId: spotifyId },
        });
        log(`  New ID: ${spotifyId} ✓\n`);
        playlistSuccessCount++;
      } else {
        log(`  Failed to find Spotify track ID ✗\n`);
        playlistFailCount++;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    log('\n=== Playlist Tracks Migration Summary ===');
    log(`Total playlist tracks: ${playlistTracksToMigrate.length}`);
    log(`Successful: ${playlistSuccessCount}`);
    log(`Failed: ${playlistFailCount}`);

    log('\n\n=== OVERALL MIGRATION SUMMARY ===');
    log(`Track reviews: ${successCount}/${reviewsToMigrate.length}`);
    log(`Album reviews: ${albumSuccessCount}/${albumsToMigrate.length}`);
    log(`Playlist tracks: ${playlistSuccessCount}/${playlistTracksToMigrate.length}`);
    log(`Total successful: ${successCount + albumSuccessCount + playlistSuccessCount}`);
    log(`Total failed: ${failCount + albumFailCount + playlistFailCount}`);

    return NextResponse.json({
      success: true,
      trackReviews: { total: reviewsToMigrate.length, successful: successCount, failed: failCount },
      albumReviews: { total: albumsToMigrate.length, successful: albumSuccessCount, failed: albumFailCount },
      playlistTracks: { total: playlistTracksToMigrate.length, successful: playlistSuccessCount, failed: playlistFailCount },
      log: output,
    });

  } catch (error) {
    log(`Migration failed: ${error}`);
    return NextResponse.json({
      success: false,
      error: String(error),
      log: output,
    }, { status: 500 });
  }
}
