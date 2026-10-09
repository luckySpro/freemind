// `formatDateShort` must not slip a day west of Greenwich.
//
// This lives in its OWN file because it sets `process.env.TZ` before the module under test is loaded —
// the rest of the date suite does local-calendar arithmetic against a fixed `TODAY`, and moving the
// zone under it would shift those expectations for unrelated reasons.
//
// The `vitest` import is hoisted above the assignment below, which is fine: it doesn't read the zone.
// `src/taskDate` is imported dynamically INSIDE the test, after the zone is set, so its formatter is
// built against `America/New_York`. (An earlier version used top-level await plus an `export {}` to
// satisfy tsc's "must be a module" rule — which biome rejects with "Do not export from a test file".)
//
// Why it matters, and why the obvious fixes don't work — all three verified in `America/New_York`:
//   `new Date("2026-06-20")`            → UTC midnight  → formats as "Jun 19"   ✗
//   `new Date(Date.UTC(2026, 5, 20))`   → UTC midnight  → formats as "Jun 19"   ✗
//   `new Date(2026, 5, 20)`             → local midnight → "Jun 20"             ✓
//
// The second is the trap: building a UTC instant looks like the fix, but `Intl.DateTimeFormat` formats
// in the LOCAL zone unless given `timeZone`, so it only moves the bug. An earlier draft shipped exactly
// that with a comment claiming it was safe; the claim was caught only by checking whether this test
// could fail at all, on a UTC+1 machine where it could not.
import { describe, expect, it } from "vitest";

process.env.TZ = "America/New_York";

describe("formatDateShort in a negative-offset timezone", () => {
  it("renders the calendar date it was given, not the day before", async () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("America/New_York");
    const { formatDateShort } = await import("../src/taskDate");
    expect(formatDateShort("2026-06-20")).toBe("Jun 20");
    expect(formatDateShort("2026-01-01")).toBe("Jan 1");
    expect(formatDateShort("2026-12-31")).toBe("Dec 31");
  });
});
