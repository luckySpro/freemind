// Back-compat shim for the shared toolbar-control styles. The control/input style objects now live
// with the UI primitives (src/design/primitives.tsx), built from the design tokens — re-exported
// here so the existing `from "./ui"` imports across App and the panels keep working unchanged. Same
// computed style; the values just have names now.
import { getLocale, t } from "./i18n";

export { controlStyle, inputStyle } from "./design/primitives";

/** Human-friendly relative time ("just now", "5 min. ago", "2 hr. ago", "3 days ago", else a date).
 *  `now` is injectable for deterministic tests. Used by the version-history list.
 *
 *  The wording comes from `Intl.RelativeTimeFormat`, not from hand-built strings. That matters for more
 *  than tidiness: CLDR already knows every locale's phrasing and plural boundaries, so Danish reads
 *  "2 min. siden" and Slavic languages get their four-way plurals with no catalogue work at all. The
 *  cost is that English shifted very slightly from the old hand-rolled wording — "2 h ago" is now
 *  "2 hr. ago" — because no Intl style matches that exactly and inventing one per locale would throw
 *  away the reason for using Intl. "just now" has no relative-time equivalent, so it stays a message. */
export function timeAgo(ts: number, now: number = Date.now()): string {
  const sec = Math.max(0, Math.round((now - ts) / 1000));
  if (sec < 45) return t("time.justNow");
  const locale = getLocale();
  const rel = new Intl.RelativeTimeFormat(locale, { numeric: "always", style: "short" });
  const min = Math.round(sec / 60);
  if (min < 60) return rel.format(-min, "minute");
  const hr = Math.round(min / 60);
  if (hr < 24) return rel.format(-hr, "hour");
  const day = Math.round(hr / 24);
  if (day < 7) return rel.format(-day, "day");
  // Past a week the absolute date is more useful — and formatted for the APP's locale rather than
  // whatever the browser defaults to, which is what the bare toLocaleDateString() used to do.
  return new Intl.DateTimeFormat(locale).format(new Date(ts));
}
