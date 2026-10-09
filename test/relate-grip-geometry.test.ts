import { describe, expect, it } from "vitest";
import {
  GRIP_BELOW_CENTER,
  collapseToggleTopPx,
  relateGripRectPx,
  relateGripTopCss,
} from "../src/mindmap/flow/relateGripGeometry";

// Permanent clearance test for the node's tip corner (outward edge — right for a right-growing branch,
// left for a left-growing one; grip + collapse toggle always mirror together via tipLeft, so the
// geometry only needs to know whether a toggle shares that edge, not which side it is). The px helper
// mirrors the CSS `top` exactly (shared constants), so this guards the real layout, not a parallel copy.

describe("relate-grip vs collapse-toggle clearance", () => {
  // Representative node heights: single-line (~30px) up to a tall multi-line/chips node.
  const HEIGHTS = [28, 30, 32, 36, 40, 48, 56, 66, 100];

  it("the grip clears the same-edge collapse toggle at every node height", () => {
    for (const h of HEIGHTS) {
      const grip = relateGripRectPx(h, /* sameEdgeToggle */ true);
      const toggleTop = collapseToggleTopPx(h);
      expect(
        grip.bottom,
        `h=${h}: grip.bottom ${grip.bottom} must be ≤ toggle.top ${toggleTop}`,
      ).toBeLessThanOrEqual(toggleTop);
    }
  });

  it("without a same-edge toggle the grip keeps its full below-centre offset", () => {
    for (const h of HEIGHTS) {
      const grip = relateGripRectPx(h, /* sameEdgeToggle */ false);
      // top point = 50% + 16; element top = that − 8 (translateY(-50%)).
      expect(grip.top).toBeCloseTo(0.5 * h + GRIP_BELOW_CENTER - 8, 5);
    }
  });

  it("emits a clamped min() only when a same-edge toggle is present", () => {
    expect(relateGripTopCss(false)).toBe("calc(50% + 16px)");
    expect(relateGripTopCss(true)).toBe("min(calc(50% + 16px), calc(100% - 20px))");
  });

  it("the clamp only bites on short nodes (tall nodes keep the +16 offset)", () => {
    // Tall node: below-centre (0.5·100+16=66) is already above the clamp (100−20=80) → unchanged.
    expect(relateGripRectPx(100, true).top).toBeCloseTo(0.5 * 100 + GRIP_BELOW_CENTER - 8, 5);
    // Short node: the clamp (h−20) wins, pulling the grip up off the toggle.
    expect(relateGripRectPx(32, true).top).toBeLessThan(0.5 * 32 + GRIP_BELOW_CENTER - 8);
  });
});
