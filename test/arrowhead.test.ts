import { describe, expect, it } from "vitest";
import { arrowHeadPath } from "../src/mindmap/flow/arrowhead";

// arrowHeadPath builds the filled triangle drawn at a relationship's target end. It's shared by the
// live canvas edge (CrosslinkEdge) and the SVG exporter, so its output must be exact + stable. The
// path is "M tip L base+perp L base-perp Z": a tip at (tipX,tipY) and two base corners `size` back
// along the from→tip ray, offset ±(size*0.55) perpendicular. Coordinates are rounded to 2 decimals.

/** Pull the three points out of an "M x y L x y L x y Z" path for geometric assertions. */
function points(d: string): { x: number; y: number }[] {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
  return pts;
}

describe("arrowHeadPath", () => {
  it("points horizontally: tip at the target, base behind it, symmetric corners", () => {
    // from (0,0) → tip (20,0): a rightward arrow. Base is `size`(=9) left of the tip; the two
    // corners sit ±(9*0.55=4.95) above/below the base centre at x=11.
    const d = arrowHeadPath(20, 0, 0, 0, 9);
    expect(d).toBe("M 20 0 L 11 4.95 L 11 -4.95 Z");
    const [tip, c1, c2] = points(d);
    expect(tip).toEqual({ x: 20, y: 0 });
    // corners share the base x and mirror across the axis
    expect(c1.x).toBe(c2.x);
    expect(c1.y).toBeCloseTo(-c2.y, 10);
  });

  it("points vertically (90°): base above the tip, corners offset horizontally", () => {
    const d = arrowHeadPath(0, 20, 0, 0, 9); // downward arrow
    const [tip, c1, c2] = points(d);
    expect(tip).toEqual({ x: 0, y: 20 });
    // base centre is 9 above the tip (y = 11); corners offset ±4.95 in x, same y
    expect(c1.y).toBeCloseTo(11, 10);
    expect(c2.y).toBeCloseTo(11, 10);
    expect(c1.x).toBeCloseTo(-c2.x, 10);
    expect(Math.abs(c1.x)).toBeCloseTo(4.95, 10);
  });

  it("points at 45°: tip exact, base set back by `size` along the diagonal", () => {
    const d = arrowHeadPath(10, 10, 0, 0, 9);
    const [tip, c1, c2] = points(d);
    expect(tip).toEqual({ x: 10, y: 10 });
    // base centre is `size` back from the tip along the unit diagonal (1/√2, 1/√2)
    const back = 9 / Math.SQRT2;
    const baseMidX = (c1.x + c2.x) / 2;
    const baseMidY = (c1.y + c2.y) / 2;
    expect(baseMidX).toBeCloseTo(10 - back, 1);
    expect(baseMidY).toBeCloseTo(10 - back, 1);
  });

  it("180°: reversing from/around the tip flips the arrow direction", () => {
    const right = arrowHeadPath(20, 0, 0, 0, 9); // from left → tip points right
    const left = arrowHeadPath(0, 0, 20, 0, 9); // from right → tip points left
    expect(right).not.toBe(left);
    const baseRight = points(right)[1].x; // base x is left of tip(20) → ~11
    const baseLeft = points(left)[1].x; // base x is right of tip(0) → ~9
    expect(baseRight).toBeLessThan(20);
    expect(baseLeft).toBeGreaterThan(0);
  });

  it("zero-length (tip == from): falls back to len=1, still a valid degenerate path", () => {
    // dx=dy=0 → len guard makes ux=uy=0, so base centre == tip and corners == tip. No NaN/Infinity.
    const d = arrowHeadPath(5, 5, 5, 5, 9);
    expect(d).toBe("M 5 5 L 5 5 L 5 5 Z");
    expect(d).not.toMatch(/NaN|Infinity/);
  });

  it("collinear but reversed-degenerate inputs never emit NaN", () => {
    for (const [tx, ty, fx, fy] of [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [-3, -3, -3, -3],
    ]) {
      expect(arrowHeadPath(tx, ty, fx, fy)).not.toMatch(/NaN|Infinity/);
    }
  });

  it("scales with `size`: a larger size sets the base further back and widens the corners", () => {
    const small = points(arrowHeadPath(100, 0, 0, 0, 6));
    const large = points(arrowHeadPath(100, 0, 0, 0, 18));
    // base centre is `size` back from tip(100): 94 vs 82 → larger size is further back
    expect(small[1].x).toBeGreaterThan(large[1].x);
    // half-width is size*0.55: 3.3 vs 9.9 → larger size is wider
    expect(Math.abs(small[1].y)).toBeLessThan(Math.abs(large[1].y));
    expect(Math.abs(large[1].y)).toBeCloseTo(18 * 0.55, 10);
  });

  it("defaults size to 9 when omitted (matches the canvas + exporter call sites)", () => {
    expect(arrowHeadPath(20, 0, 0, 0)).toBe(arrowHeadPath(20, 0, 0, 0, 9));
  });

  it("rounds coordinates to 2 decimals (compact, stable SVG)", () => {
    // an off-axis tip forces fractional corners; assert no long decimal tails leak through
    const d = arrowHeadPath(13.333_33, 7.777_77, 1.111_11, 2.222_22, 9);
    for (const n of d.match(/-?\d+(?:\.\d+)?/g) ?? []) {
      const decimals = n.split(".")[1] ?? "";
      expect(decimals.length).toBeLessThanOrEqual(2);
    }
  });
});
