import { describe, expect, it } from "vitest";
import {
  HOP_RADIUS,
  type HopSegment,
  crossingCount,
  hopPath,
  hopsFor,
} from "../src/mindmap/flow/lineJumps";

// Line-jumps geometry — the single source of truth shared by the canvas relationship edge and the
// SVG exporter. Testing the pure helper pins canvas == export for the hops; we test the geometry
// (crossings → hops, placement, dedup, ordering), not the React rendering.

const seg = (
  id: string,
  order: number,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  fromId?: string,
  toId?: string,
): HopSegment => ({ id, order, sx, sy, tx, ty, fromId, toId });

describe("line-jumps (pure geometry)", () => {
  it("two crossing segments produce exactly one hop, near the true intersection", () => {
    // A: horizontal y=50 across x=0..100; B: vertical x=50 across y=0..100. They cross at (50,50).
    const a = seg("a", 0, 0, 50, 100, 50);
    const b = seg("b", 1, 50, 0, 50, 100);
    const all = [a, b];
    expect(crossingCount(all)).toBe(1);
    // Only the higher-order edge (b) hops; the lower (a) stays straight.
    const hopsA = hopsFor(a, all);
    const hopsB = hopsFor(b, all);
    expect(hopsA).toHaveLength(0);
    expect(hopsB).toHaveLength(1);
    expect(hopsB[0].x).toBeCloseTo(50, 6);
    expect(hopsB[0].y).toBeCloseTo(50, 6);
    // The hopper's path carries an arc; the non-hopper's is a plain straight line.
    expect(hopPath(b, all)).toContain("A ");
    expect(hopPath(a, all)).not.toContain("A ");
    expect(hopPath(a, all)).toBe(`M ${0} ${50} L ${100} ${50}`);
  });

  it("two non-crossing segments produce no hops", () => {
    const a = seg("a", 0, 0, 0, 100, 0); // y=0
    const b = seg("b", 1, 0, 40, 100, 40); // y=40, parallel — never meets
    const all = [a, b];
    expect(crossingCount(all)).toBe(0);
    expect(hopsFor(a, all)).toHaveLength(0);
    expect(hopsFor(b, all)).toHaveLength(0);
    expect(hopPath(b, all)).not.toContain("A ");
  });

  it("segments sharing an endpoint node produce no hop (they legitimately meet)", () => {
    // Both start at node "h" (0,0); even though the lines would otherwise overlap at the origin.
    const a = seg("a", 0, 0, 0, 100, 50, "h", "x");
    const b = seg("b", 1, 0, 0, 50, 100, "h", "y");
    const all = [a, b];
    expect(crossingCount(all)).toBe(0);
    expect(hopsFor(b, all)).toHaveLength(0);
  });

  it("a line crossed twice produces two hops, ordered source→target", () => {
    // The hopper H is horizontal at y=0, x=0..100. Two earlier verticals cross it at x=30 and x=70.
    const h = seg("h", 5, 0, 0, 100, 0);
    const v1 = seg("v1", 1, 30, -50, 30, 50);
    const v2 = seg("v2", 2, 70, -50, 70, 50);
    const all = [h, v1, v2];
    expect(crossingCount(all)).toBe(2);
    const hops = hopsFor(h, all);
    expect(hops).toHaveLength(2);
    expect(hops[0].x).toBeCloseTo(30, 6); // nearer the source comes first
    expect(hops[1].x).toBeCloseTo(70, 6);
    // Two arcs in the emitted path.
    expect((hopPath(h, all).match(/A /g) ?? []).length).toBe(2);
    // The two verticals don't cross each other, so they stay straight.
    expect(hopsFor(v1, all)).toHaveLength(0);
    expect(hopsFor(v2, all)).toHaveLength(0);
  });

  it("only the deterministic hopper bumps when three lines mutually cross", () => {
    // Three lines through a shared region but crossing pairwise at distinct points.
    const a = seg("a", 0, 0, 0, 100, 100);
    const b = seg("b", 1, 0, 100, 100, 0);
    const c = seg("c", 2, -10, 50, 110, 50);
    const all = [a, b, c];
    // a×b, a×c, b×c → 3 crossings.
    expect(crossingCount(all)).toBe(3);
    // Total hops across all lines == crossings (one bump per crossing, never two).
    const total = hopsFor(a, all).length + hopsFor(b, all).length + hopsFor(c, all).length;
    expect(total).toBe(3);
    // a is the lowest order, so it never hops; c is highest, hops over both a and b.
    expect(hopsFor(a, all)).toHaveLength(0);
    expect(hopsFor(c, all)).toHaveLength(2);
  });

  it("ties in order break by id deterministically (still exactly one hopper)", () => {
    const a = seg("aaa", 0, 0, 50, 100, 50);
    const b = seg("bbb", 0, 50, 0, 50, 100); // same order; larger id wins → b hops
    const all = [a, b];
    expect(hopsFor(a, all)).toHaveLength(0);
    expect(hopsFor(b, all)).toHaveLength(1);
  });

  it("hop arc spans ~2·HOP_RADIUS along the line, centred on the crossing", () => {
    const a = seg("a", 0, 0, 50, 100, 50);
    const b = seg("b", 1, 50, 0, 50, 100);
    const all = [a, b];
    // b runs vertically through (50,50); the arc should enter ~HOP_RADIUS before and exit after.
    const d = hopPath(b, all);
    // Path: M 50 0 L 50 <enter> A r r 0 0 1 50 <exit> L 50 100
    const m = d.match(/L 50 ([\d.]+) A ([\d.]+) [\d.]+ 0 0 1 50 ([\d.]+)/);
    expect(m).not.toBeNull();
    if (m) {
      const enter = Number.parseFloat(m[1]);
      const radius = Number.parseFloat(m[2]);
      const exit = Number.parseFloat(m[3]);
      expect(enter).toBeCloseTo(50 - HOP_RADIUS, 4);
      expect(exit).toBeCloseTo(50 + HOP_RADIUS, 4);
      expect(radius).toBeCloseTo(HOP_RADIUS, 4);
    }
  });

  it("crossings very close together still yield ordered, non-overlapping arcs", () => {
    const h = seg("h", 9, 0, 0, 100, 0);
    // Two crossings only 4 units apart (< 2·HOP_RADIUS = 12) — arcs must not run backwards.
    const v1 = seg("v1", 1, 48, -10, 48, 10);
    const v2 = seg("v2", 2, 52, -10, 52, 10);
    const all = [h, v1, v2];
    const hops = hopsFor(h, all);
    expect(hops).toHaveLength(2);
    const d = hopPath(h, all);
    // Still a valid path with at least one arc and monotonic x (never decreases).
    const xs = [...d.matchAll(/[ML] ([\d.]+) /g)].map((mm) => Number.parseFloat(mm[1]));
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1]);
  });
});
