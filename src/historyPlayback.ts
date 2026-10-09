// Pure stepping logic for version-history timeline playback (see App + HistoryPanel /
// PlaybackBar). Kept React/IndexedDB-free so the frame maths is unit-tested in isolation.

/** Clamp a frame index into `[0, count - 1]`; returns 0 for an empty timeline. */
export function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(Math.trunc(index), count - 1));
}

/**
 * The next frame when playing forward. Returns the next index, or `null` when the
 * current frame is already the last one — the signal that playback should stop at
 * the end rather than loop.
 */
export function nextPlaybackIndex(index: number, count: number): number | null {
  if (count <= 0) return null;
  if (index >= count - 1) return null;
  return index + 1;
}

/**
 * What the play/pause button should do. From a stopped state at the *last* frame,
 * pressing play rewinds to the start (so it doesn't sit dead at the end); otherwise
 * it just toggles. Returns the next `{ index, playing }`.
 */
export function togglePlay(
  index: number,
  count: number,
  playing: boolean,
): { index: number; playing: boolean } {
  if (playing) return { index, playing: false };
  if (count > 0 && index >= count - 1) return { index: 0, playing: true }; // replay from the start
  return { index, playing: true };
}
