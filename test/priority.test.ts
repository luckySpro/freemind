import { describe, expect, it } from "vitest";
import { PRIORITY_LEVELS, cyclePriority, priorityColor, priorityLabel } from "../src/priority";

// TaskInfo.priority is modelled 1..9, MindManager's full range (1 = highest). priorityLabel/
// priorityColor must cover the whole range and never fall back to a meaningless "?" / grey #888.
describe("priority label + colour (full 1–9 range, never '?')", () => {
  it("keeps the 1–3 High/Med/Low scheme and its colours", () => {
    expect(priorityLabel(1)).toBe("High");
    expect(priorityLabel(2)).toBe("Med");
    expect(priorityLabel(3)).toBe("Low");
    expect(priorityColor(1)).toBe("#e23b3b");
    expect(priorityColor(3)).toBe("#3b8bd4");
  });

  it("renders 4–9 as its number (MindManager itself just numbers priority, no named label)", () => {
    for (const p of [4, 5, 6, 7, 8, 9]) {
      expect(priorityLabel(p)).toBe(String(p));
      expect(priorityLabel(p)).not.toBe("?");
    }
  });

  it("gives every level 1–9 a distinct, non-fallback colour", () => {
    const colors = PRIORITY_LEVELS.map((p) => priorityColor(p));
    expect(new Set(colors).size).toBe(PRIORITY_LEVELS.length);
    expect(colors).not.toContain("#888");
  });

  it("falls back to neutral grey outside the modelled 1–9 range", () => {
    expect(priorityColor(0)).toBe("#6b7280");
    expect(priorityColor(10)).toBe("#6b7280");
  });
});

describe("cyclePriority (click-to-cycle the on-canvas chip)", () => {
  it("steps undefined → 1 → 2 → … → 9 → undefined across the full range", () => {
    let p: number | undefined;
    for (let expected = 1; expected <= 9; expected++) {
      p = cyclePriority(p);
      expect(p).toBe(expected);
    }
    expect(cyclePriority(p)).toBeUndefined();
  });
});
