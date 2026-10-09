import { describe, expect, it } from "vitest";
import { type SnapBox, computeSnap } from "../src/mindmap/flow/snap";

// computeSnap aligns a dragged box's edges/centres to nearby boxes and returns the snapped position +
// guide lines (free-canvas alignment). Pure geometry.
const box = (x: number, y: number, w = 100, h = 40): SnapBox => ({ x, y, w, h });

describe("computeSnap", () => {
  it("snaps a near-aligned left edge onto another box's left edge and emits a vertical guide", () => {
    const other = box(200, 0);
    const dragged = box(204, 200); // 4px off the left edge (within the 6px threshold)
    const r = computeSnap(dragged, [other]);
    expect(r.x).toBe(200); // snapped to the other's left edge
    expect(r.y).toBe(200); // no vertical match → unchanged
    const v = r.guides.find((g) => g.axis === "x");
    expect(v?.pos).toBe(200);
    expect(v?.start).toBe(0); // spans both boxes' vertical extent
    expect(v?.end).toBe(240);
  });

  it("snaps centres on both axes (a vertical + a horizontal guide)", () => {
    const other = box(200, 200); // centre (250, 220)
    const dragged = box(202, 202); // centre (252, 222) — both within threshold of the other's centre
    const r = computeSnap(dragged, [other]);
    expect(r.x).toBe(200);
    expect(r.y).toBe(200);
    expect(r.guides.map((g) => g.axis).sort()).toEqual(["x", "y"]);
  });

  it("leaves the position unchanged when nothing is within the threshold", () => {
    const r = computeSnap(box(500, 500), [box(0, 0)]);
    expect(r).toEqual({ x: 500, y: 500, guides: [] });
  });

  it("picks the closest candidate when several are within range", () => {
    // right edge of dragged (x=104+100=204... use widths) — make two others, one closer.
    const dragged = box(100, 0, 100, 40); // left=100
    const near = box(103, 300); // left=103 → delta 3
    const far = box(106, 400); // left=106 → delta 6
    const r = computeSnap(dragged, [near, far]);
    expect(r.x).toBe(103); // snapped to the closer one
  });
});
