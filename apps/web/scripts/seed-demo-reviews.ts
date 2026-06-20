#!/usr/bin/env tsx
/**
 * Seed demo reviews with lyric annotations for Musicathon
 * Creates reviews with thoughtful notes at key moments to showcase Experience feature
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

  if (!track) return null;

  return {
    trackId: track.id,
    trackName: track.name,
    trackArtist: track.artists[0].name,
    trackAlbum: track.album.name,
    artworkUrl: track.album.images[0]?.url || '',
    previewUrl: track.preview_url,
  };
}

interface DemoReview {
  trackName: string;
  artistName: string;
  rating: number;
  take: string;
  notes: Array<{
    seconds: number;
    label: string;
    note: string;
    lyric?: string;
  }>;
}

const demoReviews: DemoReview[] = [
  {
    trackName: "Bohemian Rhapsody",
    artistName: "Queen",
    rating: 5.0,
    take: "A six-minute operatic rock epic that defies all conventions and somehow works perfectly",
    notes: [
      {
        seconds: 55,
        label: "the piano break",
        note: "Freddie's piano intro builds such incredible tension before exploding into the chorus",
        lyric: "Mama, just killed a man"
      },
      {
        seconds: 170,
        label: "operatic section",
        note: "This shouldn't work but it's absolute genius - the vocal harmonies are insane",
        lyric: "Galileo, Galileo, Galileo Figaro"
      },
      {
        seconds: 247,
        label: "the headbanging moment",
        note: "Brian May's guitar solo here is one of the greatest rock moments ever recorded",
        lyric: "So you think you can stone me and spit in my eye?"
      }
    ]
  },
  {
    trackName: "Billie Jean",
    artistName: "Michael Jackson",
    rating: 5.0,
    take: "That bassline is one of the most iconic grooves ever laid down",
    notes: [
      {
        seconds: 44,
        label: "the hook",
        note: "The way MJ's voice locks in with the bassline here is pure perfection",
        lyric: "Billie Jean is not my lover"
      },
      {
        seconds: 175,
        label: "drum fill",
        note: "This snare fill into the final chorus gives me chills every time",
      },
      {
        seconds: 230,
        label: "the fadeout",
        note: "Never wants to end - could listen to this groove loop forever",
      }
    ]
  },
  {
    trackName: "Smells Like Teen Spirit",
    artistName: "Nirvana",
    rating: 4.5,
    take: "Raw teenage angst distilled into three and a half minutes of pure grunge perfection",
    notes: [
      {
        seconds: 24,
        label: "the drop",
        note: "When the full band kicks in after the quiet intro - iconic moment in rock history",
        lyric: "Load up on guns, bring your friends"
      },
      {
        seconds: 49,
        label: "chorus explosion",
        note: "Kurt's raspy scream here captures everything that made grunge revolutionary",
        lyric: "With the lights out, it's less dangerous"
      },
      {
        seconds: 160,
        label: "guitar solo",
        note: "Deliberately sloppy and perfect - anti-virtuoso at its finest",
      }
    ]
  },
  {
    trackName: "Wonderwall",
    artistName: "Oasis",
    rating: 4.0,
    take: "Overplayed? Maybe. But there's a reason every person with a guitar learns this one",
    notes: [
      {
        seconds: 96,
        label: "the bridge",
        note: "Liam's delivery on this bridge is what makes the whole song",
        lyric: "I said maybe, you're gonna be the one that saves me"
      },
      {
        seconds: 132,
        label: "final chorus",
        note: "The strings coming in here add such emotional weight",
        lyric: "After all, you're my wonderwall"
      }
    ]
  },
  {
    trackName: "Dreams",
    artistName: "Fleetwood Mac",
    rating: 5.0,
    take: "Stevie Nicks at her ethereal best - the production on this is timeless",
    notes: [
      {
        seconds: 16,
        label: "vocals enter",
        note: "Stevie's voice floating over that drum groove is pure magic",
        lyric: "Now here you go again, you say you want your freedom"
      },
      {
        seconds: 52,
        label: "the hook",
        note: "The way 'thunder only happens when it's raining' sits on the beat is genius",
        lyric: "Thunder only happens when it's raining"
      },
      {
        seconds: 185,
        label: "fadeout groove",
        note: "Could listen to this drum/bass pocket forever - Mick and John are locked in",
      }
    ]
  },
  {
    trackName: "Superstition",
    artistName: "Stevie Wonder",
    rating: 5.0,
    take: "That clavinet riff is burned into my brain forever - funk perfection",
    notes: [
      {
        seconds: 0,
        label: "opening riff",
        note: "One of the most recognizable instrumental openings in music history",
      },
      {
        seconds: 31,
        label: "horn stabs",
        note: "These horn hits are so crisp and punchy - the arrangement is perfect",
        lyric: "Superstition ain't the way"
      },
      {
        seconds: 155,
        label: "drum break",
        note: "The drum fill here is so satisfying - that Stevie Wonder pocket",
      }
    ]
  }
];

async function seedDemoReviews() {
  console.log('🎵 Seeding demo reviews for Musicathon...\n');

  const token = await getSpotifyToken();
  console.log('✓ Got Spotify access token\n');

  // Find or create demo user
  let demoUser = await prisma.user.findUnique({
    where: { handle: 'musicathon' }
  });

  if (!demoUser) {
    demoUser = await prisma.user.create({
      data: {
        email: 'demo@linernotes.app',
        handle: 'musicathon',
        displayName: 'Musicathon Demo',
        bio: 'Showcasing the LinerNotes Experience feature',
      }
    });
    console.log('✓ Created demo user: @musicathon\n');
  } else {
    console.log('✓ Using existing demo user: @musicathon\n');
  }

  let created = 0;
  let skipped = 0;

  for (const demo of demoReviews) {
    try {
      console.log(`Processing: ${demo.trackName} - ${demo.artistName}`);

      // Search Spotify for track metadata
      const trackData = await searchSpotifyTrack(token, demo.trackName, demo.artistName);

      if (!trackData) {
        console.log(`  ⚠ Could not find track on Spotify, skipping\n`);
        skipped++;
        continue;
      }

      // Check if review already exists
      const existing = await prisma.review.findFirst({
        where: {
          userId: demoUser.id,
          trackId: trackData.trackId,
        }
      });

      if (existing) {
        console.log(`  → Already exists, skipping\n`);
        skipped++;
        continue;
      }

      // Create review with notes
      const review = await prisma.review.create({
        data: {
          userId: demoUser.id,
          trackId: trackData.trackId,
          trackName: trackData.trackName,
          trackArtist: trackData.trackArtist,
          trackAlbum: trackData.trackAlbum,
          artworkUrl: trackData.artworkUrl,
          previewUrl: trackData.previewUrl,
          rating: demo.rating,
          take: demo.take,
          notes: {
            create: demo.notes.map(note => ({
              seconds: note.seconds,
              label: note.label,
              note: note.note,
              lyric: note.lyric,
            }))
          }
        },
        include: {
          notes: true,
        }
      });

      console.log(`  ✓ Created review with ${review.notes.length} annotated moments`);
      console.log(`  → View at: /experience/${review.id}\n`);
      created++;

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`  ✗ Error: ${error}\n`);
      skipped++;
    }
  }

  console.log(`\n✓ Done! Created ${created} reviews, skipped ${skipped}`);
  console.log(`\nVisit the demo user profile: /profile/musicathon`);
}

seedDemoReviews()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
