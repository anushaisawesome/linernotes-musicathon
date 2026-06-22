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

async function searchSpotifyTrack(trackName: string, artistName: string, accessToken: string, retryCount = 0): Promise<string | null> {
  try {
    const query = encodeURIComponent(`track:${trackName} artist:${artistName}`);
    const searchUrl = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`;

    const searchResponse = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (searchResponse.status === 429) {
      const retryAfter = searchResponse.headers.get('Retry-After');
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 2000;

      if (retryCount < 3) {
        globalLog?.(`  Rate limited, waiting ${waitTime}ms before retry ${retryCount + 1}/3`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return searchSpotifyTrack(trackName, artistName, accessToken, retryCount + 1);
      } else {
        globalLog?.(`  ERROR: Rate limited after 3 retries`);
        return null;
      }
    }

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

/**
 * GET /api/migrate-track-ids?batch=5&offset=0
 *
 * Migrates UUID track IDs to Spotify IDs in small batches to avoid database connection limits.
 * Default: 5 items per batch
 */
export async function GET(request: NextRequest) {
  const output: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    output.push(msg);
  };

  globalLog = log;

  try {
    const searchParams = request.nextUrl.searchParams;
    const batchSize = Math.min(parseInt(searchParams.get('batch') || '5'), 10); // Max 10
    const offset = parseInt(searchParams.get('offset') || '0');

    log(`Migration batch: size=${batchSize}, offset=${offset}\n`);

    const accessToken = await getSpotifyToken();
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'Failed to get Spotify access token',
        log: output,
      }, { status: 500 });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Get all reviews
    const allReviews = await prisma.review.findMany({
      select: {
        id: true,
        trackId: true,
        trackName: true,
        trackArtist: true,
      },
      where: {
        trackId: { contains: '-' }, // Quick filter for UUIDs
      },
    });

    const reviewsToMigrate = allReviews.filter(r => uuidRegex.test(r.trackId));
    const batch = reviewsToMigrate.slice(offset, offset + batchSize);

    log(`Total track reviews with UUIDs: ${reviewsToMigrate.length}`);
    log(`Processing batch: ${offset}-${offset + batch.length - 1}\n`);

    let successCount = 0;
    let failCount = 0;

    for (const review of batch) {
      log(`"${review.trackName}" by ${review.trackArtist}`);

      const spotifyId = await searchSpotifyTrack(review.trackName, review.trackArtist, accessToken);

      if (spotifyId) {
        await prisma.review.update({
          where: { id: review.id },
          data: { trackId: spotifyId },
        });
        log(`  ✓ Updated to ${spotifyId}\n`);
        successCount++;
      } else {
        log(`  ✗ Failed\n`);
        failCount++;
      }

      await new Promise(resolve => setTimeout(resolve, 600)); // 600ms between requests
    }

    const hasMore = offset + batchSize < reviewsToMigrate.length;
    const nextOffset = hasMore ? offset + batchSize : null;

    log(`\n=== Batch Summary ===`);
    log(`Processed: ${batch.length}`);
    log(`Successful: ${successCount}`);
    log(`Failed: ${failCount}`);
    log(`Remaining: ${reviewsToMigrate.length - offset - batch.length}`);

    if (hasMore) {
      log(`\n➜ Next: /api/migrate-track-ids?offset=${nextOffset}&batch=${batchSize}`);
    } else {
      log(`\n✓ All track reviews migrated!`);
    }

    return NextResponse.json({
      success: true,
      batch: {
        size: batch.length,
        offset: offset,
        hasMore: hasMore,
        nextOffset: nextOffset,
      },
      results: {
        successful: successCount,
        failed: failCount,
        remaining: reviewsToMigrate.length - offset - batch.length,
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
