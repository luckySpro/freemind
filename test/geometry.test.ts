import { describe, expect, it } from "vitest";
import { type Box, floatingPoints } from "../src/mindmap/flow/floating";

// floatingPoints finds where an edge meets two node rects (border-to-border, along the centre-to-centre
// ray) so cross-link edges route in any layout. Pure, so it's asserted directly (no React, no canvas).
// The branch-connector geometry (attachSide / branchEndpoints / taperedRibbonPath) lives in
// branch-geometry.test.ts.

describe("floatingPoints", () => {
  const box = (cx: number, cy: number, w: number, h: number): Box => ({ cx, cy, w, h });

  it("connects two horizontally-separated boxes on their facing edges", () => {
    const s = box(0, 0, 40, 20);
    const t = box(100, 0, 40, 20);
    const { sx, sy, tx, ty } = floatingPoints(s, t);
    expect(sx).toBeCloseTo(20, 5); // source right edge (cx + w/2)
    expect(tx).toBeCloseTo(80, 5); // target left edge (cx - w/2)
    expect(sy).toBeCloseTo(0, 5);
    expect(ty).toBeCloseTo(0, 5);
  });

  it("connects vertically-stacked boxes on their top/bottom edges", () => {
    const s = box(0, 0, 40, 20);
    const t = box(0, 100, 40, 20);
    const { sx, sy, tx, ty } = floatingPoints(s, t);
    expect(sy).toBeCloseTo(10, 5); // source bottom edge (cy + h/2)
    expect(ty).toBeCloseTo(90, 5); // target top edge (cy - h/2)
    expect(sx).toBeCloseTo(0, 5);
    expect(tx).toBeCloseTo(0, 5);
  });

  it("exits through the correct edge on a diagonal (clamped by the nearer axis)", () => {
    const s = box(0, 0, 40, 20);
    const t = box(200, 50, 40, 20);
    const { sx, sy } = floatingPoints(s, t);
    expect(Math.abs(sx - 0)).toBeCloseTo(20, 1);
    expect(Math.abs(sy)).toBeLessThanOrEqual(10 + 1e-6);
  });

  it("coincident centres fall back to the shared centre (no divide-by-zero)", () => {
    const s = box(7, 7, 40, 20);
    const t = box(7, 7, 30, 10);
    const { sx, sy, tx, ty } = floatingPoints(s, t);
    expect(sx).toBe(7);
    expect(sy).toBe(7);
    expect(tx).toBe(7);
    expect(ty).toBe(7);
  });

  it("tolerates zero-size boxes (w/h floored to avoid NaN)", () => {
    const s = box(0, 0, 0, 0);
    const t = box(50, 0, 0, 0);
    const p = floatingPoints(s, t);
    for (const v of Object.values(p)) expect(Number.isFinite(v)).toBe(true);
  });
});
