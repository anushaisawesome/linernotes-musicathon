/**
 * Visualiser Types & State
 *
 * Defines the core data structures for the music visualiser pipeline.
 * Based on Visualiser_Pipeline.md spec.
 */

// ============================================================================
// VISUAL STATE
// ============================================================================

/**
 * The complete visual state consumed by the renderer each frame.
 * Merged from 4 layers: base aesthetic, rhythm, lyric accents, moment override.
 */
export interface VisualState {
  // Base aesthetic (from iTunes genre + librosa features)
  palette: string[];
  texture: 'sharp' | 'soft' | 'grain' | 'glow';
  motion: 'angular' | 'undulating' | 'pulse' | 'drift';

  // Rhythm (from beat tracking)
  beatPhase: number;        // 0-1, where 0 = downbeat
  baseIntensity: number;    // 0-1, from RMS energy

  // Lyric accents (real-time from current line)
  accentColour?: string;           // Hex color from color words
  energyMultiplier: number;        // 0.5-2.0, affects size/speed
  effect?: 'rain' | 'fire' | 'frost' | 'bloom' | 'flash' | null;
  direction?: 'up' | 'down' | 'fast' | null;
  density: number;                 // 0-1, syllable/repetition density

  // Favourite-bit override
  momentOverride?: boolean;        // True when active moment fires
}

// ============================================================================
// BASE AESTHETIC (Layer 1)
// ============================================================================

/**
 * Baked base aesthetic derived from genre + audio features.
 * Persistent, survives Musixmatch key expiry.
 */
export interface BaseAesthetic {
  palette: string[];
  texture: 'sharp' | 'soft' | 'grain' | 'glow';
  motion: 'angular' | 'undulating' | 'pulse' | 'drift';
}

/**
 * Audio features extracted from librosa (same pass as beat tracking).
 */
export interface AudioFeatures {
  rms: number;              // Energy → intensity (0-1)
  spectralCentroid: number; // Brightness → sharp/light vs soft/warm (0-1)
  tempo: number;            // BPM → pace
}

/**
 * Genre preset mapping (from iTunes primaryGenreName).
 */
export type GenrePreset = {
  palette: string[];
  texture: 'sharp' | 'soft' | 'grain' | 'glow';
  motion: 'angular' | 'undulating' | 'pulse' | 'drift';
};

// ============================================================================
// RHYTHM (Layer 2)
// ============================================================================

/**
 * Baked rhythm data from beat tracking.
 * Persistent, survives key expiry.
 */
export interface RhythmData {
  bpm: number;
  beatIntervalMs: number;
  firstBeatMs: number;  // Hand-tuned per track for phase alignment
  beats: number[];      // Beat positions in ms
}

// ============================================================================
// LYRIC ACCENTS (Layer 3)
// ============================================================================

/**
 * Lyric accent triggers from the currently-playing line.
 * Never persisted (compliance) - runtime only.
 */
export interface LyricAccent {
  accentColour?: string;
  energyMultiplier: number;
  effect?: 'rain' | 'fire' | 'frost' | 'bloom' | 'flash' | null;
  direction?: 'up' | 'down' | 'fast' | null;
  density: number;
}

/**
 * Curated lexicon for lyric accent extraction.
 * Hand-tuned per demo track for camera-ready precision.
 */
export interface LyricLexicons {
  color: Record<string, string>;        // "blue" → "#4287f5"
  energy: {
    high: string[];                     // ["let's go", "turn up", "ay", "run it"]
    low: string[];                      // ["slow", "down", "quiet", "soft"]
  };
  weather: Record<string, 'rain' | 'fire' | 'frost' | 'bloom' | 'flash'>;
  motion: {
    up: string[];
    down: string[];
    fast: string[];
  };
}

// ============================================================================
// RENDERER CONFIGURATION
// ============================================================================

/**
 * Configuration for the p5.js or GLSL renderer.
 */
export interface RendererConfig {
  width: number;
  height: number;
  type: 'p5' | 'glsl';
  targetFPS: number;  // Usually 60
}

// ============================================================================
// TRACK VISUAL CONFIG
// ============================================================================

/**
 * Complete baked visual configuration for a track.
 * Base + rhythm are persistent; accents are runtime-only.
 */
export interface TrackVisualConfig {
  trackId: string;
  baseAesthetic: BaseAesthetic;
  rhythm: RhythmData;
  // Lyric accents NOT baked - runtime analysis only
}
