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

    // Fetch recent tracks from Last.fm
    const recentTracksUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${connection.serviceUsername}&api_key=${apiKey}&format=json&limit=50`;

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

    // Fetch top albums to identify album spins
    const topAlbumsUrl = `https://ws.audioscrobbler.com/2.0/?method=user.gettopalbums&user=${connection.serviceUsername}&api_key=${apiKey}&format=json&limit=10&period=7day`;

    const albumsResponse = await fetch(topAlbumsUrl);
    let topAlbums: Array<{ name: string; artist: { "#text": string } | string; playcount: string; image: Array<{ "#text": string; size: string }> }> = [];
    if (albumsResponse.ok) {
      const albumsData = await albumsResponse.json();
      topAlbums = albumsData.topalbums?.album || [];
      console.log("[Last.fm Prompts] Top albums count:", topAlbums.length);
      if (topAlbums.length > 0) {
        console.log("[Last.fm Prompts] Sample top album:", JSON.stringify(topAlbums[0], null, 2));
      }
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
    for (const track of topTracks.slice(0, 15)) {
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
    for (const track of tracks.slice(0, 30)) {
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

    // Priority 3: Album spins - Limit to 3
    for (const album of topAlbums.slice(0, 15)) {
      const artistName = getArtistName(album.artist);

      // Skip only if missing album name or artist
      if (!album.name || !artistName || album.name.trim() === "" || artistName.trim() === "") {
        console.log("[Last.fm Prompts] Skipping album - name:", album.name, "artist:", artistName);
        continue;
      }

      const albumKey = `${artistName}::${album.name}`;

      if (seenAlbums.has(albumKey)) continue;
      seenAlbums.add(albumKey);

      const playCount = parseInt(album.playcount) || 0;
      if (playCount < 3) continue; // Only show if played 3+ times

      // Try to get artwork from Last.fm first (prefer highest quality)
      let artworkUrl = album.image?.find((img) => img.size === "mega")?.["#text"] ||
                       album.image?.find((img) => img.size === "extralarge")?.["#text"] ||
                       album.image?.find((img) => img.size === "large")?.["#text"] ||
                       album.image?.find((img) => img.size === "medium")?.["#text"] || "";

      // Check if Last.fm actually has valid artwork (not just empty/placeholder)
      const hasValidLastFmArt = artworkUrl && artworkUrl !== "" && !artworkUrl.includes("2a96cbd8b46e442fc41c2b86b821562f");

      // If no valid artwork, try Last.fm album.getinfo API (often has better artwork)
      if (!hasValidLastFmArt) {
        artworkUrl = await fetchLastFmAlbumInfo(album.name, artistName, apiKey);
      }

      // Finally fall back to MusicBrainz/iTunes
      if (!artworkUrl) {
        artworkUrl = await fetchFallbackArtwork("", artistName, album.name);
      }

      const palette = paletteFromString(album.name);

      console.log("[Last.fm Prompts] Creating album prompt:", {
        album: album.name,
        artist: artistName,
        artworkUrl,
        playCount,
      });

      // Use varied prompt
      const promptVariation = albumPrompts[albumCandidates.length % albumPrompts.length];

      albumCandidates.push({
        id: `album-${albumKey}`,
        type: "album",
        track: "", // For albums, track is empty
        artist: artistName,
        album: album.name,
        playCount,
        prompt: promptVariation(playCount),
        tag: playCount >= 20 ? "ALBUM ON REPEAT" : playCount >= 10 ? "HEAVY ALBUM PLAY" : "ALBUM SPIN",
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
