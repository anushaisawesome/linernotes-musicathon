import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST() {
  try {
    // Fix reviews with fake Last.fm/iTunes/MusicBrainz IDs
    // Get all reviews and filter in JavaScript (Prisma doesn't support regex)
    const allReviews = await prisma.review.findMany({
      select: {
        id: true,
        trackId: true,
        trackName: true,
        trackArtist: true,
      },
    });

    const brokenReviews = allReviews.filter(review => {
      const id = review.trackId;
      return (
        id.startsWith("lastfm-") ||
        /^[0-9]+$/.test(id) || // iTunes numeric IDs
        /^[a-f0-9]{8}-[a-f0-9]{4}/.test(id) // MusicBrainz UUIDs
      );
    });

    console.log("[Fix Reviews] Found", brokenReviews.length, "broken reviews");

    if (brokenReviews.length === 0) {
      return NextResponse.json({
        message: "No broken reviews found",
        total: 0,
        fixed: 0,
        failed: 0,
        details: { fixed: [], failed: [] },
      });
    }

    // Get Spotify access token using client credentials
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json({
        error: "Spotify credentials not configured"
      }, { status: 500 });
    }

    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenResponse.ok) {
      return NextResponse.json({
        error: "Failed to get Spotify access token"
      }, { status: 500 });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    const fixed = [];
    const failed = [];

    for (const review of brokenReviews) {
      try {
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

            fixed.push({
              name: review.trackName,
              oldId: review.trackId,
              newId: spotifyTrack.id,
            });
          } else {
            failed.push({ name: review.trackName, reason: "No Spotify match found" });
          }
        } else {
          failed.push({ name: review.trackName, reason: `Spotify API error: ${searchResponse.status}` });
        }
      } catch (error) {
        failed.push({ name: review.trackName, reason: String(error) });
      }

      // Add delay to avoid rate limiting (500ms = 2 req/sec = 120 req/min)
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return NextResponse.json({
      message: "Review backfill complete",
      total: brokenReviews.length,
      fixed: fixed.length,
      failed: failed.length,
      details: { fixed, failed },
    });
  } catch (error) {
    console.error("[Fix Reviews] Error:", error);
    return NextResponse.json(
      { error: "Failed to fix reviews" },
      { status: 500 }
    );
  }
}
