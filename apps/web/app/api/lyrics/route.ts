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
    let trackData: any = null;

    // Step 1: Get track ID from ISRC or track/artist search (with fallback retry)
    if (isrc) {
      const isrcUrl = `https://api.musixmatch.com/ws/1.1/matcher.track.get?format=json&track_isrc=${encodeURIComponent(isrc)}&apikey=${apiKey}`;
      console.log("[Musixmatch] Searching by ISRC:", isrc);

      const isrcRes = await fetch(isrcUrl);
      if (isrcRes.ok) {
        const isrcData = await isrcRes.json();
        trackData = isrcData.message?.body?.track;
      }

      // If ISRC failed and we have track/artist, retry with track/artist
      if (!trackData && track && artist) {
        console.log("[Musixmatch] ISRC search failed, retrying with track/artist:", track, "/", artist);
        const nameUrl = `https://api.musixmatch.com/ws/1.1/matcher.track.get?format=json&q_track=${encodeURIComponent(track)}&q_artist=${encodeURIComponent(artist)}&apikey=${apiKey}`;

        const nameRes = await fetch(nameUrl);
        if (nameRes.ok) {
          const nameData = await nameRes.json();
          trackData = nameData.message?.body?.track;
        }
      }
    } else {
      // Search by track/artist
      const nameUrl = `https://api.musixmatch.com/ws/1.1/matcher.track.get?format=json&q_track=${encodeURIComponent(track!)}&q_artist=${encodeURIComponent(artist!)}&apikey=${apiKey}`;
      console.log("[Musixmatch] Searching by track/artist:", track, "/", artist);

      const nameRes = await fetch(nameUrl);
      if (nameRes.ok) {
        const nameData = await nameRes.json();
        trackData = nameData.message?.body?.track;
      }
    }

    if (!trackData || !trackData.track_id) {
      console.log("[Musixmatch] No track found after all attempts");
      return NextResponse.json(
        { error: "Track not found on Musixmatch", searched: isrc ? { isrc, fallback: track && artist } : { track, artist } },
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
      console.log("[Musixmatch] No synced lyrics available, trying plain lyrics");

      // Fallback to plain lyrics (no timestamps)
      const plainLyricsUrl = `https://api.musixmatch.com/ws/1.1/track.lyrics.get?format=json&track_id=${trackId}&apikey=${apiKey}`;
      const plainLyricsRes = await fetch(plainLyricsUrl);

      if (plainLyricsRes.ok) {
        const plainLyricsData = await plainLyricsRes.json();
        const plainLyrics = plainLyricsData.message?.body?.lyrics?.lyrics_body;

        if (plainLyrics && typeof plainLyrics === 'string') {
          console.log("[Musixmatch] Found plain lyrics, creating pseudo-timestamps");

          // Split into lines and create timestamps (one line every 3 seconds)
          const lines = plainLyrics.split('\n').filter(line => line.trim());
          const parsedLyrics = lines.map((line, idx) => ({
            text: line.trim(),
            time: {
              total: idx * 3000, // 3 seconds apart
              minutes: Math.floor((idx * 3) / 60),
              seconds: (idx * 3) % 60,
              hundredths: 0,
            },
          }));

          console.log("[Musixmatch] Created", parsedLyrics.length, "pseudo-synced lines");

          return NextResponse.json({
            track: {
              id: trackId,
              name: trackData.track_name,
              artist: trackData.artist_name,
              album: trackData.album_name || "",
              isrc: isrc || trackData.track_isrc,
              language: trackData.track_language || "en",
            },
            lyrics: parsedLyrics,
            translation: null,
            subtitle_language: trackData.track_language || "en",
            restricted: false,
            unsynced: true, // Flag that these are fake timestamps
          });
        }
      }

      console.log("[Musixmatch] No lyrics available at all for track ID:", trackId);
      return NextResponse.json(
        {
          track: {
            id: trackId,
            name: trackData.track_name,
            artist: trackData.artist_name,
          },
          lyrics: null,
          message: "No lyrics available for this track"
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
        // Try multiple translation endpoints
        // First try: track.lyrics.translation.get with comment_format=text
        const translationUrl = `https://api.musixmatch.com/ws/1.1/track.lyrics.translation.get?format=json&track_id=${trackId}&selected_language=en&comment_format=text&apikey=${apiKey}`;

        console.log("[Musixmatch] Trying translation URL:", translationUrl);
        const translationRes = await fetch(translationUrl);
        if (translationRes.ok) {
          const translationData = await translationRes.json();
          console.log("[Musixmatch] Full translation response:", JSON.stringify(translationData, null, 2));

          // Check for translated lyrics (not original)
          const lyricsTranslated = translationData.message?.body?.lyrics?.lyrics_translated?.lyrics_body;
          const selectedLanguage = translationData.message?.body?.lyrics?.lyrics_translated?.selected_language;

          console.log("[Musixmatch] Translated lyrics body:", lyricsTranslated ? `found (${lyricsTranslated.substring(0, 100)}...)` : "not found");
          console.log("[Musixmatch] Selected language:", selectedLanguage || "unknown");

          if (lyricsTranslated && typeof lyricsTranslated === 'string' && lyricsTranslated.length > 0) {
            // We have translated lyrics from Musixmatch
            console.log("[Musixmatch] Found English translation in lyrics_translated.lyrics_body");

            const translatedLines = lyricsTranslated.split('\n').filter((line: string) => line.trim());

            // Match by position since we don't have timestamps
            translation = parsedLyrics.map((originalLine, idx) => {
              const translatedText = translatedLines[idx];
              if (translatedText && translatedText.trim()) {
                return {
                  text: translatedText.trim(),
                  time: originalLine.time,
                };
              }
              return originalLine;
            });

            const translatedCount = translation.filter((line, idx) => line.text !== parsedLyrics[idx].text).length;
            console.log("[Musixmatch] Mapped", translatedCount, "of", parsedLyrics.length, "lines to English translations");
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
