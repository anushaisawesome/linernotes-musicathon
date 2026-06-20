import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/lyrics?isrc=... OR /api/lyrics?track=...&artist=...
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
  const track = searchParams.get("track");
  const artist = searchParams.get("artist");

  if (!isrc && (!track || !artist)) {
    return NextResponse.json(
      { error: "Either ISRC or track+artist parameters required" },
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
    let matcherUrl: string;

    // Step 1: Get track ID from ISRC or track/artist search
    if (isrc) {
      matcherUrl = `https://api.musixmatch.com/ws/1.1/matcher.track.get?format=json&track_isrc=${encodeURIComponent(isrc)}&apikey=${apiKey}`;
      console.log("[Musixmatch] Searching by ISRC:", isrc);
    } else {
      matcherUrl = `https://api.musixmatch.com/ws/1.1/matcher.track.get?format=json&q_track=${encodeURIComponent(track!)}&q_artist=${encodeURIComponent(artist!)}&apikey=${apiKey}`;
      console.log("[Musixmatch] Searching by track/artist:", track, "/", artist);
    }

    const matcherRes = await fetch(matcherUrl);
    if (!matcherRes.ok) {
      console.error("[Musixmatch] Matcher API error:", matcherRes.status);
      return NextResponse.json(
        { error: "Failed to find track" },
        { status: matcherRes.status }
      );
    }

    const matcherData = await matcherRes.json();
    console.log("[Musixmatch] Matcher response:", JSON.stringify(matcherData, null, 2));

    const trackData = matcherData.message?.body?.track;

    if (!trackData || !trackData.track_id) {
      console.log("[Musixmatch] No track found");
      return NextResponse.json(
        { error: "Track not found on Musixmatch", searched: isrc ? { isrc } : { track, artist } },
        { status: 404 }
      );
    }

    const trackId = trackData.track_id;
    console.log("[Musixmatch] Found track:", trackData.track_name, "by", trackData.artist_name, "ID:", trackId);

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
    console.log("[Musixmatch] Lyrics response structure:", JSON.stringify(lyricsData, null, 2).substring(0, 500));

    const subtitle = lyricsData.message?.body?.subtitle;

    if (!subtitle || !subtitle.subtitle_body) {
      console.log("[Musixmatch] No synced lyrics available for track ID:", trackId);
      return NextResponse.json(
        {
          track: {
            id: trackId,
            name: trackData.track_name,
            artist: trackData.artist_name,
          },
          lyrics: null,
          message: "No synced lyrics available for this track"
        },
        { status: 200 }
      );
    }

    console.log("[Musixmatch] Subtitle body type:", typeof subtitle.subtitle_body);
    console.log("[Musixmatch] Subtitle body preview:", JSON.stringify(subtitle.subtitle_body).substring(0, 200));

    // Parse subtitle format (JSON string with timing data)
    let parsedLyrics;
    try {
      // Check if subtitle_body is already an object or a string
      if (typeof subtitle.subtitle_body === 'string') {
        parsedLyrics = JSON.parse(subtitle.subtitle_body);
      } else {
        parsedLyrics = subtitle.subtitle_body;
      }
    } catch (error) {
      console.error("[Musixmatch] Failed to parse lyrics:", error);
      console.error("[Musixmatch] Subtitle body was:", subtitle.subtitle_body);
      return NextResponse.json(
        { error: "Invalid lyrics format" },
        { status: 500 }
      );
    }

    console.log("[Musixmatch] Successfully fetched synced lyrics for:", trackData.track_name);

    // Return lyrics with track metadata
    return NextResponse.json({
      track: {
        id: trackId,
        name: trackData.track_name,
        artist: trackData.artist_name,
        album: trackData.album_name || "",
        isrc: isrc || trackData.track_isrc,
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
