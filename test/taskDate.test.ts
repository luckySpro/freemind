import { afterEach, describe, expect, it } from "vitest";
import { type Locale, setLocale } from "../src/i18n";
import {
  addDaysISO,
  formatDateShort,
  isDueSoon,
  isOverdue,
  parseNaturalDate,
} from "../src/taskDate";

const TODAY = "2026-06-14"; // a Sunday

describe("formatDateShort", () => {
  afterEach(() => setLocale("en"));

  it("formats an ISO date as 'Mon D'", () => {
    expect(formatDateShort("2026-06-20")).toBe("Jun 20");
    expect(formatDateShort("2026-01-05")).toBe("Jan 5");
  });
  it("returns the input unchanged when it isn't an ISO date", () => {
    expect(formatDateShort("whenever")).toBe("whenever");
  });

  it("follows the locale for BOTH the month name and the day/month order", () => {
    // The order is the half a translated month-name table would still get wrong: most of the world
    // writes the day first. Asserting the English output alone would pass against the old hardcoded
    // `MONTHS` array, so this activates a second locale — the path a real one will take.
    setLocale("da" as Locale);
    expect(formatDateShort("2026-06-20")).toBe("20. jun.");
    setLocale("en");
    expect(formatDateShort("2026-06-20")).toBe("Jun 20");
  });

  // The timezone case lives in test/taskDate-timezone.test.ts — it needs its own process.env.TZ, and
  // asserted here it could never fail on a UTC+1 machine.
});

describe("addDaysISO", () => {
  it("adds days, rolling over months and years", () => {
    expect(addDaysISO("2026-06-14", 7)).toBe("2026-06-21");
    expect(addDaysISO("2026-06-28", 7)).toBe("2026-07-05");
    expect(addDaysISO("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDaysISO("2026-06-14", -1)).toBe("2026-06-13");
  });
});

describe("isOverdue", () => {
  it("is true only for a past due date on an unfinished task", () => {
    expect(isOverdue("2026-06-13", 0.5, TODAY)).toBe(true);
    expect(isOverdue("2026-06-13", 1, TODAY)).toBe(false); // done
    expect(isOverdue("2026-06-14", 0, TODAY)).toBe(false); // due today, not past
    expect(isOverdue("2026-06-20", 0, TODAY)).toBe(false); // future
    expect(isOverdue(undefined, 0, TODAY)).toBe(false); // no date
    expect(isOverdue("2026-06-13", undefined, TODAY)).toBe(true); // no progress = not done
  });
});

describe("isDueSoon", () => {
  it("is true for an unfinished task due within the window (today..+7)", () => {
    expect(isDueSoon("2026-06-14", 0, TODAY)).toBe(true); // today
    expect(isDueSoon("2026-06-21", 0, TODAY)).toBe(true); // +7 edge
    expect(isDueSoon("2026-06-22", 0, TODAY)).toBe(false); // past the window
    expect(isDueSoon("2026-06-13", 0, TODAY)).toBe(false); // already overdue, not "soon"
    expect(isDueSoon("2026-06-16", 1, TODAY)).toBe(false); // done
    expect(isDueSoon(undefined, 0, TODAY)).toBe(false);
  });
  it("honours a custom window (days)", () => {
    expect(isDueSoon("2026-06-17", 0, TODAY, 3)).toBe(true); // within 3 days
    expect(isDueSoon("2026-06-18", 0, TODAY, 3)).toBe(false); // outside 3 days
  });
});

describe("parseNaturalDate", () => {
  it("clears on empty / whitespace", () => {
    expect(parseNaturalDate("", TODAY)).toBe("");
    expect(parseNaturalDate("   ", TODAY)).toBe("");
  });
  it("passes through a valid ISO date and rejects impossible ones", () => {
    expect(parseNaturalDate("2026-07-01", TODAY)).toBe("2026-07-01");
    expect(parseNaturalDate("2026-02-30", TODAY)).toBeNull();
    expect(parseNaturalDate("2026-13-01", TODAY)).toBeNull();
  });
  it("resolves today / tomorrow / yesterday", () => {
    expect(parseNaturalDate("today", TODAY)).toBe("2026-06-14");
    expect(parseNaturalDate("Tomorrow", TODAY)).toBe("2026-06-15");
    expect(parseNaturalDate("  yesterday ", TODAY)).toBe("2026-06-13");
  });
  it("resolves +Nd / -Nd offsets", () => {
    expect(parseNaturalDate("+7d", TODAY)).toBe("2026-06-21");
    expect(parseNaturalDate("+0d", TODAY)).toBe(TODAY);
    expect(parseNaturalDate("-2d", TODAY)).toBe("2026-06-12");
    expect(parseNaturalDate("+10 days", TODAY)).toBe("2026-06-24");
  });
  it("resolves weekdays as the soonest future occurrence (today counts as passed)", () => {
    // 2026-06-14 is a Sunday.
    expect(parseNaturalDate("monday", TODAY)).toBe("2026-06-15");
    expect(parseNaturalDate("next Friday", TODAY)).toBe("2026-06-19");
    expect(parseNaturalDate("fri", TODAY)).toBe("2026-06-19");
    expect(parseNaturalDate("sunday", TODAY)).toBe("2026-06-21"); // not today — a week ahead
  });
  it("returns null for gibberish", () => {
    expect(parseNaturalDate("someday", TODAY)).toBeNull();
    expect(parseNaturalDate("next quarter", TODAY)).toBeNull();
    expect(parseNaturalDate("42", TODAY)).toBeNull();
  });
});
