import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const trackId = request.nextUrl.searchParams.get("trackId");

  if (!trackId) {
    return NextResponse.json({ error: "trackId required" }, { status: 400 });
  }

  try {
    // Get client credentials token
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

    // Get track info
    const trackResponse = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!trackResponse.ok) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    const track = await trackResponse.json();

    return NextResponse.json({
      id: track.id,
      name: track.name,
      artists: track.artists.map((a: any) => a.name).join(", "),
      album: track.album.name,
      images: track.album.images,
      artworkUrl: track.album.images[0]?.url || "",
    });
  } catch (error) {
    console.error("Get track info error:", error);
    return NextResponse.json({ error: "Failed to get track info" }, { status: 500 });
  }
}
