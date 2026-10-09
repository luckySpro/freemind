import { t } from "./i18n";
// Task priority — a small, sortable/filterable level stored on TaskInfo.priority, the full 1..9 range
// MindManager uses (1 = highest .. 9 = lowest). Distinct from the emoji priority markers in that it's a
// structured value the Power Filter can match. Pure constants shared by the node badge, the Info panel,
// the exporter, and the filter.

export const PRIORITY_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

// Only 1–3 carry a named label (High/Med/Low, this app's own convention) — MindManager itself just
// numbers priority 1–9, so 4–9 read as their number (priorityLabel's fallback), matching that norm.
// Resolved through `priorityLabel()` rather than held in a module-scope Record — the Record was
// built once at import, so a t() inside it would have frozen. The KEYS (1/2/3) are the identity and
// stay numbers; only the display name is a message.
const PRIORITY_LABEL_KEYS: Record<
  number,
  "common.priorityHigh" | "common.priorityMed" | "common.priorityLow"
> = { 1: "common.priorityHigh", 2: "common.priorityMed", 3: "common.priorityLow" };

// A red→grey urgency gradient across all 9 levels. 1–3 are the original High/Med/Low colours
// (unchanged, so existing maps don't visually shift); 4–9 continue the gradient down to the neutral
// grey this app used for imported-only 4–9 values before the picker covered the full range.
export const PRIORITY_COLOR: Record<number, string> = {
  1: "#e23b3b",
  2: "#d98a17",
  3: "#3b8bd4",
  4: "#4f9bd4",
  5: "#3fa796",
  6: "#4caf7d",
  7: "#7cb342",
  8: "#9e9e42",
  9: "#6b7280",
};

/** Whether this level has a NAME (1-3) rather than reading as its bare number. Exported so callers can
 *  pick the right message instead of testing the rendered string, which would break once translated. */
export function priorityHasName(p: number): boolean {
  return p in PRIORITY_LABEL_KEYS;
}

export function priorityLabel(p: number): string {
  const key = PRIORITY_LABEL_KEYS[p];
  return key ? t(key) : String(p);
}

export function priorityColor(p: number): string {
  return PRIORITY_COLOR[p] ?? "#6b7280";
}

/** The next priority when clicking the on-canvas chip: cycle through the full 1–9 range then clear —
 *  undefined → 1 → 2 → … → 9 → undefined. Pure (drives the click-to-cycle priority chip). */
export function cyclePriority(current: number | undefined): number | undefined {
  if (current === undefined) return 1;
  if (current >= 1 && current < 9) return current + 1;
  return undefined;
}
