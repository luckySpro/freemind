// Single source of truth for a topic's text-wrap width (NodeStyle.maxWidth). The inspector's Wrap control
// is a snap slider over this scale: continuous between WRAP_MIN and the node's box cap (WRAP_MAX = "None"),
// with the three legacy presets as sticky tick marks. Pure + tested so the slider, the snapping, and the
// string<->number serialisation can't drift. The node box hard-caps at 320px (TopicNode), so WRAP_MAX and
// an empty maxWidth render identically — hence the max end means "no wrap cap" (None).

export const WRAP_MIN = 140;
export const WRAP_MAX = 320;

export interface WrapPreset {
  px: number;
  label: string;
}
export const WRAP_PRESETS: readonly WrapPreset[] = [
  { px: 160, label: "Narrow" },
  { px: 220, label: "Medium" },
  { px: 300, label: "Wide" },
];

/** Parse a stored `style.maxWidth` into a slider value. Empty/unset → WRAP_MAX ("None"); clamped to range. */
export function styleToWrapWidth(maxWidth?: string): number {
  if (!maxWidth) return WRAP_MAX;
  const n = Number.parseInt(maxWidth, 10);
  if (Number.isNaN(n)) return WRAP_MAX;
  return Math.min(WRAP_MAX, Math.max(WRAP_MIN, n));
}

/** Serialise a slider value back to `style.maxWidth`. The max end clears the cap → "None". */
export function wrapWidthToStyle(px: number): string {
  return px >= WRAP_MAX ? "" : `${px}px`;
}

/** Clamp to range, then snap to the nearest preset or the None end when within `tol`px; else the free value. */
export function snapWrapWidth(px: number, tol = 8): number {
  const v = Math.min(WRAP_MAX, Math.max(WRAP_MIN, px));
  const targets = [...WRAP_PRESETS.map((p) => p.px), WRAP_MAX];
  let best = v;
  let bestDist = tol + 1;
  for (const t of targets) {
    const d = Math.abs(t - v);
    if (d <= tol && d < bestDist) {
      best = t;
      bestDist = d;
    }
  }
  return best;
}

/** Human label for a slider value: a preset name on a tick, "None" at the max, else the raw px. */
export function wrapWidthLabel(px: number): string {
  if (px >= WRAP_MAX) return "None";
  const preset = WRAP_PRESETS.find((p) => p.px === px);
  return preset ? preset.label : `${px}px`;
}
