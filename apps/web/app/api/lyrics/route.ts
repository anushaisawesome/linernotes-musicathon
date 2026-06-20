import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/lyrics?isrc=...
 *
 * Fetches synced lyrics from Musixmatch Pro API.
 *
 * IMPORTANT RULES:
 * - Never persist lyrics (no DB/disk/localStorage)
 * - In-memory only, fetched live per track
 * - Server-side only (API key never exposed to client)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const isrc = searchParams.get("isrc");

  if (!isrc) {
    return NextResponse.json(
      { error: "ISRC parameter is required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.MUSIXMATCH_API_KEY;
  if (!apiKey) {
    console.error("[Musixmatch] API key not configured");
    return NextResponse.json(
      { error: "Musixmatch API not configured" },
      { status: 500 }
    );
  }

  try {
    // Step 1: Get track ID from ISRC
    const matcherUrl = `https://api.musixmatch.com/ws/1.1/matcher.track.get?format=json&track_isrc=${encodeURIComponent(isrc)}&apikey=${apiKey}`;

    const matcherRes = await fetch(matcherUrl);
    if (!matcherRes.ok) {
      console.error("[Musixmatch] Matcher API error:", matcherRes.status);
      return NextResponse.json(
        { error: "Failed to find track" },
        { status: matcherRes.status }
      );
    }

    const matcherData = await matcherRes.json();
    const track = matcherData.message?.body?.track;

    if (!track || !track.track_id) {
      console.log("[Musixmatch] No track found for ISRC:", isrc);
      return NextResponse.json(
        { error: "Track not found", isrc },
        { status: 404 }
      );
    }

    const trackId = track.track_id;
    console.log("[Musixmatch] Found track:", track.track_name, "by", track.artist_name, "ID:", trackId);

    // Step 2: Get synced lyrics (subtitle.get for line-by-line timing)
    const lyricsUrl = `https://api.musixmatch.com/ws/1.1/track.subtitle.get?format=json&track_id=${trackId}&apikey=${apiKey}`;

    const lyricsRes = await fetch(lyricsUrl);
    if (!lyricsRes.ok) {
      console.error("[Musixmatch] Lyrics API error:", lyricsRes.status);
      return NextResponse.json(
        { error: "Failed to fetch lyrics" },
        { status: lyricsRes.status }
      );
    }

    const lyricsData = await lyricsRes.json();
    const subtitle = lyricsData.message?.body?.subtitle;

    if (!subtitle || !subtitle.subtitle_body) {
      console.log("[Musixmatch] No synced lyrics available for track ID:", trackId);
      return NextResponse.json(
        {
          track: {
            id: trackId,
            name: track.track_name,
            artist: track.artist_name,
          },
          lyrics: null,
          message: "No synced lyrics available for this track"
        },
        { status: 200 }
      );
    }

    // Parse subtitle format (JSON string with timing data)
    let parsedLyrics;
    try {
      parsedLyrics = JSON.parse(subtitle.subtitle_body);
    } catch (error) {
      console.error("[Musixmatch] Failed to parse lyrics:", error);
      return NextResponse.json(
        { error: "Invalid lyrics format" },
        { status: 500 }
      );
    }

    console.log("[Musixmatch] Successfully fetched synced lyrics for:", track.track_name);

    // Return lyrics with track metadata
    return NextResponse.json({
      track: {
        id: trackId,
        name: track.track_name,
        artist: track.artist_name,
        album: track.album_name || "",
        isrc: isrc,
      },
      lyrics: parsedLyrics,
      subtitle_language: subtitle.subtitle_language,
      restricted: subtitle.restricted === 1,
    });

  } catch (error) {
    console.error("[Musixmatch] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
