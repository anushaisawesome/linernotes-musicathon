/**
 * Lyric Accent Analyzer
 *
 * Extracts visual effects from the currently-playing lyric line.
 * Uses curated lexicons + simple sentiment heuristics (no LLM, deterministic).
 *
 * Runtime analysis ONLY - never persisted (Musixmatch compliance).
 * Based on Visualiser_Pipeline.md spec.
 */

import type { LyricAccent } from './visualiser-types';
import {
  LYRIC_LEXICONS,
  findColorInText,
  findWeatherInText,
  findKeyword,
  ENERGY_HIGH,
  ENERGY_LOW,
  MOTION_UP,
  MOTION_DOWN,
  MOTION_FAST,
} from './visualiser-lexicons';

// ============================================================================
// LYRIC ACCENT EXTRACTION
// ============================================================================

/**
 * Analyze a lyric line and extract visual accent parameters.
 * Triggered on the currently-playing line, NOT the whole song.
 *
 * @param lyricLine - The text of the current lyric line
 * @returns LyricAccent object with color, energy, effect, direction, density
 */
export function analyzeLyricAccents(lyricLine: string): LyricAccent {
  const accent: LyricAccent = {
    energyMultiplier: 1.0,
    density: 0.5,
  };

  if (!lyricLine || lyricLine.trim().length === 0) {
    return accent;
  }

  const text = lyricLine.trim();

  // ──────────────────────────────────────────────────────────────────────────
  // 1. COLOR WORDS → accentColour
  // ──────────────────────────────────────────────────────────────────────────
  const colorMatch = findColorInText(text);
  if (colorMatch) {
    accent.accentColour = colorMatch;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. ENERGY MARKERS → energyMultiplier
  // ──────────────────────────────────────────────────────────────────────────
  const hasHighEnergy = findKeyword(text, ENERGY_HIGH) !== null;
  const hasLowEnergy = findKeyword(text, ENERGY_LOW) !== null;

  if (hasHighEnergy && !hasLowEnergy) {
    accent.energyMultiplier = 1.6;  // Bigger/faster
  } else if (hasLowEnergy && !hasHighEnergy) {
    accent.energyMultiplier = 0.6;  // Smaller/slower
  }

  // ALL CAPS or exclamation marks → spike energy
  const hasAllCaps = text === text.toUpperCase() && text.length > 3;
  const hasExclamation = text.includes('!');

  if (hasAllCaps || hasExclamation) {
    accent.energyMultiplier = Math.min(2.0, accent.energyMultiplier * 1.3);
  }

  // Ellipsis or fragments → restraint
  const hasEllipsis = text.includes('...');
  const isFragment = text.length < 15 && !text.match(/[.!?]$/);

  if (hasEllipsis || isFragment) {
    accent.energyMultiplier = Math.max(0.5, accent.energyMultiplier * 0.8);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. WEATHER / LIGHT → effect
  // ──────────────────────────────────────────────────────────────────────────
  const weatherEffect = findWeatherInText(text);
  if (weatherEffect) {
    accent.effect = weatherEffect;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. MOTION VERBS → direction
  // ──────────────────────────────────────────────────────────────────────────
  const hasUp = findKeyword(text, MOTION_UP) !== null;
  const hasDown = findKeyword(text, MOTION_DOWN) !== null;
  const hasFast = findKeyword(text, MOTION_FAST) !== null;

  if (hasFast) {
    accent.direction = 'fast';
  } else if (hasUp && !hasDown) {
    accent.direction = 'up';
  } else if (hasDown && !hasUp) {
    accent.direction = 'down';
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. DENSITY / REPETITION
  // ──────────────────────────────────────────────────────────────────────────
  // Syllable count heuristic: more syllables = denser visuals
  const syllableCount = estimateSyllables(text);
  const wordsPerChar = text.split(/\s+/).length / Math.max(1, text.length);

  // High syllable density → busy visual
  if (syllableCount > 15 || wordsPerChar > 0.15) {
    accent.density = 0.85;
  } else if (syllableCount < 6 || wordsPerChar < 0.08) {
    // Sparse line → calm visual
    accent.density = 0.25;
  } else {
    accent.density = 0.5;
  }

  return accent;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Rough syllable count estimation.
 * Counts vowel groups as a proxy for syllables.
 */
function estimateSyllables(text: string): number {
  // Remove punctuation and convert to lowercase
  const clean = text.toLowerCase().replace(/[^a-z\s]/g, '');

  // Count vowel groups (consecutive vowels = 1 syllable)
  const vowelGroups = clean.match(/[aeiouy]+/g);

  return vowelGroups ? vowelGroups.length : 1;
}

/**
 * Check if line is a repeated phrase (occurs multiple times in recent history).
 * This would require keeping a small buffer of recent lines - simplified for now.
 */
export function isRepeatedLine(line: string, recentLines: string[]): boolean {
  const normalized = line.toLowerCase().trim();
  return recentLines.filter(l => l.toLowerCase().trim() === normalized).length > 1;
}

// ============================================================================
// BATCH ANALYSIS (for offline mock lyrics)
// ============================================================================

/**
 * Analyze all lyrics in a track (for mock lyrics in post-expiry preview).
 * Returns array of LyricAccent per line.
 *
 * Note: For REAL Musixmatch lyrics, this is NEVER persisted - runtime only.
 * For MOCK lyrics (your own text), this CAN be baked freely.
 */
export function batchAnalyzeLyrics(lyrics: string[]): LyricAccent[] {
  return lyrics.map(line => analyzeLyricAccents(line));
}
