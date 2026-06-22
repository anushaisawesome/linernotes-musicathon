import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    // Get Spotify access token
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get track info from Spotify
    const trackResponse = await fetch("https://api.spotify.com/v1/tracks/3V0PgcsUMlAGXwCD0084pY", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const track = await trackResponse.json();
    const images = track.album.images || [];
    const artworkUrl = images.find((img: any) => img.width >= 640)?.url || images[0]?.url || "";

    // Find the pink diamond review
    const review = await prisma.review.findFirst({
      where: {
        trackName: "pink diamond",
        trackArtist: { contains: "Charli" },
      },
    });

    if (!review) {
      return NextResponse.json({ error: "Pink diamond review not found" }, { status: 404 });
    }

    console.log("[Fix Pink Diamond] Found review:", review.id, review.trackId);

    // Update with real Spotify ID for "Pink Diamond" by Charli XCX
    const updated = await prisma.review.update({
      where: { id: review.id },
      data: {
        trackId: "3V0PgcsUMlAGXwCD0084pY",
        trackAlbum: track.album.name,
        artworkUrl,
        previewUrl: track.preview_url || null,
      },
    });

    console.log("[Fix Pink Diamond] ✓ Fixed successfully!");

    return NextResponse.json({
      message: "Pink diamond review fixed!",
      oldId: review.trackId,
      newId: updated.trackId,
    });
  } catch (error) {
    console.error("[Fix Pink Diamond] Error:", error);
    return NextResponse.json(
      { error: "Failed to fix review" },
      { status: 500 }
    );
  }
}
