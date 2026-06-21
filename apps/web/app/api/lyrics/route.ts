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

    // Parse LRC format (e.g., "[00:04.50] Lyric text")
    let parsedLyrics: Array<{ text: string; time: { total: number; minutes: number; seconds: number; hundredths: number } }>;

    try {
      const subtitleText = typeof subtitle.subtitle_body === 'string'
        ? subtitle.subtitle_body
        : JSON.stringify(subtitle.subtitle_body);

      if (!subtitleText || subtitleText.trim() === '') {
        throw new Error("Subtitle body is empty");
      }

      // Parse LRC format: [MM:SS.xx] Text
      const lines = subtitleText.split('\n');
      parsedLyrics = [];

      for (const line of lines) {
        // Match LRC timestamp format: [MM:SS.xx] or [MM:SS]
        const match = line.match(/^\[(\d{2}):(\d{2})\.?(\d{2})?\]\s*(.*)$/);
        if (match) {
          const [, minutes, seconds, centiseconds = '0', text] = match;
          const mins = parseInt(minutes);
          const secs = parseInt(seconds);
          const cents = parseInt(centiseconds);
          const totalMs = (mins * 60 * 1000) + (secs * 1000) + (cents * 10);

          if (text.trim()) { // Only include lines with actual text
            parsedLyrics.push({
              text: text.trim(),
              time: {
                total: totalMs,
                minutes: mins,
                seconds: secs,
                hundredths: cents,
              },
            });
          }
        }
      }

      if (parsedLyrics.length === 0) {
        throw new Error("No valid lyric lines found in LRC format");
      }

      console.log("[Musixmatch] Parsed", parsedLyrics.length, "lyric lines from LRC format");
    } catch (error) {
      console.error("[Musixmatch] Failed to parse lyrics:", error);
      console.error("[Musixmatch] Subtitle body preview:", typeof subtitle.subtitle_body === 'string' ? subtitle.subtitle_body.substring(0, 200) : subtitle.subtitle_body);
      return NextResponse.json(
        { error: `Invalid lyrics format: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    console.log("[Musixmatch] Successfully fetched synced lyrics for:", trackData.track_name);

    // Step 3: Fetch translation if track is in a non-English language
    let translation: typeof parsedLyrics | null = null;
    const originalLanguage = subtitle.subtitle_language || trackData.track_language || "";
    const isNonEnglish = originalLanguage && !originalLanguage.toLowerCase().startsWith('en');

    if (isNonEnglish) {
      console.log("[Musixmatch] Track is in", originalLanguage, "- fetching English translation");

      try {
        // Try subtitle translation endpoint first (more likely to have synced translations)
        const translationUrl = `https://api.musixmatch.com/ws/1.1/track.subtitle.translation.get?format=json&track_id=${trackId}&subtitle_format=lrc&selected_language=en&apikey=${apiKey}`;

        const translationRes = await fetch(translationUrl);
        if (translationRes.ok) {
          const translationData = await translationRes.json();
          console.log("[Musixmatch] Full translation response:", JSON.stringify(translationData, null, 2));

          // Try subtitle translation format (LRC)
          const subtitleBody = translationData.message?.body?.subtitle?.subtitle_body;
          const lyricsBody = translationData.message?.body?.lyrics?.lyrics_body;

          console.log("[Musixmatch] Subtitle body:", subtitleBody ? "found" : "not found");
          console.log("[Musixmatch] Lyrics body:", lyricsBody ? "found" : "not found");

          if (subtitleBody && typeof subtitleBody === 'string') {
            // Translation came as subtitle in LRC format - parse it
            console.log("[Musixmatch] Translation came as subtitle_body (LRC format), parsing...");

            const lrcLines = subtitleBody.split('\n').filter((line: string) => line.trim());
            const translatedParsed: typeof parsedLyrics = [];

            for (const line of lrcLines) {
              const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2})\]\s*(.+)/);
              if (match) {
                const [, minutes, seconds, centiseconds, text] = match;
                const totalMs = (parseInt(minutes) * 60 + parseInt(seconds)) * 1000 + parseInt(centiseconds) * 10;
                translatedParsed.push({
                  text: text.trim(),
                  time: { total: totalMs, minutes: parseInt(minutes), seconds: parseInt(seconds), hundredths: parseInt(centiseconds) },
                });
              }
            }

            console.log("[Musixmatch] Parsed", translatedParsed.length, "translated lines from LRC subtitle");

            // Match by timestamp
            translation = parsedLyrics.map((originalLine) => {
              const match = translatedParsed.find(t => t.time.total === originalLine.time.total);
              return match || originalLine;
            });
          } else if (lyricsBody && typeof lyricsBody === 'string') {
            // Translation came as plain lyrics body - need to parse and match
            console.log("[Musixmatch] Translation came as lyrics_body, parsing...");
            const translatedLines = lyricsBody.split('\n').filter((line: string) => line.trim());

            translation = parsedLyrics.map((originalLine, idx) => {
              return {
                text: translatedLines[idx] || originalLine.text,
                time: originalLine.time,
              };
            });

            console.log("[Musixmatch] Parsed", translation.length, "translated lines from lyrics_body");
          } else {
            console.log("[Musixmatch] No translation available for this track");
          }
        } else {
          console.log("[Musixmatch] Translation API returned status:", translationRes.status);
        }
      } catch (translationError) {
        console.error("[Musixmatch] Failed to fetch translation:", translationError);
        // Continue without translation - not a critical error
      }
    }

    // Return lyrics with track metadata and optional translation
    return NextResponse.json({
      track: {
        id: trackId,
        name: trackData.track_name,
        artist: trackData.artist_name,
        album: trackData.album_name || "",
        isrc: isrc || trackData.track_isrc,
        language: originalLanguage,
      },
      lyrics: parsedLyrics,
      translation: translation,
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
