/**
 * Visualiser Engine
 *
 * Core orchestrator: merges all 4 layers into a single VisualState each frame.
 * - Base aesthetic (persistent, from genre + audio features)
 * - Rhythm (persistent, from beat tracking)
 * - Lyric accents (real-time, from current line)
 * - Moment override (from favourite-bit markers)
 *
 * Based on Visualiser_Pipeline.md spec.
 */

import type { VisualState, BaseAesthetic, RhythmData, TrackVisualConfig } from './visualiser-types';
import { analyzeLyricAccents } from './visualiser-accent-analyzer';

// ============================================================================
// VISUALISER ENGINE
// ============================================================================

export class VisualiserEngine {
  private baseAesthetic: BaseAesthetic;
  private rhythm: RhythmData | null;
  private lastLyricLine: string = '';

  constructor(baseAesthetic: BaseAesthetic, rhythm?: RhythmData) {
    this.baseAesthetic = baseAesthetic;
    this.rhythm = rhythm || null;
  }

  /**
   * Compute the current VisualState for the given playback position.
   * Called at 60fps in the rendering loop.
   *
   * @param positionMs - Current playback position in milliseconds
   * @param isPlaying - Whether playback is active
   * @param currentLyricLine - The currently-playing lyric line text
   * @param momentActive - Whether a favourite-bit moment is currently firing
   * @returns Complete VisualState for rendering
   */
  public getVisualState(
    positionMs: number,
    isPlaying: boolean,
    currentLyricLine?: string,
    momentActive?: boolean
  ): VisualState {
    // ────────────────────────────────────────────────────────────────────────
    // Layer 1: Base Aesthetic (persistent)
    // ────────────────────────────────────────────────────────────────────────
    const visualState: VisualState = {
      palette: this.baseAesthetic.palette,
      texture: this.baseAesthetic.texture,
      motion: this.baseAesthetic.motion,
      beatPhase: 0,
      baseIntensity: 0.5,
      energyMultiplier: 1.0,
      density: 0.5,
    };

    // ────────────────────────────────────────────────────────────────────────
    // Layer 2: Rhythm (beat phase + intensity)
    // ────────────────────────────────────────────────────────────────────────
    if (this.rhythm && isPlaying) {
      const { firstBeatMs, beatIntervalMs } = this.rhythm;

      // Calculate beat phase (0-1, where 0 = downbeat)
      const timeSinceFirstBeat = positionMs - firstBeatMs;
      if (timeSinceFirstBeat >= 0) {
        const phase = (timeSinceFirstBeat % beatIntervalMs) / beatIntervalMs;
        visualState.beatPhase = phase;
      }

      // Base intensity from BPM (faster = more intense)
      visualState.baseIntensity = Math.min(1.0, this.rhythm.bpm / 180);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Layer 3: Lyric Accents (real-time, from current line)
    // ────────────────────────────────────────────────────────────────────────
    if (currentLyricLine && currentLyricLine !== this.lastLyricLine) {
      // New lyric line → analyze it
      this.lastLyricLine = currentLyricLine;
    }

    if (currentLyricLine) {
      const accent = analyzeLyricAccents(currentLyricLine);

      // Merge accent into visual state
      if (accent.accentColour) {
        visualState.accentColour = accent.accentColour;
      }
      visualState.energyMultiplier = accent.energyMultiplier;
      visualState.effect = accent.effect;
      visualState.direction = accent.direction;
      visualState.density = accent.density;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Layer 4: Moment Override (favourite-bit surge)
    // ────────────────────────────────────────────────────────────────────────
    if (momentActive) {
      visualState.momentOverride = true;
      // Surge the energy when a moment fires
      visualState.energyMultiplier = Math.min(2.0, visualState.energyMultiplier * 1.5);
    }

    return visualState;
  }

  /**
   * Update the base aesthetic (e.g., if user switches tracks).
   */
  public setBaseAesthetic(aesthetic: BaseAesthetic) {
    this.baseAesthetic = aesthetic;
  }

  /**
   * Update the rhythm data (e.g., if user switches tracks).
   */
  public setRhythm(rhythm: RhythmData) {
    this.rhythm = rhythm;
  }
}

// ============================================================================
// BEAT PHASE CALCULATOR (standalone utility)
// ============================================================================

/**
 * Calculate beat phase for a given position and rhythm data.
 * Used when you don't need the full engine, just the beat phase.
 *
 * @param positionMs - Current playback position in milliseconds
 * @param rhythm - Rhythm data (bpm, firstBeatMs, beatIntervalMs)
 * @returns Beat phase (0-1, where 0 = downbeat)
 */
export function calculateBeatPhase(positionMs: number, rhythm: RhythmData): number {
  const { firstBeatMs, beatIntervalMs } = rhythm;
  const timeSinceFirstBeat = positionMs - firstBeatMs;

  if (timeSinceFirstBeat < 0) return 0;

  const phase = (timeSinceFirstBeat % beatIntervalMs) / beatIntervalMs;
  return phase;
}

// ============================================================================
// MOCK RHYTHM DATA (for development)
// ============================================================================

/**
 * Generate mock rhythm data for testing (120 BPM, standard 4/4 time).
 */
export function createMockRhythm(bpm: number = 120): RhythmData {
  const beatIntervalMs = (60 / bpm) * 1000;

  return {
    bpm,
    beatIntervalMs,
    firstBeatMs: 0,  // Assumes track starts on downbeat
    beats: [],       // Would be populated by librosa
  };
}

// ============================================================================
// RUNTIME PREDICTOR (5Hz poll → 60fps prediction)
// ============================================================================

/**
 * Runtime position predictor for smooth 60fps visuals.
 * Polls player state at 5Hz, predicts position at 60fps.
 */
export class PositionPredictor {
  private polledPosMs: number = 0;
  private polledAt: number = 0;
  private isPlaying: boolean = false;

  /**
   * Update the predictor with a new player state poll (call at 5Hz).
   */
  public update(positionMs: number, isPlaying: boolean) {
    this.polledPosMs = positionMs;
    this.polledAt = Date.now();
    this.isPlaying = isPlaying;
  }

  /**
   * Get the predicted current position (call at 60fps).
   */
  public predict(): number {
    if (!this.isPlaying) {
      return this.polledPosMs;
    }

    const now = Date.now();
    const drift = now - this.polledAt;

    // Predict position: last polled position + time elapsed
    return this.polledPosMs + drift;
  }

  /**
   * Get whether playback is active.
   */
  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}
