// Floating-edge geometry: connection points on node borders along the ray between centres.
// Pure functions with no dependencies — tests validate edge cases in box arithmetic.

import { describe, expect, it } from "vitest";
import {
  type Box,
  crosslinkBezier,
  curveFromHandle,
  floatingPoints,
  nodeAtPoint,
} from "../src/mindmap/flow/floating";

describe("floatingPoints (border-to-border geometry)", () => {
  it("connects two well-separated boxes", () => {
    const s: Box = { cx: 0, cy: 0, w: 100, h: 100 };
    const t: Box = { cx: 300, cy: 0, w: 100, h: 100 };

    const points = floatingPoints(s, t);

    expect(points.sx).toBe(50); // Right edge of source
    expect(points.sy).toBe(0);
    expect(points.tx).toBe(250); // Left edge of target
    expect(points.ty).toBe(0);
  });

  it("handles vertical edges (dx ≈ 0)", () => {
    const s: Box = { cx: 100, cy: 0, w: 100, h: 100 };
    const t: Box = { cx: 100, cy: 300, w: 100, h: 100 };

    const points = floatingPoints(s, t);

    expect(points.sx).toBe(100); // No horizontal shift
    expect(points.sy).toBe(50); // Bottom edge of source
    expect(points.tx).toBe(100);
    expect(points.ty).toBe(250); // Top edge of target
  });

  it("handles diagonal edges", () => {
    const s: Box = { cx: 0, cy: 0, w: 100, h: 100 };
    const t: Box = { cx: 200, cy: 200, w: 100, h: 100 };

    const points = floatingPoints(s, t);

    // Diagonal: scale factor determined by the limiting axis (squared rectangle)
    expect(points.sx).toBeCloseTo(50, 1); // x-offset
    expect(points.sy).toBeCloseTo(50, 1); // y-offset
    expect(points.tx).toBeCloseTo(150, 1);
    expect(points.ty).toBeCloseTo(150, 1);
  });

  it("handles degenerate source box (w=0, h=0)", () => {
    const s: Box = { cx: 100, cy: 100, w: 0, h: 0 };
    const t: Box = { cx: 200, cy: 100, w: 100, h: 100 };

    const points = floatingPoints(s, t);

    // w=0 and h=0 are converted to 1 internally (via || 1)
    // Point should be near source centre heading toward target
    expect(Math.abs(points.sx - 100)).toBeLessThan(3);
    expect(points.sy).toBeCloseTo(100, 0);
    expect(points.tx).toBeGreaterThan(100); // On target's side
    expect(points.ty).toBeCloseTo(100, 0);
  });

  it("handles degenerate target box (w=0, h=0)", () => {
    const s: Box = { cx: 100, cy: 100, w: 100, h: 100 };
    const t: Box = { cx: 200, cy: 100, w: 0, h: 0 };

    const points = floatingPoints(s, t);

    // Source's edge to target centre (degenerate)
    expect(points.sx).toBeGreaterThan(100);
    expect(points.sy).toBeCloseTo(100, 0);
    expect(Math.abs(points.tx - 200)).toBeLessThan(2); // Near target centre
    expect(points.ty).toBeCloseTo(100, 0);
  });

  it("handles identical-centre boxes (dx=0, dy=0)", () => {
    const s: Box = { cx: 100, cy: 100, w: 100, h: 100 };
    const t: Box = { cx: 100, cy: 100, w: 100, h: 100 };

    const points = floatingPoints(s, t);

    // Both return source centre when centres are equal
    expect(points.sx).toBe(100);
    expect(points.sy).toBe(100);
    expect(points.tx).toBe(100);
    expect(points.ty).toBe(100);
  });

  it("handles very small rectangles", () => {
    const s: Box = { cx: 100, cy: 100, w: 2, h: 2 };
    const t: Box = { cx: 300, cy: 100, w: 2, h: 2 };

    const points = floatingPoints(s, t);

    expect(points.sx).toBe(101); // cx + w/2
    expect(points.sy).toBe(100);
    expect(points.tx).toBe(299); // cx - w/2
    expect(points.ty).toBe(100);
  });

  it("handles wide rectangles (w >> h)", () => {
    const s: Box = { cx: 0, cy: 0, w: 1000, h: 100 };
    const t: Box = { cx: 200, cy: 0, w: 1000, h: 100 };

    const points = floatingPoints(s, t);

    // Scale is limited by h, so border point is on the narrow edge
    expect(Math.abs(points.sy)).toBeLessThanOrEqual(50);
    expect(Math.abs(points.ty)).toBeLessThanOrEqual(50);
  });

  it("handles tall rectangles (h >> w)", () => {
    const s: Box = { cx: 0, cy: 0, w: 100, h: 1000 };
    const t: Box = { cx: 0, cy: 200, w: 100, h: 1000 };

    const points = floatingPoints(s, t);

    // Scale is limited by w, so border point is on the narrow edge
    expect(Math.abs(points.sx)).toBeLessThanOrEqual(50);
    expect(Math.abs(points.tx)).toBeLessThanOrEqual(50);
  });

  it("handles negative spacing (overlapping boxes)", () => {
    const s: Box = { cx: 100, cy: 100, w: 200, h: 200 };
    const t: Box = { cx: 150, cy: 100, w: 200, h: 200 };

    // Overlapping: ray from s toward t is rightward, scale clamps to box edge
    const points = floatingPoints(s, t);

    expect(points.sx).toBeLessThanOrEqual(200); // Not beyond source right edge
    expect(points.tx).toBeGreaterThanOrEqual(50); // Not beyond target left edge
  });

  it("preserves floating-point symmetry (s→t equals t→s mirrored)", () => {
    const s: Box = { cx: 100, cy: 50, w: 80, h: 60 };
    const t: Box = { cx: 350, cy: 150, w: 120, h: 80 };

    const s2t = floatingPoints(s, t);
    const t2s = floatingPoints(t, s);

    // Source→Target and Target→Source should mirror geometry
    expect(s2t.sx).toBe(t2s.tx);
    expect(s2t.sy).toBe(t2s.ty);
    expect(s2t.tx).toBe(t2s.sx);
    expect(s2t.ty).toBe(t2s.sy);
  });
});

describe("curveFromHandle (relationship reshape handle, #1)", () => {
  // The handle sits at crosslinkBezier's midpoint, so dropping it where the curve already puts it
  // must recover that same curve — curveFromHandle inverts the midpoint geometry.
  it("inverts crosslinkBezier's midpoint for any chord + bow", () => {
    const cases = [
      { sx: 0, sy: 0, tx: 200, ty: 0, curve: 40 },
      { sx: 0, sy: 0, tx: 200, ty: 0, curve: -60 },
      { sx: 10, sy: 20, tx: 180, ty: 140, curve: 35 },
      { sx: 100, sy: 0, tx: 100, ty: 200, curve: -25 }, // vertical chord
    ];
    for (const { sx, sy, tx, ty, curve } of cases) {
      const { labelX, labelY } = crosslinkBezier(sx, sy, tx, ty, curve);
      expect(curveFromHandle(sx, sy, tx, ty, labelX, labelY)).toBeCloseTo(curve, 5);
    }
  });

  it("ignores movement along the chord (only the perpendicular component bends it)", () => {
    // Horizontal chord: sliding the handle left/right along it changes nothing; only y matters.
    expect(curveFromHandle(0, 0, 200, 0, 100, 30)).toBeCloseTo(40, 5);
    expect(curveFromHandle(0, 0, 200, 0, 40, 30)).toBeCloseTo(40, 5); // different x, same y
    expect(curveFromHandle(0, 0, 200, 0, 100, 0)).toBeCloseTo(0, 5); // on the chord → no bow
  });
});

describe("nodeAtPoint (drag-a-file-onto-a-topic hit-test, #4)", () => {
  const nodes = [
    { id: "a", position: { x: 0, y: 0 }, measured: { width: 100, height: 40 } },
    { id: "b", position: { x: 200, y: 100 }, measured: { width: 80, height: 30 } },
    // overlaps "a"; later in the array → painted on top → wins ties
    { id: "c", position: { x: 50, y: 20 }, measured: { width: 100, height: 40 } },
  ];

  it("returns the node whose box contains the point", () => {
    expect(nodeAtPoint(nodes, 10, 10)).toBe("a");
    expect(nodeAtPoint(nodes, 210, 110)).toBe("b");
  });

  it("returns the topmost (last-painted) node when boxes overlap", () => {
    expect(nodeAtPoint(nodes, 60, 30)).toBe("c"); // inside both a and c → c wins
  });

  it("returns null when the point misses every node", () => {
    expect(nodeAtPoint(nodes, 500, 500)).toBeNull();
    expect(nodeAtPoint([], 0, 0)).toBeNull();
  });

  it("treats a missing measured size as a zero-area box (no hit)", () => {
    expect(nodeAtPoint([{ id: "x", position: { x: 0, y: 0 } }], 0, 0)).toBe("x"); // edge inclusive
    expect(nodeAtPoint([{ id: "x", position: { x: 0, y: 0 } }], 1, 1)).toBeNull();
  });
});
