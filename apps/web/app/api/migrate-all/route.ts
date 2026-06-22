import { NextRequest, NextResponse } from 'next/server';
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
    // Try multiple search strategies
    const queries = [
      `track:"${trackName}" artist:"${artistName}"`,
      `${trackName} ${artistName}`,
      trackName,
    ];

    for (const query of queries) {
      const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`;

      const searchResponse = await fetch(searchUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (searchResponse.status === 429) {
        globalLog?.(`  Rate limited, waiting...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      if (!searchResponse.ok) continue;

      const searchData = await searchResponse.json();
      const tracks = searchData.tracks?.items || [];

      // Look for exact or close match
      for (const track of tracks) {
        const trackNameMatch = track.name.toLowerCase().includes(trackName.toLowerCase()) ||
                              trackName.toLowerCase().includes(track.name.toLowerCase());
        const artistMatch = track.artists.some((a: any) =>
          a.name.toLowerCase().includes(artistName.toLowerCase()) ||
          artistName.toLowerCase().includes(a.name.toLowerCase())
        );

        if (trackNameMatch && artistMatch) {
          globalLog?.(`  ✓ Found: "${track.name}" by ${track.artists[0].name} (${track.id})`);
          return track.id;
        }
      }

      // If no good match, try first result
      if (tracks.length > 0) {
        const track = tracks[0];
        globalLog?.(`  ~ Best guess: "${track.name}" by ${track.artists[0].name} (${track.id})`);
        return track.id;
      }
    }

    globalLog?.(`  ✗ No Spotify match found after ${queries.length} attempts`);
    return null;
  } catch (error) {
    globalLog?.(`  ERROR: Search exception: ${error}`);
    return null;
  }
}

async function searchSpotifyAlbum(albumName: string, artistName: string, accessToken: string): Promise<string | null> {
  try {
    const queries = [
      `album:"${albumName}" artist:"${artistName}"`,
      `${albumName} ${artistName}`,
    ];

    for (const query of queries) {
      const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=3`;

      const searchResponse = await fetch(searchUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (searchResponse.status === 429) {
        globalLog?.(`  Rate limited, waiting...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      if (!searchResponse.ok) continue;

      const searchData = await searchResponse.json();
      const albums = searchData.albums?.items || [];

      for (const album of albums) {
        const albumNameMatch = album.name.toLowerCase().includes(albumName.toLowerCase()) ||
                              albumName.toLowerCase().includes(album.name.toLowerCase());
        const artistMatch = album.artists.some((a: any) =>
          a.name.toLowerCase().includes(artistName.toLowerCase()) ||
          artistName.toLowerCase().includes(a.name.toLowerCase())
        );

        if (albumNameMatch && artistMatch) {
          globalLog?.(`  ✓ Found: "${album.name}" by ${album.artists[0].name} (${album.id})`);
          return album.id;
        }
      }

      if (albums.length > 0) {
        const album = albums[0];
        globalLog?.(`  ~ Best guess: "${album.name}" by ${album.artists[0].name} (${album.id})`);
        return album.id;
      }
    }

    globalLog?.(`  ✗ No Spotify album match found`);
    return null;
  } catch (error) {
    globalLog?.(`  ERROR: Album search exception: ${error}`);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const output: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    output.push(msg);
  };

  globalLog = log;

  try {
    log('Starting comprehensive migration...\n');

    const accessToken = await getSpotifyToken();
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'Failed to get Spotify access token',
        log: output,
      }, { status: 500 });
    }

    const spotifyIdRegex = /^[a-zA-Z0-9]{22}$/;

    // Migrate ALL track reviews
    log('=== Migrating Track Reviews ===\n');
    const reviews = await prisma.review.findMany({
      select: {
        id: true,
        trackId: true,
        trackName: true,
        trackArtist: true,
      },
    });

    const reviewsToMigrate = reviews.filter(r => !spotifyIdRegex.test(r.trackId));
    log(`Found ${reviewsToMigrate.length} reviews to migrate\n`);

    let reviewSuccess = 0;
    let reviewFail = 0;

    for (const review of reviewsToMigrate) {
      log(`"${review.trackName}" by ${review.trackArtist}`);

      const spotifyId = await searchSpotifyTrack(review.trackName, review.trackArtist, accessToken);

      if (spotifyId) {
        await prisma.review.update({
          where: { id: review.id },
          data: { trackId: spotifyId },
        });
        reviewSuccess++;
      } else {
        reviewFail++;
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    }

    log(`\nTrack Reviews: ${reviewSuccess} migrated, ${reviewFail} failed\n`);

    // Migrate ALL albums
    log('=== Migrating Albums ===\n');
    const albums = await prisma.albumReview.findMany({
      select: {
        id: true,
        albumId: true,
        albumName: true,
        albumArtist: true,
      },
    });

    const albumsToMigrate = albums.filter(a => !spotifyIdRegex.test(a.albumId));
    log(`Found ${albumsToMigrate.length} albums to migrate\n`);

    let albumSuccess = 0;
    let albumFail = 0;

    for (const album of albumsToMigrate) {
      log(`"${album.albumName}" by ${album.albumArtist}`);

      const spotifyId = await searchSpotifyAlbum(album.albumName, album.albumArtist, accessToken);

      if (spotifyId) {
        await prisma.albumReview.update({
          where: { id: album.id },
          data: { albumId: spotifyId },
        });
        albumSuccess++;
      } else {
        albumFail++;
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    }

    log(`\nAlbums: ${albumSuccess} migrated, ${albumFail} failed\n`);

    // Migrate playlist tracks
    log('=== Migrating Playlist Tracks ===\n');
    const playlistTracks = await prisma.playlistTrack.findMany({
      select: {
        id: true,
        trackId: true,
        name: true,
        artist: true,
      },
    });

    const playlistTracksToMigrate = playlistTracks.filter(t => !spotifyIdRegex.test(t.trackId));
    log(`Found ${playlistTracksToMigrate.length} playlist tracks to migrate\n`);

    let playlistSuccess = 0;
    let playlistFail = 0;

    for (const track of playlistTracksToMigrate) {
      log(`"${track.name}" by ${track.artist}`);

      const spotifyId = await searchSpotifyTrack(track.name, track.artist, accessToken);

      if (spotifyId) {
        await prisma.playlistTrack.update({
          where: { id: track.id },
          data: { trackId: spotifyId },
        });
        playlistSuccess++;
      } else {
        playlistFail++;
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    }

    log(`\nPlaylist Tracks: ${playlistSuccess} migrated, ${playlistFail} failed\n`);

    log('\n=== FINAL SUMMARY ===');
    log(`Track Reviews: ${reviewSuccess}/${reviewsToMigrate.length}`);
    log(`Albums: ${albumSuccess}/${albumsToMigrate.length}`);
    log(`Playlist Tracks: ${playlistSuccess}/${playlistTracksToMigrate.length}`);
    log(`Total Success: ${reviewSuccess + albumSuccess + playlistSuccess}`);
    log(`Total Failed: ${reviewFail + albumFail + playlistFail}`);

    return NextResponse.json({
      success: true,
      results: {
        reviews: { migrated: reviewSuccess, failed: reviewFail },
        albums: { migrated: albumSuccess, failed: albumFail },
        playlistTracks: { migrated: playlistSuccess, failed: playlistFail },
      },
      log: output,
    });

  } catch (error) {
    log(`\nERROR: ${error}`);
    return NextResponse.json({
      success: false,
      error: String(error),
      log: output,
    }, { status: 500 });
  }
}
