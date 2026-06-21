/**
 * GET /api/audio-analysis?trackId=...&artist=...&track=...
 *
 * Returns audio analysis for visualiser:
 * - Genre from iTunes API
 * - BPM estimate (genre-based heuristic for now, librosa integration later)
 * - Audio features (mock for now)
 *
 * This provides real genre detection and reasonable BPM estimates per track.
 */

import { NextRequest, NextResponse } from 'next/server';

// Genre → typical BPM ranges (more accurate than 120 for everything)
const GENRE_BPM_MAP: Record<string, { min: number; max: number; default: number }> = {
  // Electronic / Dance
  'Electronic': { min: 120, max: 140, default: 128 },
  'Dance': { min: 120, max: 130, default: 125 },
  'House': { min: 120, max: 130, default: 125 },
  'Techno': { min: 125, max: 135, default: 130 },
  'Dubstep': { min: 138, max: 142, default: 140 },
  'Drum and Bass': { min: 160, max: 180, default: 170 },

  // Hip-Hop / Trap
  'Hip-Hop/Rap': { min: 70, max: 100, default: 85 },
  'Trap': { min: 130, max: 150, default: 140 },

  // Pop / R&B
  'Pop': { min: 100, max: 130, default: 120 },
  'R&B/Soul': { min: 60, max: 90, default: 75 },
  'Soul': { min: 60, max: 90, default: 75 },

  // Rock / Alternative
  'Rock': { min: 110, max: 140, default: 120 },
  'Alternative': { min: 100, max: 130, default: 115 },
  'Indie': { min: 100, max: 130, default: 115 },
  'Punk': { min: 150, max: 190, default: 170 },
  'Metal': { min: 120, max: 180, default: 140 },

  // Slower genres
  'Jazz': { min: 60, max: 180, default: 120 },
  'Classical': { min: 60, max: 180, default: 120 },
  'Blues': { min: 60, max: 120, default: 90 },
  'Country': { min: 90, max: 120, default: 105 },
  'Folk': { min: 90, max: 120, default: 100 },

  // Ambient / Chill
  'Ambient': { min: 60, max: 90, default: 75 },
  'Chill': { min: 80, max: 110, default: 95 },

  // Default
  'default': { min: 100, max: 130, default: 120 },
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const trackName = searchParams.get('track');
    const artistName = searchParams.get('artist');
    const spotifyId = searchParams.get('trackId');

    if (!trackName || !artistName) {
      return NextResponse.json(
        { error: 'Missing track or artist parameter' },
        { status: 400 }
      );
    }

    // Fetch iTunes metadata for genre
    const itunesData = await fetchITunesMetadata(trackName, artistName);

    const genre = itunesData?.genre || 'Pop';
    const bpmRange = GENRE_BPM_MAP[genre] || GENRE_BPM_MAP['default'];

    // For now, use genre default BPM
    // TODO: Add librosa beat tracking from preview URL
    const bpm = bpmRange.default;
    const beatIntervalMs = (60 / bpm) * 1000;

    // Mock audio features (TODO: Add real librosa extraction)
    const audioFeatures = {
      rms: getGenreRMS(genre),
      spectralCentroid: getGenreSpectralCentroid(genre),
      tempo: bpm,
    };

    return NextResponse.json({
      genre,
      bpm,
      beatIntervalMs,
      firstBeatMs: 0, // TODO: Hand-tune per track or detect from librosa
      beats: [],      // TODO: Add librosa beat positions
      audioFeatures,
      source: 'itunes-genre-heuristic', // Will be 'librosa' when fully implemented
    });
  } catch (error) {
    console.error('[audio-analysis] Error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze audio' },
      { status: 500 }
    );
  }
}

/**
 * Fetch iTunes metadata to get genre.
 */
async function fetchITunesMetadata(track: string, artist: string) {
  try {
    const query = encodeURIComponent(`${track} ${artist}`);
    const url = `https://itunes.apple.com/search?term=${query}&entity=song&limit=1`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      return {
        genre: result.primaryGenreName || 'Pop',
        artworkUrl: result.artworkUrl100?.replace('100x100', '600x600'),
        previewUrl: result.previewUrl,
      };
    }

    return null;
  } catch (error) {
    console.error('[audio-analysis] iTunes API error:', error);
    return null;
  }
}

/**
 * Get typical RMS energy for a genre (0-1).
 */
function getGenreRMS(genre: string): number {
  const highEnergy = ['Metal', 'Punk', 'Drum and Bass', 'Dubstep', 'Techno'];
  const mediumEnergy = ['Rock', 'Electronic', 'Dance', 'Pop', 'Hip-Hop/Rap', 'Trap'];
  const lowEnergy = ['Jazz', 'Classical', 'Ambient', 'R&B/Soul', 'Folk', 'Blues'];

  if (highEnergy.includes(genre)) return 0.8;
  if (mediumEnergy.includes(genre)) return 0.6;
  if (lowEnergy.includes(genre)) return 0.4;
  return 0.5;
}

/**
 * Get typical spectral centroid for a genre (0-1, brightness).
 */
function getGenreSpectralCentroid(genre: string): number {
  const bright = ['Electronic', 'Dance', 'Pop', 'Techno', 'Metal'];
  const medium = ['Rock', 'Hip-Hop/Rap', 'Alternative', 'Indie'];
  const warm = ['Jazz', 'R&B/Soul', 'Blues', 'Folk', 'Ambient'];

  if (bright.includes(genre)) return 0.7;
  if (medium.includes(genre)) return 0.5;
  if (warm.includes(genre)) return 0.3;
  return 0.5;
}
