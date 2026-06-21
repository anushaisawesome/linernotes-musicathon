import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/spotify/token
 *
 * Returns Spotify access token for Web Playback SDK
 * Requires connected Spotify Premium account
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized - please log in" },
        { status: 401 }
      );
    }

    // Get user's Spotify connection
    const connection = await prisma.musicConnection.findFirst({
      where: {
        userId: session.user.id,
        service: "spotify",
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: "Spotify not connected - please connect your Spotify account in settings" },
        { status: 404 }
      );
    }

    // Check if token is expired and refresh if needed
    const now = new Date();
    const expiresAt = connection.expiresAt;

    if (expiresAt && now >= expiresAt && connection.refreshToken) {
      // Refresh the token
      const clientId = process.env.SPOTIFY_CLIENT_ID;
      const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return NextResponse.json(
          { error: "Spotify credentials not configured" },
          { status: 500 }
        );
      }

      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      const tokenUrl = "https://accounts.spotify.com/api/token";

      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: connection.refreshToken,
        }).toString(),
      });

      if (!response.ok) {
        console.error("[Spotify Token] Failed to refresh token:", response.status);
        return NextResponse.json(
          { error: "Failed to refresh Spotify token - please reconnect your Spotify account" },
          { status: 401 }
        );
      }

      const data = await response.json();

      // Update connection with new token
      await prisma.musicConnection.update({
        where: { id: connection.id },
        data: {
          accessToken: data.access_token,
          expiresAt: new Date(Date.now() + data.expires_in * 1000),
          // Spotify sometimes returns a new refresh token
          ...(data.refresh_token && { refreshToken: data.refresh_token }),
        },
      });

      return NextResponse.json({
        access_token: data.access_token,
        token_type: data.token_type,
        expires_in: data.expires_in,
      });
    }

    // Token is still valid
    if (!connection.accessToken) {
      return NextResponse.json(
        { error: "No Spotify access token - please reconnect your Spotify account" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      access_token: connection.accessToken,
      token_type: "Bearer",
      expires_in: expiresAt ? Math.floor((expiresAt.getTime() - now.getTime()) / 1000) : 3600,
    });

  } catch (error) {
    console.error("[Spotify Token] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
