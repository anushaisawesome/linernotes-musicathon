import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { paletteFromString } from "@/lib/palette";

/**
 * Generate Last.fm API signature
 */
function generateSignature(params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("");
  return crypto.createHash("md5").update(sorted + secret).digest("hex");
}

interface LastFmTrack {
  name: string;
  artist: { "#text": string } | string;
  album: { "#text": string } | string;
  image: Array<{ "#text": string; size: string }>;
  playcount?: string;
  mbid?: string;
}

/**
 * Extract artist name from Last.fm track data (handles both string and object formats)
 */
function getArtistName(artist: any): string {
  if (!artist) return "";
  if (typeof artist === "string") return artist;
  if (artist.name) return artist.name; // For user.getTopTracks format
  if (artist["#text"]) return artist["#text"]; // For user.getRecentTracks format
  if (artist.mbid) return ""; // Has MBID but no name - shouldn't happen but return empty to skip
  return "";
}

/**
 * Extract album name from Last.fm track data (handles both string and object formats)
 */
function getAlbumName(album: any): string {
  if (!album) return "";
  if (typeof album === "string") return album;
  if (album.title) return album.title; // track.getinfo uses this
  if (album.name) return album.name; // Some API responses use this
  if (album["#text"]) return album["#text"]; // Most common format
  return "";
}

interface Prompt {
  id: string;
  type: string;
  track: string;
  artist: string;
  album: string;
  playCount?: number;
  prompt: string;
  tag: string;
  artworkUrl?: string;
  palette: {
    deep: string;
    mid: string;
    lo: string;
    accent: string;
    glow: string;
  };
}

/**
 * Fetch track info from Last.fm to get better artwork and album name
 */
async function fetchLastFmTrackInfo(track: string, artist: string, apiKey: string): Promise<{ artwork: string; album: string }> {
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=track.getinfo&api_key=${apiKey}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&format=json`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      // Last.fm track.getinfo returns album.title OR album["#text"]
      const albumName = data.track?.album?.title || data.track?.album?.["#text"] || "";
      const artwork = data.track?.album?.image?.find((img: any) => img.size === "mega" || img.size === "extralarge" || img.size === "large" || img.size === "medium")?. ["#text"] || "";

      console.log("[Last.fm Prompts] track.getinfo response for", track, ":", { albumName, hasArtwork: !!artwork });

      return {
        artwork: (artwork && !artwork.includes("2a96cbd8b46e442fc41c2b86b821562f")) ? artwork : "",
        album: albumName,
      };
    }
  } catch (error) {
    console.error("[Last.fm Prompts] track.getinfo error:", error);
  }
  return { artwork: "", album: "" };
}

/**
 * Fetch album info from Last.fm to get better artwork
 */
async function fetchLastFmAlbumInfo(album: string, artist: string, apiKey: string): Promise<string> {
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=${apiKey}&artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}&format=json`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.album?.image) {
        const artwork = data.album.image.find((img: any) => img.size === "mega" || img.size === "extralarge" || img.size === "large" || img.size === "medium")?. ["#text"];
        if (artwork && !artwork.includes("2a96cbd8b46e442fc41c2b86b821562f")) {
          return artwork;
        }
      }
    }
  } catch (error) {
    console.error("[Last.fm Prompts] album.getinfo error:", error);
  }
  return "";
}

/**
 * Validate album name against Spotify and get correct metadata
 * Returns { album: string; artwork: string }
 */
async function validateWithSpotify(track: string, artist: string, lastfmAlbum: string): Promise<{ album: string; artwork: string }> {
  try {
    // Search Spotify for this track
    const trackSearchUrl = `${process.env.NEXTAUTH_URL}/api/music/search/tracks?q=${encodeURIComponent(`${track} ${artist}`)}&limit=1`;
    const res = await fetch(trackSearchUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.tracks?.[0]) {
        const spotifyTrack = data.tracks[0];
        const spotifyAlbum = spotifyTrack.album?.name || "";
        const spotifyArtwork = spotifyTrack.album?.artworkUrl || "";

        // If Spotify has the track, use Spotify's album name and artwork
        if (spotifyAlbum) {
          console.log(`[Last.fm Prompts] Spotify validation for "${track}":`, {
            lastfmAlbum,
            spotifyAlbum,
            using: spotifyAlbum,
          });
          return { album: spotifyAlbum, artwork: spotifyArtwork };
        }
      }
    }
  } catch (error) {
    console.error("[Last.fm Prompts] Spotify validation error:", error);
  }

  // If Spotify doesn't have it, fall back to Last.fm data
  return { album: lastfmAlbum, artwork: "" };
}

/**
 * Fetch album artwork from MusicBrainz/iTunes if Last.fm doesn't have it
 */
async function fetchFallbackArtwork(track: string, artist: string, album: string): Promise<string> {
  try {
    // Try searching for the album first
    if (album) {
      const searchUrl = `${process.env.NEXTAUTH_URL}/api/music/search/albums?q=${encodeURIComponent(`${album} ${artist}`)}&limit=1`;
      const res = await fetch(searchUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.albums?.[0]?.artworkUrl) {
          return data.albums[0].artworkUrl;
        }
      }
    }

    // Fall back to track search
    const trackSearchUrl = `${process.env.NEXTAUTH_URL}/api/music/search/tracks?q=${encodeURIComponent(`${track} ${artist}`)}&limit=1`;
    const res = await fetch(trackSearchUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.tracks?.[0]?.album?.artworkUrl) {
        return data.tracks[0].album.artworkUrl;
      }
    }
  } catch (error) {
    console.error("[Last.fm Prompts] Fallback artwork fetch error:", error);
  }

  return "";
}

/**
 * GET /api/lastfm/prompts - Get "worth a note" prompts from Last.fm listening history
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth();

    // Check if user has Last.fm connected
    const connection = await prisma.musicConnection.findFirst({
      where: {
        userId: user.id,
        service: "lastfm",
      },
    });

    if (!connection || !connection.sessionKey || !connection.serviceUsername) {
      return NextResponse.json({ prompts: [] });
    }

    const apiKey = process.env.LASTFM_API_KEY;
    const apiSecret = process.env.LASTFM_API_SECRET;

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Last.fm API not configured" },
        { status: 500 }
      );
    }

    // Fetch recent tracks from Last.fm (increased to 200 for more variety)
    const recentTracksUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${connection.serviceUsername}&api_key=${apiKey}&format=json&limit=200`;

    const recentResponse = await fetch(recentTracksUrl);
    if (!recentResponse.ok) {
      throw new Error("Failed to fetch Last.fm recent tracks");
    }

    const recentData = await recentResponse.json();
    const tracks: LastFmTrack[] = recentData.recenttracks?.track || [];

    console.log("[Last.fm Prompts] Recent tracks count:", tracks.length);
    if (tracks.length > 0) {
      console.log("[Last.fm Prompts] Sample recent track structure:");
      console.log("  name:", tracks[0].name);
      console.log("  artist:", JSON.stringify(tracks[0].artist));
      console.log("  album:", JSON.stringify(tracks[0].album));
      console.log("  album extracted:", getAlbumName(tracks[0].album));
    }

    if (tracks.length === 0) {
      return NextResponse.json({ prompts: [] });
    }

    // Fetch top tracks to identify repeat listens
    const topTracksUrl = `https://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&user=${connection.serviceUsername}&api_key=${apiKey}&format=json&limit=20&period=7day`;

    const topResponse = await fetch(topTracksUrl);
    let topTracks: LastFmTrack[] = [];
    if (topResponse.ok) {
      const topData = await topResponse.json();
      topTracks = topData.toptracks?.track || [];
      console.log("[Last.fm Prompts] Top tracks count:", topTracks.length);
      if (topTracks.length > 0) {
        console.log("[Last.fm Prompts] Sample top track structure:");
        console.log("  name:", topTracks[0].name);
        console.log("  artist:", JSON.stringify(topTracks[0].artist));
        console.log("  album:", JSON.stringify(topTracks[0].album));
        console.log("  album extracted:", getAlbumName(topTracks[0].album));
      }
    }

    // Detect recent album plays (consecutive tracks from same album = intentional album listen)
    const recentAlbumPlays: Array<{ album: string; artist: string; trackCount: number; tracks: string[]; image?: Array<{ "#text": string; size: string }> }> = [];
    const albumPlayMap = new Map<string, { count: number; artist: string; tracks: Set<string>; lastIndex: number; image?: Array<{ "#text": string; size: string }> }>();

    tracks.forEach((track, index) => {
      const albumName = getAlbumName(track.album);
      const artistName = getArtistName(track.artist);
      if (!albumName || !artistName) return;

      const albumKey = `${artistName}::${albumName}`;
      const existing = albumPlayMap.get(albumKey);

      // Count as album play if: (1) new album OR (2) within 10 tracks of last play (consecutive-ish)
      if (!existing || index - existing.lastIndex <= 10) {
        albumPlayMap.set(albumKey, {
          count: (existing?.count || 0) + 1,
          artist: artistName,
          tracks: existing?.tracks ? new Set([...existing.tracks, track.name]) : new Set([track.name]),
          lastIndex: index,
          image: track.image || existing?.image,
        });
      }
    });

    // Filter for albums with 3+ tracks played (indicates full album listen)
    albumPlayMap.forEach((data, albumKey) => {
      if (data.tracks.size >= 3) {
        const [artist, album] = albumKey.split("::");
        recentAlbumPlays.push({
          album,
          artist: data.artist,
          trackCount: data.tracks.size,
          tracks: Array.from(data.tracks),
          image: data.image,
        });
      }
    });

    // Sort by track count (more tracks = more complete album listen)
    recentAlbumPlays.sort((a, b) => b.trackCount - a.trackCount);

    console.log("[Last.fm Prompts] Recent album plays detected:", recentAlbumPlays.length);
    if (recentAlbumPlays.length > 0) {
      console.log("[Last.fm Prompts] Sample recent album play:", JSON.stringify(recentAlbumPlays[0], null, 2));
    }

    // Prompt variations for variety
    const repeatPrompts = [
      (pc: number) => pc >= 15
        ? `You've played this ${pc} times this week. What's pulling you back?`
        : pc >= 10
        ? `${pc} plays. This track is clearly doing something for you.`
        : pc >= 5
        ? `You keep coming back to this one. What's the moment that hits?`
        : `On rotation. Worth logging?`,
      (pc: number) => pc >= 15
        ? `${pc} spins this week. It's got you hooked—what is it?`
        : pc >= 10
        ? `This one's on lock. ${pc} plays and counting.`
        : pc >= 5
        ? `Can't get enough of this. What keeps you here?`
        : `Back in rotation. Ready to capture it?`,
      (pc: number) => pc >= 15
        ? `Heavy rotation alert. ${pc} plays—what's the story?`
        : pc >= 10
        ? `${pc} plays later, still hitting. Worth documenting?`
        : pc >= 5
        ? `This track owns you right now. What's it doing?`
        : `Spinning this one a lot lately.`,
    ];

    const recentPrompts = [
      "Fresh in your queue. Anything worth saving?",
      "Just played. What stood out?",
      "Still thinking about this one?",
      "Catch this while it's fresh.",
      "You just heard this. What hit?",
      "Fresh play. Worth a note?",
    ];

    const albumPrompts = [
      (pc: number) => pc >= 20
        ? `You've spun this album ${pc} times. What keeps pulling you back in?`
        : pc >= 10
        ? `${pc} plays this week. This album's got you. What's the hook?`
        : `You stayed with this one. What's still with you?`,
      (pc: number) => pc >= 20
        ? `${pc} album plays. It's clearly doing something for you.`
        : pc >= 10
        ? `This album keeps finding its way back. What is it about this one?`
        : `You finished it. Worth documenting?`,
      (pc: number) => pc >= 20
        ? `Heavy album rotation. ${pc} plays—what's the draw?`
        : pc >= 10
        ? `Can't seem to leave this album alone. What keeps you here?`
        : `Gave this the full listen. Anything stick?`,
    ];

    // Generate prompts from top tracks (heavy repeat listens)
    const repeatCandidates: Prompt[] = [];
    const recentCandidates: Prompt[] = [];
    const albumCandidates: Prompt[] = [];
    const seenTracks = new Set<string>();
    const seenAlbums = new Set<string>();

    // Priority 1: Tracks on heavy repeat (from top tracks of the week) - Limit to 5
    // Shuffle top tracks to get variety instead of always showing the same top 5
    const shuffledTopTracks = [...topTracks].sort(() => Math.random() - 0.5);
    for (const track of shuffledTopTracks.slice(0, 20)) {
      const artistName = getArtistName(track.artist);
      let albumName = getAlbumName(track.album);

      // Skip only if missing track name or artist (album is optional)
      if (!track.name || !artistName || track.name.trim() === "" || artistName.trim() === "") {
        console.log("[Last.fm Prompts] Skipping track - name:", track.name, "artist:", artistName);
        continue;
      }

      const trackKey = `${artistName}::${track.name}`;

      if (seenTracks.has(trackKey)) continue;
      seenTracks.add(trackKey);

      const playCount = track.playcount ? parseInt(track.playcount) : 0;
      if (playCount < 3) continue; // Only show if played 3+ times

      // Try to get artwork from Last.fm first (prefer highest quality)
      let artworkUrl = track.image?.find((img) => img.size === "mega")?.["#text"] ||
                       track.image?.find((img) => img.size === "extralarge")?.["#text"] ||
                       track.image?.find((img) => img.size === "large")?.["#text"] ||
                       track.image?.find((img) => img.size === "medium")?.["#text"] || "";

      // Check if Last.fm actually has valid artwork (not just empty/placeholder)
      const hasValidLastFmArt = artworkUrl && artworkUrl !== "" && !artworkUrl.includes("2a96cbd8b46e442fc41c2b86b821562f");

      // If no valid artwork, try Last.fm track.getinfo API (but don't use album name from it - it can have bad user-submitted data)
      if (!hasValidLastFmArt) {
        const trackInfo = await fetchLastFmTrackInfo(track.name, artistName, apiKey);
        if (trackInfo.artwork) {
          artworkUrl = trackInfo.artwork;
        }
        // Don't use album name from track.getinfo - it can have corrupted/user-submitted metadata
      }

      // Validate with Spotify if: (1) no artwork yet, OR (2) album name looks suspicious
      const suspiciousPattern = /\b(67|b4|days|before)\b/i;
      const needsSpotifyValidation = !artworkUrl || (albumName && suspiciousPattern.test(albumName));

      if (needsSpotifyValidation) {
        if (!artworkUrl) {
          console.log(`[Last.fm Prompts] No artwork for "${track.name}", checking Spotify...`);
        }
        if (albumName && suspiciousPattern.test(albumName)) {
          console.log(`[Last.fm Prompts] Suspicious album name detected: "${albumName}", validating with Spotify...`);
        }

        const spotifyValidation = await validateWithSpotify(track.name, artistName, albumName);
        if (spotifyValidation.album && albumName && suspiciousPattern.test(albumName)) {
          albumName = spotifyValidation.album;
        }
        if (spotifyValidation.artwork && !artworkUrl) {
          artworkUrl = spotifyValidation.artwork;
        }
      }

      // Spotify validation above handles artwork fallback, no need for additional fallbacks

      const palette = paletteFromString(albumName || track.name);

      console.log("[Last.fm Prompts] Creating repeat prompt:", {
        track: track.name,
        artist: artistName,
        album: albumName,
        albumFromInitial: getAlbumName(track.album),
        artworkUrl,
      });

      // Use varied prompt
      const promptVariation = repeatPrompts[repeatCandidates.length % repeatPrompts.length];

      repeatCandidates.push({
        id: `repeat-${trackKey}`,
        type: "repeat",
        track: track.name,
        artist: artistName,
        album: albumName,
        playCount,
        prompt: promptVariation(playCount),
        tag: playCount >= 15 ? "HEAVY ROTATION" : playCount >= 10 ? "ON HEAVY PLAY" : "ON REPEAT",
        artworkUrl,
        palette,
      });

      if (repeatCandidates.length >= 5) break; // Limit to 5 repeat prompts
    }

    // Priority 2: Recently played unique tracks - Limit to 5
    // Sample from wider range (0-100) for more variety on refresh
    const recentSample = tracks.slice(0, 100).sort(() => Math.random() - 0.5);
    for (const track of recentSample.slice(0, 30)) {
      const artistName = getArtistName(track.artist);
      let albumName = getAlbumName(track.album);

      // Skip only if missing track name or artist (album is optional)
      if (!track.name || !artistName || track.name.trim() === "" || artistName.trim() === "") {
        console.log("[Last.fm Prompts] Skipping recent track - name:", track.name, "artist:", artistName);
        continue;
      }

      const trackKey = `${artistName}::${track.name}`;

      if (seenTracks.has(trackKey)) continue;
      seenTracks.add(trackKey);

      // Try to get artwork from Last.fm first (prefer highest quality)
      let artworkUrl = track.image?.find((img) => img.size === "mega")?.["#text"] ||
                       track.image?.find((img) => img.size === "extralarge")?.["#text"] ||
                       track.image?.find((img) => img.size === "large")?.["#text"] ||
                       track.image?.find((img) => img.size === "medium")?.["#text"] || "";

      // Check if Last.fm actually has valid artwork (not just empty/placeholder)
      const hasValidLastFmArt = artworkUrl && artworkUrl !== "" && !artworkUrl.includes("2a96cbd8b46e442fc41c2b86b821562f");

      // If no valid artwork, try Last.fm track.getinfo API (but don't use album name from it - it can have bad user-submitted data)
      if (!hasValidLastFmArt) {
        const trackInfo = await fetchLastFmTrackInfo(track.name, artistName, apiKey);
        if (trackInfo.artwork) {
          artworkUrl = trackInfo.artwork;
        }
        // Don't use album name from track.getinfo - it can have corrupted/user-submitted metadata
      }

      // Validate with Spotify if: (1) no artwork yet, OR (2) album name looks suspicious
      const suspiciousPattern = /\b(67|b4|days|before)\b/i;
      const needsSpotifyValidation = !artworkUrl || (albumName && suspiciousPattern.test(albumName));

      if (needsSpotifyValidation) {
        if (!artworkUrl) {
          console.log(`[Last.fm Prompts] No artwork for "${track.name}", checking Spotify...`);
        }
        if (albumName && suspiciousPattern.test(albumName)) {
          console.log(`[Last.fm Prompts] Suspicious album name detected: "${albumName}", validating with Spotify...`);
        }

        const spotifyValidation = await validateWithSpotify(track.name, artistName, albumName);
        if (spotifyValidation.album && albumName && suspiciousPattern.test(albumName)) {
          albumName = spotifyValidation.album;
        }
        if (spotifyValidation.artwork && !artworkUrl) {
          artworkUrl = spotifyValidation.artwork;
        }
      }

      // Spotify validation above handles artwork fallback, no need for additional fallbacks

      const palette = paletteFromString(albumName || track.name);

      console.log("[Last.fm Prompts] Creating recent prompt:", {
        track: track.name,
        artist: artistName,
        album: albumName,
        artworkUrl,
        imageArray: track.image,
      });

      // Use varied prompt
      const promptText = recentPrompts[recentCandidates.length % recentPrompts.length];

      recentCandidates.push({
        id: `recent-${trackKey}`,
        type: "recent",
        track: track.name,
        artist: artistName,
        album: albumName,
        prompt: promptText,
        tag: "JUST PLAYED",
        artworkUrl,
        palette,
      });

      if (recentCandidates.length >= 5) break; // Limit to 5 recent prompts
    }

    // Priority 3: Recent album plays (full album listens) - Limit to 3
    for (const albumPlay of recentAlbumPlays.slice(0, 10)) {
      const albumKey = `${albumPlay.artist}::${albumPlay.album}`;

      if (seenAlbums.has(albumKey)) continue;
      seenAlbums.add(albumKey);

      // Try to get artwork from Last.fm first
      let artworkUrl = albumPlay.image?.find((img) => img.size === "mega")?.["#text"] ||
                       albumPlay.image?.find((img) => img.size === "extralarge")?.["#text"] ||
                       albumPlay.image?.find((img) => img.size === "large")?.["#text"] ||
                       albumPlay.image?.find((img) => img.size === "medium")?.["#text"] || "";

      // Validate with Spotify if no artwork
      if (!artworkUrl) {
        // Use first track from the album play for Spotify search
        const spotifyValidation = await validateWithSpotify(albumPlay.tracks[0], albumPlay.artist, albumPlay.album);
        if (spotifyValidation.artwork) {
          artworkUrl = spotifyValidation.artwork;
        }
      }

      const palette = paletteFromString(albumPlay.album);

      console.log("[Last.fm Prompts] Creating album prompt:", {
        album: albumPlay.album,
        artist: albumPlay.artist,
        trackCount: albumPlay.trackCount,
        artworkUrl,
      });

      // Use varied prompt based on track count
      const promptVariation = albumPrompts[albumCandidates.length % albumPrompts.length];

      albumCandidates.push({
        id: `album-${albumKey}`,
        type: "album",
        track: "", // For albums, track is empty
        artist: albumPlay.artist,
        album: albumPlay.album,
        playCount: albumPlay.trackCount, // Use track count instead of total plays
        prompt: promptVariation(albumPlay.trackCount),
        tag: albumPlay.trackCount >= 8 ? "FULL ALBUM LISTEN" : albumPlay.trackCount >= 5 ? "ALBUM SESSION" : "ALBUM SPIN",
        artworkUrl,
        palette,
      });

      if (albumCandidates.length >= 3) break; // Limit to 3 album prompts
    }

    // Shuffle each category to provide variety on refresh
    const shuffleArray = <T,>(array: T[]): T[] => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    const shuffledRepeat = shuffleArray(repeatCandidates);
    const shuffledRecent = shuffleArray(recentCandidates);
    const shuffledAlbum = shuffleArray(albumCandidates);

    // Intersperse repeat, recent, and album prompts
    const prompts: Prompt[] = [];
    const maxLength = Math.max(shuffledRepeat.length, shuffledRecent.length, shuffledAlbum.length);

    for (let i = 0; i < maxLength; i++) {
      if (i < shuffledRepeat.length) prompts.push(shuffledRepeat[i]);
      if (i < shuffledAlbum.length) prompts.push(shuffledAlbum[i]);
      if (i < shuffledRecent.length) prompts.push(shuffledRecent[i]);
    }

    console.log("[Last.fm Prompts] Final prompts count:", prompts.length);
    if (prompts.length > 0) {
      console.log("[Last.fm Prompts] Sample final prompt:", JSON.stringify(prompts[0], null, 2));
    }

    return NextResponse.json({ prompts }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    console.error("Last.fm prompts error:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch prompts" },
      { status: 500 }
    );
  }
}
