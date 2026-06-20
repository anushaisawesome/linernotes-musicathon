import type { PlayerState } from "./spotify-player";
import type { Review } from "./types";

/**
 * Sync Engine - Pure function to match lyrics and notes to playback position
 *
 * NO audio-to-video scoring (violates Spotify terms)
 * Sync to reported playback state only
 */

export interface LyricLine {
  time: {
    total: number; // milliseconds
    minutes: number;
    seconds: number;
    hundredths: number;
  };
  text: string;
}

export interface SyncedLyrics {
  lines: LyricLine[];
}

export interface ActiveAnnotations {
  activeLine: LyricLine | null;
  activeLineIndex: number;
  currentNote: {
    timestampSeconds: number;
    note: string;
    label?: string;
  } | null;
  firedMoments: Array<{
    timestampSeconds: number;
    note: string;
    label?: string;
  }>;
}

/**
 * Get active lyric line based on current playback position
 */
export function getActiveLyricLine(
  lyrics: SyncedLyrics | null,
  positionMs: number
): { line: LyricLine | null; index: number } {
  if (!lyrics || !lyrics.lines || lyrics.lines.length === 0) {
    return { line: null, index: -1 };
  }

  // Find the line that's currently active
  let activeIndex = -1;
  for (let i = lyrics.lines.length - 1; i >= 0; i--) {
    if (positionMs >= lyrics.lines[i].time.total) {
      activeIndex = i;
      break;
    }
  }

  if (activeIndex === -1) {
    return { line: null, index: -1 };
  }

  return {
    line: lyrics.lines[activeIndex],
    index: activeIndex,
  };
}

/**
 * Get user's notes for the current track
 */
export function getTrackNotes(review: Review | null): Array<{
  timestampSeconds: number;
  note: string;
  label?: string;
}> {
  if (!review || !review.notes) {
    return [];
  }

  return review.notes.map((note) => ({
    timestampSeconds: note.timestampSeconds,
    note: note.note,
    label: note.label,
  }));
}

/**
 * Get the note that should be displayed at current position
 */
export function getCurrentNote(
  notes: Array<{ timestampSeconds: number; note: string; label?: string }>,
  positionMs: number,
  windowMs: number = 5000 // Show note for 5 seconds after timestamp
): { timestampSeconds: number; note: string; label?: string } | null {
  const positionSeconds = positionMs / 1000;

  // Find the most recent note within the window
  for (let i = notes.length - 1; i >= 0; i--) {
    const note = notes[i];
    const noteTime = note.timestampSeconds;
    const elapsed = positionSeconds - noteTime;

    // Note is active if we're past its timestamp but within the window
    if (elapsed >= 0 && elapsed <= windowMs / 1000) {
      return note;
    }
  }

  return null;
}

/**
 * Get all moments that have been passed (for marking as "heard")
 */
export function getFiredMoments(
  notes: Array<{ timestampSeconds: number; note: string; label?: string }>,
  positionMs: number
): Array<{ timestampSeconds: number; note: string; label?: string }> {
  const positionSeconds = positionMs / 1000;

  return notes.filter((note) => positionSeconds >= note.timestampSeconds);
}

/**
 * Main sync function - combines all annotations for current playback state
 */
export function getActiveAnnotations(
  playerState: PlayerState,
  lyrics: SyncedLyrics | null,
  review: Review | null
): ActiveAnnotations {
  const { positionMs } = playerState;

  // Get active lyric line
  const { line: activeLine, index: activeLineIndex } = getActiveLyricLine(lyrics, positionMs);

  // Get user's notes for this track
  const notes = getTrackNotes(review);

  // Get currently displayed note (if any)
  const currentNote = getCurrentNote(notes, positionMs);

  // Get all moments that have been passed
  const firedMoments = getFiredMoments(notes, positionMs);

  return {
    activeLine,
    activeLineIndex,
    currentNote,
    firedMoments,
  };
}

/**
 * Format timestamp for display (m:ss)
 */
export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
