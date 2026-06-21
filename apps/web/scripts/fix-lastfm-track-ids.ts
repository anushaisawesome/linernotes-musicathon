/**
 * Fix Last.fm track IDs in existing reviews
 *
 * This script finds all reviews with fake "lastfm-..." track IDs and updates them
 * with real Spotify track IDs by searching Spotify's API.
 */

import { prisma } from '../src/lib/prisma';

interface SpotifyTrack {
  trackId: string;
  name: string;
  artist: string;
  album: string;
  artworkUrl: string;
  previewUrl?: string;
}

/**
 * Search Spotify for a track and return the best match
 */
async function searchSpotifyTrack(trackName: string, artistName: string): Promise<SpotifyTrack | null> {
  try {
    // Clean up track name (remove trailing periods, extra spaces)
    const cleanTrack = trackName.trim().replace(/\.\s*$/, '').trim();
    const cleanArtist = artistName.trim();

    console.log(`   Searching Spotify: "${cleanTrack}" by ${cleanArtist}`);

    const query = encodeURIComponent(`${cleanTrack} ${cleanArtist}`);
    const url = `${process.env.NEXTAUTH_URL}/api/music/search/tracks?q=${query}&limit=1`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`   Spotify search failed:`, response.status);
      return null;
    }

    const data = await response.json();
    if (data.tracks && data.tracks.length > 0) {
      return data.tracks[0];
    }

    return null;
  } catch (error) {
    console.error(`   Error searching Spotify:`, error);
    return null;
  }
}

async function fixLastFmTrackIds() {
  console.log('🔍 Finding reviews with Last.fm fake track IDs...\n');

  // Find all reviews with fake Last.fm track IDs
  const reviews = await prisma.review.findMany({
    where: {
      trackId: {
        startsWith: 'lastfm-'
      }
    },
    select: {
      id: true,
      trackId: true,
      trackName: true,
      trackArtist: true,
      trackAlbum: true,
      artworkUrl: true,
      user: {
        select: {
          handle: true,
          displayName: true
        }
      }
    }
  });

  console.log(`Found ${reviews.length} reviews with Last.fm fake IDs\n`);

  if (reviews.length === 0) {
    console.log('✅ No reviews need fixing!');
    await prisma.$disconnect();
    return;
  }

  let updatedCount = 0;
  let notFoundCount = 0;

  for (const review of reviews) {
    console.log(`\n📝 Review by @${review.user.handle}: "${review.trackName}" by ${review.trackArtist}`);
    console.log(`   Current ID: ${review.trackId}`);

    // Search Spotify for real track
    const spotifyTrack = await searchSpotifyTrack(review.trackName, review.trackArtist);

    if (spotifyTrack) {
      console.log(`   ✅ Found Spotify match: ${spotifyTrack.trackId}`);
      console.log(`      Name: ${spotifyTrack.name}`);
      console.log(`      Artist: ${spotifyTrack.artist}`);
      console.log(`      Album: ${spotifyTrack.album}`);

      // Update review with real Spotify track data
      await prisma.review.update({
        where: { id: review.id },
        data: {
          trackId: spotifyTrack.trackId,
          trackName: spotifyTrack.name, // Use Spotify's canonical name
          trackArtist: spotifyTrack.artist, // Use Spotify's canonical artist
          trackAlbum: spotifyTrack.album,
          artworkUrl: spotifyTrack.artworkUrl || review.artworkUrl,
        }
      });

      updatedCount++;
      console.log(`   ✅ Updated!`);
    } else {
      console.log(`   ⚠️  No Spotify match found - keeping Last.fm data`);
      console.log(`      (Experience will show preview mode only)`);
      notFoundCount++;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log(`   Total reviews checked: ${reviews.length}`);
  console.log(`   ✅ Updated with Spotify IDs: ${updatedCount}`);
  console.log(`   ⚠️  No Spotify match: ${notFoundCount}`);
  console.log('='.repeat(60) + '\n');

  await prisma.$disconnect();
  console.log('✨ Done!\n');
}

// Run the script
fixLastFmTrackIds().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
