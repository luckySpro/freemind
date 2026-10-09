// Pure helpers for topic start/due dates (stored as ISO "YYYY-MM-DD" on TaskInfo). ISO date
// strings sort and compare lexicographically = chronologically, so the comparisons here are plain
// string compares. `todayISO()` is the one impure helper (reads the clock) — everything else takes
// `today` as an argument so it stays deterministic + unit-tested. Drives the node date chip, the
// overdue highlight, and the Power Filter's due criterion.

import { type Locale, getLocale } from "./i18n/registry";

const pad = (n: number) => String(n).padStart(2, "0");

// The date chip's formatter, cached per locale. `Intl.DateTimeFormat` is comparatively expensive to
// construct and `formatDateShort` runs once per dated node — including inside the SVG exporter, which
// walks the whole map — so building one per call would be a real cost on a large export.
let shortDateFmt: { locale: Locale; fmt: Intl.DateTimeFormat } | null = null;
function shortDateFormatter(): Intl.DateTimeFormat {
  const locale = getLocale();
  if (shortDateFmt?.locale !== locale)
    shortDateFmt = { locale, fmt: new Intl.DateTimeFormat(locale, dateChipOptions) };
  return shortDateFmt.fmt;
}
const dateChipOptions: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

/** Compact date label for the node chip — "Jun 20" in English, "20. jun." in Danish (returns the input
 *  unchanged if it isn't an ISO date).
 *
 *  Formatted through `Intl` rather than a hardcoded English `MONTHS` table, so month names and the
 *  day/month ORDER both follow the locale — an English table gets the order wrong for most of the
 *  world even after translating the names.
 *
 *  The ISO string is split and rebuilt as LOCAL midnight, matching `addDaysISO`/`isoWeekday` above.
 *  Two wrong ways to do this, both verified in `America/New_York`: `new Date("2026-06-20")` parses as
 *  UTC midnight and renders as the 19th, and so does `Date.UTC(...)` — because `Intl.DateTimeFormat`
 *  formats in the LOCAL zone unless told otherwise, so building a UTC instant only moves the bug. Local
 *  midnight formatted locally is the pairing that holds. (`timeZone: "UTC"` on both sides also works;
 *  local is chosen to match the rest of the module.)
 *
 *  Shared with the SVG exporter (`flow/exportSvg.ts`) as well as the canvas chip (`Badge.tsx`), which
 *  is what keeps canvas == export: both sides get the same string from the same formatter. */
export function formatDateShort(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return shortDateFormatter().format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** The inline task-info row (MindManager schedule/assignment line): "▶ start · Nd · @resources",
 *  with only the present fields shown. Single source so the live node (TopicNode) and the SVG
 *  exporter emit byte-identical text — canvas == export. Pure. */
export function taskInfoLine(task: {
  start?: string;
  durationDays?: number;
  resources?: string[];
}): string {
  return [
    task.start ? `▶ ${formatDateShort(task.start)}` : null,
    task.durationDays ? `${task.durationDays}d` : null,
    task.resources?.length ? `@${task.resources.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("   ·   ");
}

/** Today's local date as "YYYY-MM-DD". The only clock-reading helper (kept out of the tested set). */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** ISO date `n` days after `iso` (local calendar arithmetic; handles month/year rollover). Pure. */
export function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

// Weekday names → index (0=Sun..6=Sat), full + common abbreviations, for natural-language dates.
const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  weds: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

/** The weekday index (0=Sun..6=Sat) of an ISO date, via local-calendar arithmetic. */
function isoWeekday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

/**
 * Resolve a natural-language date expression to an ISO "YYYY-MM-DD" string. Pure — `today` is passed in
 * as ISO so it stays deterministic + unit-tested (mirrors the rest of this module). Supported,
 * case-insensitively and trim-tolerant:
 *   - "" (empty / whitespace) → "" — clears the field
 *   - a literal ISO date "YYYY-MM-DD" (validated: an impossible date like 2026-02-30 is rejected)
 *   - "today" / "tomorrow" / "yesterday"
 *   - "+Nd" / "-Nd" (N days from today; the trailing "d"/"day"/"days" is required)
 *   - a weekday ("friday", "fri") or "next <weekday>" — BOTH the soonest *future* occurrence of that
 *     weekday (today counts as passed, so "monday" on a Monday jumps a week)
 * Returns `null` when the input can't be parsed (the caller leaves the field unchanged + hints).
 */
export function parseNaturalDate(input: string, today: string): string | null {
  const raw = input.trim();
  if (!raw) return ""; // empty clears the date
  const s = raw.toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    // Round-trip through the local-calendar arithmetic: a normalised value that differs from the input
    // (e.g. 2026-02-30 → 2026-03-02) means the input wasn't a real calendar date.
    return addDaysISO(raw, 0) === raw ? raw : null;
  }
  if (s === "today") return today;
  if (s === "tomorrow") return addDaysISO(today, 1);
  if (s === "yesterday") return addDaysISO(today, -1);
  const rel = /^([+-])\s*(\d+)\s*d(?:ays?)?$/.exec(s);
  if (rel) return addDaysISO(today, (rel[1] === "-" ? -1 : 1) * Number(rel[2]));
  const wd = /^(?:next\s+)?([a-z]+)$/.exec(s);
  if (wd && wd[1] in WEEKDAYS) {
    const delta = (WEEKDAYS[wd[1]] - isoWeekday(today) + 7) % 7 || 7; // strictly future (1..7)
    return addDaysISO(today, delta);
  }
  return null;
}

/** Past its due date and not finished. Pure (pass `today`). */
export function isOverdue(
  due: string | undefined,
  progress: number | undefined,
  today: string,
): boolean {
  return !!due && (progress ?? 0) < 1 && due < today;
}

/** Due within the next `days` (today..+days inclusive) and not finished — upcoming, not yet overdue. */
export function isDueSoon(
  due: string | undefined,
  progress: number | undefined,
  today: string,
  days = 7,
): boolean {
  if (!due || (progress ?? 0) >= 1) return false;
  return due >= today && due <= addDaysISO(today, days);
}
