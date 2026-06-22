import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/fix-album-tracks
 *
 * Fixes album review track IDs by fetching the correct tracks from Spotify
 * using the album ID instead of fuzzy track search
 */
export async function GET() {
  const output: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    output.push(msg);
  };

  try {
    log('Fixing album review track IDs...\n');

    // Get Spotify token
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Spotify credentials missing' }, { status: 500 });
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
      return NextResponse.json({ error: 'Failed to get Spotify token' }, { status: 500 });
    }

    const { access_token } = await tokenResponse.json();
    log('✓ Got Spotify token\n');

    // Get all album reviews
    const albumReviews = await prisma.albumReview.findMany({
      include: {
        trackReviews: true,
      },
    });

    log(`Found ${albumReviews.length} album reviews\n`);

    let fixed = 0;
    let errors = 0;

    for (const albumReview of albumReviews) {
      log(`\nAlbum: "${albumReview.albumName}" by ${albumReview.albumArtist}`);
      log(`  Album ID: ${albumReview.albumId}`);

      // Check if album ID is a Spotify ID
      const isSpotifyAlbumId = /^[a-zA-Z0-9]{22}$/.test(albumReview.albumId);

      if (!isSpotifyAlbumId) {
        log(`  ⚠ Album ID is not a Spotify ID, skipping`);
        continue;
      }

      // Fetch album tracks from Spotify
      const albumResponse = await fetch(
        `https://api.spotify.com/v1/albums/${albumReview.albumId}/tracks`,
        { headers: { 'Authorization': `Bearer ${access_token}` } }
      );

      if (!albumResponse.ok) {
        log(`  ✗ Failed to fetch album tracks (${albumResponse.status})`);
        errors++;
        continue;
      }

      const albumData = await albumResponse.json();
      const spotifyTracks = albumData.items || [];

      log(`  Found ${spotifyTracks.length} tracks on Spotify`);

      // Match each track review to the correct Spotify track by track number or name
      for (const trackReview of albumReview.trackReviews) {
        const trackNumber = trackReview.trackNumber;
        const trackName = trackReview.trackName.toLowerCase().trim();

        // Try to match by track number first (most reliable)
        let spotifyTrack = null;
        if (trackNumber && trackNumber <= spotifyTracks.length) {
          spotifyTrack = spotifyTracks[trackNumber - 1];
        }

        // If no match by track number, try by name
        if (!spotifyTrack) {
          spotifyTrack = spotifyTracks.find((t: any) =>
            t.name.toLowerCase().trim() === trackName ||
            t.name.toLowerCase().includes(trackName) ||
            trackName.includes(t.name.toLowerCase())
          );
        }

        if (spotifyTrack) {
          const currentId = trackReview.trackId;
          const correctId = spotifyTrack.id;

          if (currentId !== correctId) {
            log(`  Fixing track #${trackNumber}: "${trackReview.trackName}"`);
            log(`    Current ID: ${currentId}`);
            log(`    Correct ID: ${correctId} ("${spotifyTrack.name}")`);

            await prisma.review.update({
              where: { id: trackReview.id },
              data: {
                trackId: correctId,
                trackName: spotifyTrack.name,
              },
            });

            fixed++;
          }
        } else {
          log(`  ⚠ No Spotify match for track #${trackNumber}: "${trackReview.trackName}"`);
          errors++;
        }
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    log(`\n=== SUMMARY ===`);
    log(`Fixed: ${fixed} tracks`);
    log(`Errors: ${errors}`);

    return NextResponse.json({
      success: true,
      fixed,
      errors,
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
