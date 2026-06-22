import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Initialize Prisma with pg adapter
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

async function getSpotifyId(trackName: string, artistName: string): Promise<string | null> {
  try {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('Missing Spotify credentials');
      return null;
    }

    // Get Spotify app token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenResponse.ok) {
      console.error('Failed to get Spotify token');
      return null;
    }

    const { access_token } = await tokenResponse.json();

    // Search for track
    const query = encodeURIComponent(`${trackName} ${artistName}`);
    const searchUrl = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`;

    const searchResponse = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${access_token}` },
    });

    if (!searchResponse.ok) {
      console.error(`Search failed for "${trackName}" by ${artistName}`);
      return null;
    }

    const searchData = await searchResponse.json();
    const spotifyTrack = searchData.tracks?.items?.[0];

    if (spotifyTrack) {
      return spotifyTrack.id;
    }

    return null;
  } catch (error) {
    console.error(`Error looking up Spotify ID:`, error);
    return null;
  }
}

export async function GET() {
  const output: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    output.push(msg);
  };

  try {
    log('Starting track ID migration...\n');

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

      const spotifyId = await getSpotifyId(review.trackName, review.trackArtist);

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

    log('\n=== Migration Summary ===');
    log(`Total reviews: ${reviewsToMigrate.length}`);
    log(`Successful: ${successCount}`);
    log(`Failed: ${failCount}`);

    return NextResponse.json({
      success: true,
      total: reviewsToMigrate.length,
      successful: successCount,
      failed: failCount,
      log: output,
    });

  } catch (error) {
    log(`Migration failed: ${error}`);
    return NextResponse.json({
      success: false,
      error: String(error),
      log: output,
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
