import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local
config({ path: resolve(__dirname, "../.env.local") });

import { prisma } from "../src/lib/prisma";

async function fixReviews() {
  try {
    console.log("[Fix Reviews] Starting...");

    // Find reviews with fake Last.fm/iTunes/MusicBrainz IDs
    const brokenReviews = await prisma.review.findMany({
      where: {
        OR: [
          { trackId: { startsWith: "lastfm-" } },
          { trackId: { regex: "^[0-9]+$" } }, // iTunes numeric IDs
          { trackId: { regex: "^[a-f0-9]{8}-[a-f0-9]{4}" } }, // MusicBrainz UUIDs
        ],
      },
      select: {
        id: true,
        trackId: true,
        trackName: true,
        trackArtist: true,
        userId: true,
      },
    });

    console.log(`[Fix Reviews] Found ${brokenReviews.length} broken reviews`);

    if (brokenReviews.length === 0) {
      console.log("[Fix Reviews] No broken reviews to fix!");
      return;
    }

    // Get Spotify credentials
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error("[Fix Reviews] Spotify credentials not configured");
      return;
    }

    // Get client credentials token
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenResponse.ok) {
      console.error("[Fix Reviews] Failed to get Spotify token");
      return;
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    const fixed = [];
    const failed = [];

    for (const review of brokenReviews) {
      try {
        console.log(`[Fix Reviews] Processing: ${review.trackName} by ${review.trackArtist}`);

        const query = encodeURIComponent(`${review.trackName} ${review.trackArtist}`);
        const searchUrl = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`;
        const searchResponse = await fetch(searchUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const spotifyTrack = searchData.tracks?.items?.[0];

          if (spotifyTrack) {
            const images = spotifyTrack.album.images || [];
            const artworkUrl = images.find((img: any) => img.width >= 640)?.url || images[0]?.url || "";

            await prisma.review.update({
              where: { id: review.id },
              data: {
                trackId: spotifyTrack.id,
                artworkUrl,
                trackAlbum: spotifyTrack.album.name,
              },
            });

            console.log(`[Fix Reviews] ✓ Fixed: ${review.trackName} - ${review.trackId} → ${spotifyTrack.id}`);
            fixed.push({
              name: review.trackName,
              oldId: review.trackId,
              newId: spotifyTrack.id,
            });
          } else {
            console.log(`[Fix Reviews] ✗ No Spotify match found for: ${review.trackName}`);
            failed.push({ name: review.trackName, reason: "No Spotify match found" });
          }
        } else {
          console.log(`[Fix Reviews] ✗ Spotify API error ${searchResponse.status} for: ${review.trackName}`);
          failed.push({ name: review.trackName, reason: `Spotify API error: ${searchResponse.status}` });
        }

        // Add a small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`[Fix Reviews] ✗ Error processing ${review.trackName}:`, error);
        failed.push({ name: review.trackName, reason: String(error) });
      }
    }

    console.log("\n[Fix Reviews] Complete!");
    console.log(`Total: ${brokenReviews.length}`);
    console.log(`Fixed: ${fixed.length}`);
    console.log(`Failed: ${failed.length}`);

    if (fixed.length > 0) {
      console.log("\nFixed reviews:");
      fixed.forEach(f => console.log(`  - ${f.name}: ${f.oldId} → ${f.newId}`));
    }

    if (failed.length > 0) {
      console.log("\nFailed reviews:");
      failed.forEach(f => console.log(`  - ${f.name}: ${f.reason}`));
    }
  } catch (error) {
    console.error("[Fix Reviews] Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fixReviews();
