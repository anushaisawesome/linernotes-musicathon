#!/usr/bin/env tsx
/**
 * Fix low-quality artwork URLs in reviews by fetching high-res from Spotify
 */

import { prisma } from '../src/lib/prisma';

async function getSpotifyToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing Spotify credentials');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  return data.access_token;
}

async function searchSpotifyTrack(token: string, trackName: string, artistName: string) {
  const query = encodeURIComponent(`track:${trackName} artist:${artistName}`);
  const response = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  const track = data.tracks?.items?.[0];

  if (track?.album?.images?.[0]?.url) {
    return track.album.images[0].url; // Highest quality image
  }

  return null;
}

async function fixArtwork() {
  console.log('🎨 Fixing artwork quality for all reviews...\n');

  const token = await getSpotifyToken();
  console.log('✓ Got Spotify access token\n');

  // Find all reviews with low-quality artwork (64s or 174s in URL)
  const reviews = await prisma.review.findMany({
    where: {
      OR: [
        { artworkUrl: { contains: '/64s/' } },
        { artworkUrl: { contains: '/174s/' } },
        { artworkUrl: { contains: '/300x300/' } },
      ],
    },
    select: {
      id: true,
      trackName: true,
      trackArtist: true,
      artworkUrl: true,
    },
  });

  console.log(`Found ${reviews.length} reviews with low-quality artwork\n`);

  let updated = 0;
  let failed = 0;

  for (const review of reviews) {
    try {
      console.log(`Fixing: ${review.trackName} - ${review.trackArtist}`);

      const newArtwork = await searchSpotifyTrack(token, review.trackName, review.trackArtist);

      if (newArtwork) {
        await prisma.review.update({
          where: { id: review.id },
          data: { artworkUrl: newArtwork },
        });
        console.log(`  ✓ Updated to: ${newArtwork}\n`);
        updated++;
      } else {
        console.log(`  ⚠ No Spotify match found\n`);
        failed++;
      }

      // Rate limit - wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`  ✗ Error: ${error}\n`);
      failed++;
    }
  }

  console.log(`\n✓ Done! Updated ${updated} reviews, ${failed} failed`);
}

fixArtwork()
  .catch(console.error)
  .finally(() => process.exit());
