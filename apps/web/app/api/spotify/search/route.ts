import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/spotify/search - Search Spotify for tracks
 * Returns REAL Spotify track IDs for playback
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");
  const limit = parseInt(searchParams.get("limit") || "20");

  if (!query || query.trim().length < 1) {
    return NextResponse.json(
      { error: "Query required" },
      { status: 400 }
    );
  }

  try {
    // Get Spotify access token (client credentials flow)
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Spotify credentials not configured" },
        { status: 500 }
      );
    }

    // Get access token
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenResponse.ok) {
      console.error("[Spotify Search] Token request failed:", tokenResponse.status);
      return NextResponse.json(
        { error: "Failed to get Spotify token" },
        { status: 500 }
      );
    }

    const { access_token } = await tokenResponse.json();

    // Search Spotify
    const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`;
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
    const results = tracks.map((track: any) => ({
      trackId: track.id, // REAL Spotify ID
      name: track.name,
      artist: track.artists.map((a: any) => a.name).join(", "),
      album: track.album.name,
      artworkUrl: track.album.images[0]?.url || "",
      previewUrl: track.preview_url,
      duration: track.duration_ms,
      releaseDate: track.album.release_date,
      source: "spotify",
    }));

    return NextResponse.json({
      tracks: results,
      count: results.length,
    });
  } catch (error) {
    console.error("[Spotify Search] Error:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
