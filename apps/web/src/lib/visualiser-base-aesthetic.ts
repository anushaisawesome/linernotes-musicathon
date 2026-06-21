/**
 * Base Aesthetic Analyzer
 *
 * Derives persistent visual aesthetic from iTunes genre + audio features.
 * NO external keys required - fully in-stack.
 *
 * Survives Musixmatch key expiry (not Musixmatch-derived).
 * Based on Visualiser_Pipeline.md spec.
 */

import type { BaseAesthetic, GenrePreset, AudioFeatures } from './visualiser-types';

// ============================================================================
// GENRE PRESETS
// ============================================================================

/**
 * Genre → visual preset mapping (from iTunes primaryGenreName).
 * Each genre gets a default palette, texture, and motion style.
 */
const GENRE_PRESETS: Record<string, GenrePreset> = {
  // ──── Trap / Hip-Hop ────
  'Hip-Hop/Rap': {
    palette: ['#0a0a0a', '#1a1a2e', '#16213e', '#0f3460', '#533483'],
    texture: 'sharp',
    motion: 'angular',
  },
  'Trap': {
    palette: ['#0a0a0a', '#1a1a2e', '#16213e', '#0f3460', '#533483'],
    texture: 'sharp',
    motion: 'angular',
  },

  // ──── R&B / Soul ────
  'R&B/Soul': {
    palette: ['#2d1b2e', '#3d2645', '#4d315c', '#5d3c73', '#8b5a8b'],
    texture: 'soft',
    motion: 'undulating',
  },
  'Soul': {
    palette: ['#2d1b2e', '#3d2645', '#4d315c', '#5d3c73', '#8b5a8b'],
    texture: 'soft',
    motion: 'undulating',
  },

  // ──── Pop ────
  'Pop': {
    palette: ['#1a1a2e', '#e94560', '#f39c12', '#00d9ff', '#ff6b9d'],
    texture: 'glow',
    motion: 'pulse',
  },

  // ──── Electronic / Dance ────
  'Electronic': {
    palette: ['#0a0a0a', '#00ff9f', '#00b8d4', '#8b5cf6', '#d946ef'],
    texture: 'sharp',
    motion: 'pulse',
  },
  'Dance': {
    palette: ['#0a0a0a', '#00ff9f', '#00b8d4', '#8b5cf6', '#d946ef'],
    texture: 'sharp',
    motion: 'pulse',
  },

  // ──── Rock / Alternative ────
  'Rock': {
    palette: ['#1a0d0e', '#4a1c1c', '#7a2c2c', '#aa3c3c', '#da4c4c'],
    texture: 'grain',
    motion: 'angular',
  },
  'Alternative': {
    palette: ['#1a1a2e', '#3a3a5e', '#5a5a8e', '#7a7abe', '#9a9aee'],
    texture: 'grain',
    motion: 'drift',
  },

  // ──── Indie ────
  'Indie': {
    palette: ['#1a1a1a', '#4a5d3f', '#7a8d6f', '#aabd9f', '#daedcf'],
    texture: 'soft',
    motion: 'drift',
  },

  // ──── Jazz / Classical ────
  'Jazz': {
    palette: ['#1a1a1a', '#5a4a3a', '#8a7a6a', '#baaa9a', '#eadaca'],
    texture: 'soft',
    motion: 'undulating',
  },
  'Classical': {
    palette: ['#0f0f1a', '#2f2f4a', '#4f4f7a', '#6f6faa', '#8f8fda'],
    texture: 'glow',
    motion: 'undulating',
  },

  // ──── Country / Folk ────
  'Country': {
    palette: ['#1a1410', '#4a3c28', '#7a6440', '#aa8c58', '#dab470'],
    texture: 'soft',
    motion: 'drift',
  },
  'Folk': {
    palette: ['#1a1810', '#4a4028', '#7a6840', '#aa9058', '#dab870'],
    texture: 'grain',
    motion: 'drift',
  },

  // ──── Metal / Punk ────
  'Metal': {
    palette: ['#0a0a0a', '#2a0a0a', '#4a0a0a', '#6a0a0a', '#8a0a0a'],
    texture: 'sharp',
    motion: 'angular',
  },
  'Punk': {
    palette: ['#1a1a1a', '#4a1a1a', '#7a1a1a', '#aa1a1a', '#da1a1a'],
    texture: 'grain',
    motion: 'angular',
  },

  // ──── Ambient / Chill ────
  'Ambient': {
    palette: ['#0f1a1a', '#2f4a4a', '#4f7a7a', '#6faaaa', '#8fdada'],
    texture: 'glow',
    motion: 'drift',
  },
  'Chill': {
    palette: ['#1a1a2e', '#3a3a5e', '#5a5a8e', '#7a7abe', '#9a9aee'],
    texture: 'soft',
    motion: 'drift',
  },

  // ──── Default / Unknown ────
  'default': {
    palette: ['#1a1a1a', '#3a3a3a', '#5a5a5a', '#7a7a7a', '#9a9a9a'],
    texture: 'soft',
    motion: 'pulse',
  },
};

// ============================================================================
// BASE AESTHETIC DERIVATION
// ============================================================================

/**
 * Derive base aesthetic from genre + audio features.
 *
 * @param genre - iTunes primaryGenreName (e.g., "Hip-Hop/Rap", "R&B/Soul")
 * @param audioFeatures - Optional librosa features (rms, spectralCentroid, tempo)
 * @returns BaseAesthetic with palette, texture, motion
 */
export function deriveBaseAesthetic(
  genre: string,
  audioFeatures?: AudioFeatures
): BaseAesthetic {
  // Start with genre preset
  const preset = GENRE_PRESETS[genre] || GENRE_PRESETS['default'];

  // Clone the preset
  const aesthetic: BaseAesthetic = {
    palette: [...preset.palette],
    texture: preset.texture,
    motion: preset.motion,
  };

  // If audio features are available, adjust the aesthetic
  if (audioFeatures) {
    // RMS (energy) → intensity affects motion
    if (audioFeatures.rms > 0.7) {
      // High energy → more aggressive motion
      if (aesthetic.motion === 'drift') aesthetic.motion = 'pulse';
      if (aesthetic.motion === 'undulating') aesthetic.motion = 'angular';
    } else if (audioFeatures.rms < 0.3) {
      // Low energy → softer motion
      if (aesthetic.motion === 'angular') aesthetic.motion = 'pulse';
      if (aesthetic.motion === 'pulse') aesthetic.motion = 'undulating';
    }

    // Spectral centroid (brightness) → texture
    if (audioFeatures.spectralCentroid > 0.7) {
      // Bright sound → sharp/glow textures
      if (aesthetic.texture === 'soft') aesthetic.texture = 'glow';
    } else if (audioFeatures.spectralCentroid < 0.3) {
      // Warm sound → soft/grain textures
      if (aesthetic.texture === 'sharp') aesthetic.texture = 'grain';
    }

    // Tempo → palette temperature shift
    if (audioFeatures.tempo > 140) {
      // Fast tempo → warmer/brighter palette
      aesthetic.palette = warmPalette(aesthetic.palette);
    } else if (audioFeatures.tempo < 80) {
      // Slow tempo → cooler/darker palette
      aesthetic.palette = coolPalette(aesthetic.palette);
    }
  }

  return aesthetic;
}

// ============================================================================
// PALETTE TEMPERATURE SHIFTS
// ============================================================================

/**
 * Shift palette warmer (add red/yellow tones).
 */
function warmPalette(palette: string[]): string[] {
  return palette.map(hex => {
    const rgb = hexToRgb(hex);
    return rgbToHex(
      Math.min(255, rgb.r + 15),
      Math.max(0, rgb.g - 5),
      Math.max(0, rgb.b - 10)
    );
  });
}

/**
 * Shift palette cooler (add blue/purple tones).
 */
function coolPalette(palette: string[]): string[] {
  return palette.map(hex => {
    const rgb = hexToRgb(hex);
    return rgbToHex(
      Math.max(0, rgb.r - 10),
      Math.max(0, rgb.g - 5),
      Math.min(255, rgb.b + 15)
    );
  });
}

// ============================================================================
// COLOR UTILITIES
// ============================================================================

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

// ============================================================================
// LAST.FM TAG ENRICHMENT (Optional)
// ============================================================================

/**
 * Enrich base aesthetic with Last.fm vibe tags (optional semantic layer).
 * Tags like "melancholic", "energetic", "chill" add nuance to the visual.
 *
 * @param aesthetic - Current base aesthetic
 * @param tags - Last.fm top tags (e.g., ["melancholic", "indie", "chill"])
 * @returns Adjusted aesthetic
 */
export function enrichWithLastFmTags(
  aesthetic: BaseAesthetic,
  tags: string[]
): BaseAesthetic {
  const lowerTags = tags.map(t => t.toLowerCase());

  // Melancholic → cool palette, softer motion
  if (lowerTags.includes('melancholic') || lowerTags.includes('sad')) {
    aesthetic.palette = coolPalette(aesthetic.palette);
    if (aesthetic.motion === 'angular') aesthetic.motion = 'undulating';
  }

  // Energetic → warmer palette, more aggressive motion
  if (lowerTags.includes('energetic') || lowerTags.includes('upbeat')) {
    aesthetic.palette = warmPalette(aesthetic.palette);
    if (aesthetic.motion === 'drift') aesthetic.motion = 'pulse';
  }

  // Chill / relaxed → softer texture
  if (lowerTags.includes('chill') || lowerTags.includes('relaxed')) {
    if (aesthetic.texture === 'sharp') aesthetic.texture = 'soft';
    if (aesthetic.motion === 'angular') aesthetic.motion = 'drift';
  }

  // Dark → darker palette
  if (lowerTags.includes('dark') || lowerTags.includes('haunting')) {
    aesthetic.palette = aesthetic.palette.map(hex => {
      const rgb = hexToRgb(hex);
      return rgbToHex(
        Math.max(0, rgb.r - 20),
        Math.max(0, rgb.g - 20),
        Math.max(0, rgb.b - 20)
      );
    });
  }

  // Summer / bright → brighter palette
  if (lowerTags.includes('summer') || lowerTags.includes('sunny')) {
    aesthetic.palette = aesthetic.palette.map(hex => {
      const rgb = hexToRgb(hex);
      return rgbToHex(
        Math.min(255, rgb.r + 20),
        Math.min(255, rgb.g + 20),
        Math.min(255, rgb.b + 20)
      );
    });
  }

  return aesthetic;
}
