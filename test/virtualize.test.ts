import { describe, expect, it } from "vitest";
import { VIRTUALIZE_THRESHOLD, shouldVirtualize } from "../src/mindmap/flow/virtualize";

// Big-map virtualisation policy: only large maps render just their visible elements.
describe("shouldVirtualize", () => {
  it("is off below the threshold and on at/above it", () => {
    expect(shouldVirtualize(0)).toBe(false);
    expect(shouldVirtualize(VIRTUALIZE_THRESHOLD - 1)).toBe(false);
    expect(shouldVirtualize(VIRTUALIZE_THRESHOLD)).toBe(true);
    expect(shouldVirtualize(VIRTUALIZE_THRESHOLD + 1000)).toBe(true);
  });
});
