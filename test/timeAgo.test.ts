// @vitest-environment jsdom
//
// (jsdom because timeAgo reads the active locale, which touches localStorage.)
import { describe, expect, it } from "vitest";
import { timeAgo } from "../src/ui";

const NOW = 1_700_000_000_000;
const ago = (ms: number) => timeAgo(NOW - ms, NOW);

describe("timeAgo", () => {
  it("uses coarse, human buckets", () => {
    // Wording now comes from Intl.RelativeTimeFormat (style "short") rather than hand-built strings, so
    // English shifted slightly from the old "2 min ago" / "2 h ago" / "3 d ago". Taken deliberately: CLDR
    // knows every locale's phrasing and plural boundaries, so a second language needs no catalogue work
    // for relative times at all.
    expect(ago(5_000)).toBe("just now");
    expect(ago(2 * 60_000)).toBe("2 min. ago");
    expect(ago(2 * 3_600_000)).toBe("2 hr. ago");
    expect(ago(3 * 86_400_000)).toBe("3 days ago");
  });

  it("singularises without a hand-written plural rule", () => {
    // The old code emitted "1 min ago" from a template; Intl picks the singular per locale.
    expect(ago(60_000)).toBe("1 min. ago");
    expect(ago(86_400_000)).toBe("1 day ago");
  });

  it("falls back to a date past a week", () => {
    const out = ago(30 * 86_400_000);
    expect(out).not.toMatch(/ago|just now/);
    expect(out.length).toBeGreaterThan(0);
  });

  it("formats the fallback date for the APP's locale, not the browser default", () => {
    // The old implementation called bare toLocaleDateString(), which follows the browser rather than the
    // app's chosen language — a mismatch the moment the two differ.
    const out = ago(30 * 86_400_000);
    const expected = new Intl.DateTimeFormat("en").format(new Date(NOW - 30 * 86_400_000));
    expect(out).toBe(expected);
  });
});
