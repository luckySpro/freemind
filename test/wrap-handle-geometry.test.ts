import { describe, expect, it } from "vitest";
import {
  WRAP_HANDLE_H,
  WRAP_HANDLE_MIN_NODE_H,
  WRAP_HANDLE_TOP,
  WRAP_HANDLE_W,
  wrapHandleFits,
} from "../src/mindmap/flow/wrapHandleGeometry";

// The clearance rule the on-canvas wrap grip (10b Layer 2) was gated behind: the grip may only appear
// when the node is tall enough that its top-anchored bar can't overlap the centred ＋/relate cluster.

describe("wrapHandleGeometry — Layer 2 clearance gate", () => {
  it("shows the grip only at or above the minimum node height", () => {
    expect(wrapHandleFits(WRAP_HANDLE_MIN_NODE_H)).toBe(true);
    expect(wrapHandleFits(WRAP_HANDLE_MIN_NODE_H - 1)).toBe(false);
    expect(wrapHandleFits(240)).toBe(true); // a tall, multi-line node
    expect(wrapHandleFits(40)).toBe(false); // a single-line node: the ＋ owns the edge
    expect(wrapHandleFits(0)).toBe(false);
  });

  it("guarantees the top-anchored bar clears the centred ＋/relate cluster at the threshold", () => {
    // The ＋ / relate targets are 24px and vertically centred → they span [H/2 − 12, H/2 + 12].
    const barBottom = WRAP_HANDLE_TOP + WRAP_HANDLE_H;
    const clusterTop = WRAP_HANDLE_MIN_NODE_H / 2 - 12;
    expect(barBottom).toBeLessThanOrEqual(clusterTop); // no overlap at the smallest allowed height
  });

  it("exposes positive bar dimensions", () => {
    expect(WRAP_HANDLE_W).toBeGreaterThan(0);
    expect(WRAP_HANDLE_H).toBeGreaterThan(0);
    expect(WRAP_HANDLE_TOP).toBeGreaterThanOrEqual(0);
    expect(WRAP_HANDLE_MIN_NODE_H).toBeGreaterThan(WRAP_HANDLE_H);
  });
});
