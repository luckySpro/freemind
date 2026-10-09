import { describe, expect, it } from "vitest";
import { PACING, mmss, pacingColor } from "../src/present/timer";

// Pure helpers behind the presenter pacing timer: clock formatting + the green→amber→red colour vs a
// talk budget. The ticking itself is exercised in presentation.test.tsx (fake timers).

describe("mmss", () => {
  it("formats seconds as M:SS, zero-padding the seconds", () => {
    expect(mmss(0)).toBe("0:00");
    expect(mmss(9)).toBe("0:09");
    expect(mmss(75)).toBe("1:15");
    expect(mmss(600)).toBe("10:00");
  });

  it("rolls into H:MM:SS past an hour and clamps negatives to 0:00", () => {
    expect(mmss(3661)).toBe("1:01:01");
    expect(mmss(-5)).toBe("0:00");
  });
});

describe("pacingColor", () => {
  it("is neutral when no budget is set (0 / negative)", () => {
    expect(pacingColor(120, 0)).toBe(PACING.neutral);
    expect(pacingColor(120, -1)).toBe(PACING.neutral);
  });

  it("greens with time to spare, ambers in the final 20%, reds once over budget", () => {
    const budget = 600; // 10 min
    expect(pacingColor(60, budget)).toBe(PACING.ok); // 10% in
    expect(pacingColor(480, budget)).toBe(PACING.warn); // 80% — into the warning band
    expect(pacingColor(600, budget)).toBe(PACING.over); // exactly at budget = over
    expect(pacingColor(900, budget)).toBe(PACING.over); // past budget
  });
});
