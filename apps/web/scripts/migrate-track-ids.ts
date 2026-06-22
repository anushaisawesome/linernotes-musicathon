/**
 * Migration script to convert UUID track IDs to Spotify IDs
 *
 * Run with: cd apps/web && DATABASE_URL="your_db_url" SPOTIFY_CLIENT_ID="..." SPOTIFY_CLIENT_SECRET="..." npx tsx scripts/migrate-track-ids.ts
 *
 * Or export them first:
 * export DATABASE_URL="..."
 * export SPOTIFY_CLIENT_ID="..."
 * export SPOTIFY_CLIENT_SECRET="..."
 * cd apps/web && npx tsx scripts/migrate-track-ids.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Check environment variables
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable not set');
  console.error('Please run: export DATABASE_URL="your_database_url"');
  process.exit(1);
}

if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
  console.error('ERROR: SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables required');
  console.error('Please run:');
  console.error('export SPOTIFY_CLIENT_ID="your_client_id"');
  console.error('export SPOTIFY_CLIENT_SECRET="your_client_secret"');
  process.exit(1);
}

// Initialize Prisma with pg adapter (matches apps/web/src/lib/prisma.ts)
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

async function migrateReviews() {
  console.log('Starting track ID migration...\n');

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

  console.log(`Found ${reviewsToMigrate.length} reviews with UUID track IDs\n`);

  let successCount = 0;
  let failCount = 0;

  for (const review of reviewsToMigrate) {
    console.log(`Migrating: "${review.trackName}" by ${review.trackArtist}`);
    console.log(`  Old ID: ${review.trackId}`);

    const spotifyId = await getSpotifyId(review.trackName, review.trackArtist);

    if (spotifyId) {
      await prisma.review.update({
        where: { id: review.id },
        data: { trackId: spotifyId },
      });
      console.log(`  New ID: ${spotifyId} ✓\n`);
      successCount++;
    } else {
      console.log(`  Failed to find Spotify ID ✗\n`);
      failCount++;
    }

    // Rate limit: wait 100ms between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n=== Migration Summary ===');
  console.log(`Total reviews: ${reviewsToMigrate.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${failCount}`);
}

// Album track reviews are just Review records with albumReviewId set
// They're already handled by migrateReviews() above

async function main() {
  try {
    await migrateReviews();
    console.log('\n✓ Migration complete!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
