// Pure helpers for the presenter pacing timer (the ticking lives in the component; these are the
// deterministic bits worth unit-testing): clock formatting + the pacing colour against a talk budget.

/** Seconds → `M:SS` (or `H:MM:SS` past an hour). Clamps negatives to 0. */
export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

// Pacing palette — neutral when no budget is set, then green → amber → red as the talk runs long.
export const PACING = {
  neutral: "#cecbf6",
  ok: "#7ae582",
  warn: "#fcc34a",
  over: "#ff6b5b",
} as const;

/** Colour the elapsed clock against an optional total budget (seconds). A 0/undefined budget means "no
 *  pacing set" → neutral. Otherwise green with time to spare, amber in the final 20%, red once over. */
export function pacingColor(elapsedSeconds: number, budgetSeconds: number): string {
  if (!budgetSeconds || budgetSeconds <= 0) return PACING.neutral;
  const ratio = elapsedSeconds / budgetSeconds;
  if (ratio >= 1) return PACING.over;
  if (ratio >= 0.8) return PACING.warn;
  return PACING.ok;
}
