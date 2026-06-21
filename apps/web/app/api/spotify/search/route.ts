import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getSpotifyToken(userId?: string) {
  // Try to use user's own Spotify token first (no rate limits)
  if (userId) {
    try {
      const connection = await prisma.musicConnection.findUnique({
        where: { userId_service: { userId, service: "spotify" } },
      });

      if (connection?.accessToken) {
        // Check if token is still valid
        if (!connection.expiresAt || connection.expiresAt > new Date()) {
          return connection.accessToken;
        }
      }
    } catch (error) {
      console.error("[Spotify Search] Failed to get user token:", error);
    }
  }

  // Fallback to client credentials (rate limited)
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Spotify credentials not configured");
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
    throw new Error(`Token request failed: ${tokenResponse.status}`);
  }

  const data = await tokenResponse.json();
  return data.access_token;
}

/**
 * GET /api/spotify/search - Search Spotify for tracks
 * Returns REAL Spotify track IDs for playback
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");
  // This Spotify app (dev mode, client-credentials) rejects search limits > 10
  // with HTTP 400 "Invalid limit". Clamp to the working ceiling so callers that
  // ask for more (e.g. the log composer requests 20) don't 400 on every keystroke.
  const requestedLimit = parseInt(searchParams.get("limit") || "10");
  const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 10, 1), 10);
  // Offset lets the UI page through results ("show more"). Spotify requires
  // offset + limit <= 1000, so cap accordingly.
  const requestedOffset = parseInt(searchParams.get("offset") || "0");
  const offset = Math.min(Math.max(Number.isFinite(requestedOffset) ? requestedOffset : 0, 0), 1000 - limit);

  if (!query || query.trim().length < 1) {
    return NextResponse.json(
      { error: "Query required" },
      { status: 400 }
    );
  }

  try {
    // Get user session to use their Spotify token (avoids rate limits)
    const session = await auth();
    const userId = session?.user?.id;

    // Get Spotify access token (user's token if logged in, else client credentials)
    const access_token = await getSpotifyToken(userId);

    // Search Spotify
    const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}&offset=${offset}`;
    const searchResponse = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!searchResponse.ok) {
      console.error("[Spotify Search] Search failed:", searchResponse.status);
      return NextResponse.json(
        { error: "Spotify search failed" },
        { status: searchResponse.status }
      );
    }

    const searchData = await searchResponse.json();
    const tracks = searchData.tracks?.items || [];

    // Transform to our format
    const results = tracks.map((track: any) => {
      // Spotify images are ordered by size (largest first)
      // Get highest quality artwork (640x640 or larger)
      const images = track.album.images || [];
      const artworkUrl = images.find((img: any) => img.width >= 640)?.url || images[0]?.url || "";

      return {
        trackId: track.id, // REAL Spotify ID
        name: track.name,
        artist: track.artists.map((a: any) => a.name).join(", "),
        album: track.album.name,
        artworkUrl,
        previewUrl: track.preview_url,
        duration: track.duration_ms,
        releaseDate: track.album.release_date,
        source: "spotify",
      };
    });

    return NextResponse.json({
      tracks: results,
      count: results.length,
    });
  } catch (error) {
    console.error("[Spotify Search] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
