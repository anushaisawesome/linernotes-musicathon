import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * GET /api/spotify/token
 *
 * Returns Spotify access token for Web Playback SDK
 * Requires Premium Spotify account
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // For now, we'll use the Spotify client credentials flow
    // In production, this would use the user's Spotify OAuth token
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Spotify credentials not configured" },
        { status: 500 }
      );
    }

    // Get access token using client credentials
    const tokenUrl = "https://accounts.spotify.com/api/token";
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${credentials}`,
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      console.error("[Spotify Token] Failed to get token:", response.status);
      return NextResponse.json(
        { error: "Failed to get Spotify token" },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      access_token: data.access_token,
      token_type: data.token_type,
      expires_in: data.expires_in,
    });

  } catch (error) {
    console.error("[Spotify Token] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
