/**
 * Visualiser Lexicons
 *
 * Curated keyword→effect mappings for lyric accent analysis.
 * Hand-tuned per demo track for camera-ready precision (nothing misfires).
 *
 * Based on Visualiser_Pipeline.md spec - literalness is a feature!
 */

import type { LyricLexicons } from './visualiser-types';

// ============================================================================
// COLOR WORDS → HEX COLORS
// ============================================================================

/**
 * Color words map to literal screen colors.
 * "blue" turns the screen blue - charming, not wrong!
 */
export const COLOR_LEXICON: Record<string, string> = {
  // Primary colors
  'blue': '#4287f5',
  'red': '#f54242',
  'green': '#42f554',
  'yellow': '#f5e042',
  'orange': '#f59342',
  'purple': '#9342f5',
  'pink': '#f542d4',

  // Extended colors
  'black': '#1a1a1a',
  'white': '#f5f5f5',
  'gold': '#d4af37',
  'golden': '#d4af37',
  'silver': '#c0c0c0',
  'brown': '#8b4513',
  'grey': '#808080',
  'gray': '#808080',

  // RED SYNONYMS (blood, wine, fire)
  'blood': '#8b0000',
  'bloody': '#8b0000',
  'crimson': '#dc143c',
  'scarlet': '#ff2400',
  'ruby': '#e0115f',
  'cherry': '#de3163',
  'wine': '#722f37',
  'rose': '#ff007f',
  'rust': '#b7410e',
  'brick': '#b22222',
  'fire': '#ff4500',
  'flame': '#ff4500',
  'blush': '#ff6b9d',

  // BLUE SYNONYMS (ocean, sky, ice)
  'ocean': '#006994',
  'sea': '#006994',
  'sky': '#87ceeb',
  'navy': '#000080',
  'sapphire': '#0f52ba',
  'cobalt': '#0047ab',
  'azure': '#007fff',
  'ice': '#afeeee',
  'frost': '#c9e4f5',
  'aqua': '#00ffff',
  'teal': '#008080',

  // GREEN SYNONYMS (emerald, jade, lime)
  'emerald': '#50c878',
  'jade': '#00a86b',
  'lime': '#00ff00',
  'mint': '#98ff98',
  'olive': '#808000',
  'forest': '#228b22',
  'grass': '#7cfc00',
  'moss': '#8a9a5b',
  'sage': '#9dc183',

  // YELLOW/ORANGE SYNONYMS (turmeric, honey, sunset)
  'amber': '#ffbf00',
  'honey': '#ffb347',
  'butter': '#fff8dc',
  'cream': '#fffdd0',
  'lemon': '#fff700',
  'sunny': '#ffdf00',
  'turmeric': '#ff9500',
  'marigold': '#ffa500',
  'sunset': '#ff6347',

  // PURPLE/PINK SYNONYMS (violet, lavender, magenta)
  'violet': '#8b00ff',
  'lavender': '#e6e6fa',
  'lilac': '#c8a2c8',
  'magenta': '#ff00ff',
  'plum': '#8e4585',
  'mauve': '#e0b0ff',
  'fuchsia': '#ff00ff',
  'coral': '#ff7f50',

  // NEUTRALS (grey, ash, silver)
  'ash': '#b2beb5',
  'smoke': '#738276',
  'slate': '#708090',
  'pearl': '#eae0c8',
  'ivory': '#fffff0',
  'beige': '#f5f5dc',
  'tan': '#d2b48c',

  // BROWN SYNONYMS (chocolate, coffee, bronze)
  'chocolate': '#7b3f00',
  'coffee': '#6f4e37',
  'mocha': '#967969',
  'bronze': '#cd7f32',
  'copper': '#b87333',
  'caramel': '#af6e4d',
  'cinnamon': '#d2691e',

  // LIGHT SYNONYMS (bright, glow, shimmer)
  'bright': '#ffffff',
  'light': '#f0f0f0',
  'pale': '#fafafa',
  'glow': '#fff8dc',
  'shimmer': '#ffd700',
  'shine': '#ffffff',

  // DARKNESS SYNONYMS
  'dark': '#1a0d0e',
  'darkness': '#0a0a0a',
  'phantom': '#2a2a3a',
  'shadow': '#36454f',
  'night': '#0c0c1e',
  'midnight': '#191970',
  'ebony': '#0a0a0a',
  'coal': '#0a0a0a',
  'charcoal': '#36454f',
  'ink': '#000000',

  // NATURE COLORS
  'turquoise': '#40e0d0',
  'indigo': '#4b0082',
};

// ============================================================================
// ENERGY MARKERS
// ============================================================================

/**
 * High-energy markers → energyMultiplier UP (bigger/faster).
 * Includes ad-libs, imperatives, all-caps emphasis.
 */
export const ENERGY_HIGH: string[] = [
  // Ad-libs
  'ay', 'ayy', 'aye', 'yeah', 'yuh', 'woah', 'whoa', 'let\'s go', 'leggo',
  'turn up', 'turnt', 'lit', 'fire', 'run it', 'go off', 'pop off',

  // Imperatives
  'run', 'jump', 'fly', 'rise', 'climb', 'soar', 'burst', 'explode',
  'scream', 'shout', 'yell', 'roar', 'rage',

  // Intensity words
  'wild', 'crazy', 'insane', 'mad', 'fierce', 'savage', 'beast',
  'power', 'strong', 'loud', 'fast', 'quick', 'rapid', 'rush',

  // Excitement
  'hype', 'pumped', 'amped', 'charged', 'electric', 'alive',
];

/**
 * Low-energy/melancholy markers → energyMultiplier DOWN (smaller/slower).
 */
export const ENERGY_LOW: string[] = [
  // Sadness
  'sad', 'cry', 'tears', 'weep', 'mourn', 'grief', 'sorrow',
  'broken', 'hurt', 'pain', 'ache', 'numb',

  // Slowness
  'slow', 'slowly', 'down', 'quiet', 'soft', 'gentle', 'calm',
  'still', 'silent', 'hush', 'whisper',

  // Melancholy
  'lonely', 'alone', 'empty', 'cold', 'lost', 'fade', 'fading',
  'grey', 'gray', 'dim', 'dark', 'shadow',

  // Exhaustion
  'tired', 'weary', 'worn', 'drained', 'heavy', 'weight',
];

// ============================================================================
// WEATHER / LIGHT EFFECTS
// ============================================================================

/**
 * Weather/light words → particle effects.
 */
export const WEATHER_LEXICON: Record<string, 'rain' | 'fire' | 'frost' | 'bloom' | 'flash'> = {
  // Rain
  'rain': 'rain',
  'raining': 'rain',
  'storm': 'rain',
  'thunder': 'rain',
  'pour': 'rain',
  'pouring': 'rain',
  'drip': 'rain',
  'drops': 'rain',
  'wet': 'rain',

  // Fire
  'fire': 'fire',
  'burn': 'fire',
  'burning': 'fire',
  'flame': 'fire',
  'flames': 'fire',
  'blaze': 'fire',
  'blazing': 'fire',
  'heat': 'fire',
  'hot': 'fire',
  'ember': 'fire',
  'embers': 'fire',

  // Frost/cold
  'ice': 'frost',
  'icy': 'frost',
  'cold': 'frost',
  'freeze': 'frost',
  'frozen': 'frost',
  'frost': 'frost',
  'chill': 'frost',
  'winter': 'frost',
  'snow': 'frost',
  'snowing': 'frost',

  // Bloom/light
  'sun': 'bloom',
  'sunny': 'bloom',
  'sunshine': 'bloom',
  'shine': 'bloom',
  'shining': 'bloom',
  'glow': 'bloom',
  'glowing': 'bloom',
  'bright': 'bloom',
  'light': 'bloom',
  'bloom': 'bloom',
  'blossom': 'bloom',
  'flower': 'bloom',
  'spring': 'bloom',

  // Flash/lightning
  'flash': 'flash',
  'lightning': 'flash',
  'spark': 'flash',
  'sparks': 'flash',
  'flicker': 'flash',
  'strobe': 'flash',
};

// ============================================================================
// MOTION VERBS → DIRECTION
// ============================================================================

/**
 * Motion verbs → directional movement.
 */
export const MOTION_UP: string[] = [
  'rise', 'rising', 'up', 'climb', 'climbing', 'soar', 'soaring',
  'lift', 'lifting', 'float', 'floating', 'ascend', 'ascending',
  'fly', 'flying', 'levitate',
];

export const MOTION_DOWN: string[] = [
  'fall', 'falling', 'down', 'drop', 'dropping', 'sink', 'sinking',
  'descend', 'descending', 'crash', 'crashing', 'plunge', 'plunging',
  'drown', 'drowning', 'dive', 'diving',
];

export const MOTION_FAST: string[] = [
  'run', 'running', 'race', 'racing', 'rush', 'rushing', 'fast',
  'quick', 'quickly', 'rapid', 'rapidly', 'speed', 'speeding',
  'dash', 'dashing', 'sprint', 'sprinting', 'zoom', 'zooming',
  'fly', 'flying',
];

// ============================================================================
// COMPILED LEXICONS OBJECT
// ============================================================================

export const LYRIC_LEXICONS: LyricLexicons = {
  color: COLOR_LEXICON,
  energy: {
    high: ENERGY_HIGH,
    low: ENERGY_LOW,
  },
  weather: WEATHER_LEXICON,
  motion: {
    up: MOTION_UP,
    down: MOTION_DOWN,
    fast: MOTION_FAST,
  },
};

// ============================================================================
// HELPER: Check if text matches any keyword
// ============================================================================

/**
 * Case-insensitive keyword matching in text.
 * Returns the matched keyword or null.
 */
export function findKeyword(text: string, keywords: string[]): string | null {
  const lower = text.toLowerCase();
  for (const keyword of keywords) {
    if (lower.includes(keyword.toLowerCase())) {
      return keyword;
    }
  }
  return null;
}

/**
 * Find color keyword in text.
 * Returns the hex color or null.
 */
export function findColorInText(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [keyword, hex] of Object.entries(COLOR_LEXICON)) {
    if (lower.includes(keyword)) {
      return hex;
    }
  }
  return null;
}

/**
 * Find weather effect in text.
 */
export function findWeatherInText(text: string): 'rain' | 'fire' | 'frost' | 'bloom' | 'flash' | null {
  const lower = text.toLowerCase();
  for (const [keyword, effect] of Object.entries(WEATHER_LEXICON)) {
    if (lower.includes(keyword)) {
      return effect;
    }
  }
  return null;
}
