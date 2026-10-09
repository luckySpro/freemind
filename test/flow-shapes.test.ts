import { describe, expect, it } from "vitest";
import { isGeometric, shapeInset, shapeOverlayPath, shapePath } from "../src/mindmap/flow/shapes";
import type { NodeShape } from "../src/model/types";

// Pure node-shape geometry: the single source of truth the canvas backdrop, the SVG exporter,
// and the style-picker icons all share — so testing it here pins canvas == export == picker.

// Every geometric shape that paints an SVG <path> (the picker also renders each one).
const GEOM_SHAPES: NodeShape[] = [
  "ellipse",
  "diamond",
  "parallelogram",
  "hexagon",
  "cylinder",
  "trapezoid",
  "octagon",
  "document",
  "callout",
  "star",
  "cloud",
];

// The shapes added in the "larger vocabulary" pass — asserted to be real, distinct paths.
const NEW_SHAPES: NodeShape[] = ["trapezoid", "octagon", "document", "callout", "star", "cloud"];

/** Pull every (x,y) coordinate pair out of a path's command stream (skips arc rx/ry/flags). */
function coordsOf(d: string): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  // Tokenise into commands; for each, read its trailing x/y pairs. We only need the on-path
  // endpoints + control points to bound-check, and for C/Q/L/M every number pair is a real point
  // in the box; for A we take only the final x/y (the last two numbers).
  const re = /([MLCQ])([^MLCQAZ]*)|A([^MLCQAZ]*)/gi;
  let m: RegExpExecArray | null = re.exec(d);
  while (m !== null) {
    if (m[1]) {
      const nums = (m[2].match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
      for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    } else if (m[3]) {
      const nums = (m[3].match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
      // A rx ry rot large sweep x y → endpoint is the last pair.
      if (nums.length >= 2) pts.push([nums[nums.length - 2], nums[nums.length - 1]]);
    }
    m = re.exec(d);
  }
  return pts;
}

describe("flow node shapes (pure geometry)", () => {
  it("classifies geometric (SVG-path) vs CSS rounded-rect shapes", () => {
    expect(isGeometric("diamond")).toBe(true);
    expect(isGeometric("ellipse")).toBe(true);
    expect(isGeometric("parallelogram")).toBe(true);
    expect(isGeometric("hexagon")).toBe(true);
    expect(isGeometric("cylinder")).toBe(true);
    expect(isGeometric("trapezoid")).toBe(true);
    expect(isGeometric("octagon")).toBe(true);
    expect(isGeometric("document")).toBe(true);
    expect(isGeometric("callout")).toBe(true);
    expect(isGeometric("star")).toBe(true);
    expect(isGeometric("cloud")).toBe(true);
    expect(isGeometric("round")).toBe(false);
    expect(isGeometric("rect")).toBe(false);
    expect(isGeometric("pill")).toBe(false);
    expect(isGeometric(undefined)).toBe(false);
  });

  it("diamond is a rhombus through the four box-edge midpoints", () => {
    // box (0,0)–(100,40): top (50,0), right (100,20), bottom (50,40), left (0,20)
    expect(shapePath("diamond", 0, 0, 100, 40)).toBe("M 50 0 L 100 20 L 50 40 L 0 20 Z");
  });

  it("hexagon has six vertices and closes", () => {
    const d = shapePath("hexagon", 0, 0, 100, 40);
    expect(d.match(/L/g)?.length).toBe(5); // 1 M + 5 L = 6 vertices
    expect(d.endsWith("Z")).toBe(true);
  });

  it("parallelogram skews the top edge right and the bottom edge left", () => {
    const d = shapePath("parallelogram", 0, 0, 100, 40);
    // slant = min(100*0.22, 40*0.8) = 22 → top starts at x=22, bottom-right pulls in by 22
    expect(d).toBe("M 22 0 L 100 0 L 78 40 L 0 40 Z");
  });

  it("ellipse is two semicircular arc segments", () => {
    const d = shapePath("ellipse", 0, 0, 80, 40);
    expect(d.match(/A/g)?.length).toBe(2);
    expect(d).toContain("A 40 20"); // rx=40 ry=20
  });

  it("only the cylinder carries a front-lip overlay path", () => {
    expect(shapeOverlayPath("cylinder", 0, 0, 100, 60)).toMatch(/^M .* A /);
    expect(shapeOverlayPath("diamond", 0, 0, 100, 60)).toBeNull();
    expect(shapeOverlayPath("ellipse", 0, 0, 100, 60)).toBeNull();
  });

  it("paths use absolute coords (translate by x/y) so the exporter can place them", () => {
    expect(shapePath("diamond", 10, 20, 100, 40)).toBe("M 60 20 L 110 40 L 60 60 L 10 40 Z");
  });

  it("narrowing shapes carry text insets; CSS shapes carry none", () => {
    expect(shapeInset("diamond").left).toBeGreaterThan(0);
    expect(shapeInset("hexagon").left).toBeGreaterThan(0);
    expect(shapeInset("round")).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
    expect(shapeInset(undefined)).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
  });

  // ----- Larger shape vocabulary (cloud / star / document / callout / trapezoid / octagon) -----

  it("every new shape returns a non-empty, well-formed path distinct from a box", () => {
    const box = shapePath("rect", 0, 0, 120, 60);
    for (const shape of NEW_SHAPES) {
      const d = shapePath(shape, 0, 0, 120, 60);
      expect(d.length, shape).toBeGreaterThan(0);
      expect(d.startsWith("M"), shape).toBe(true);
      expect(d.trimEnd().endsWith("Z"), shape).toBe(true);
      expect(d, shape).not.toBe(box); // a real shape, not the default rectangle
      expect(d, shape).not.toMatch(/NaN|undefined/);
    }
  });

  it("every geometric path stays mathematically inside its box", () => {
    const x = 10;
    const y = 20;
    const w = 140;
    const h = 70;
    const eps = 0.05; // r2 rounds to 2 decimals
    for (const shape of GEOM_SHAPES) {
      const d = shapePath(shape, x, y, w, h);
      const pts = coordsOf(d);
      expect(pts.length, shape).toBeGreaterThan(2);
      for (const [px, py] of pts) {
        expect(px, `${shape} x`).toBeGreaterThanOrEqual(x - eps);
        expect(px, `${shape} x`).toBeLessThanOrEqual(x + w + eps);
        expect(py, `${shape} y`).toBeGreaterThanOrEqual(y - eps);
        expect(py, `${shape} y`).toBeLessThanOrEqual(y + h + eps);
      }
    }
  });

  it("paths translate by x/y so the exporter can place them anywhere", () => {
    // Same shape at two origins differs only by the offset → coords shift, never clip.
    for (const shape of NEW_SHAPES) {
      const a = shapePath(shape, 0, 0, 100, 50);
      const b = shapePath(shape, 200, 100, 100, 50);
      expect(a, shape).not.toBe(b);
    }
  });

  it("trapezoid is a wider-base quad; octagon has eight edges", () => {
    // base wider than top: top corners pull in by s = min(100*0.2, 40*0.8) = 20.
    expect(shapePath("trapezoid", 0, 0, 100, 40)).toBe("M 20 0 L 80 0 L 100 40 L 0 40 Z");
    const oct = shapePath("octagon", 0, 0, 100, 40);
    expect(oct.match(/L/g)?.length).toBe(7); // 1 M + 7 L = 8 vertices
    expect(oct.endsWith("Z")).toBe(true);
  });

  it("document has a curved (wavy) bottom edge; callout has a straight-line tail", () => {
    expect(shapePath("document", 0, 0, 100, 60)).toContain("C"); // cubic wave
    const callout = shapePath("callout", 0, 0, 120, 60);
    expect(callout).toMatch(/Q/); // rounded body corners
    expect(callout).toMatch(/L/); // the speech tail is straight segments
  });

  it("star has ten vertices (5 outer + 5 inner) with its top point on the top edge", () => {
    const d = shapePath("star", 0, 0, 100, 100);
    expect(d.match(/L/g)?.length).toBe(9); // 1 M + 9 L = 10 points
    expect(d.endsWith("Z")).toBe(true);
    // First point is the top tip: centred horizontally, on the top edge.
    expect(d.startsWith("M 50 0")).toBe(true);
  });

  it("cloud is built from outward-bulging cubic arcs and closes", () => {
    const d = shapePath("cloud", 0, 0, 120, 80);
    expect(d.match(/C/g)?.length).toBeGreaterThanOrEqual(4); // several lobes
    expect(d.endsWith("Z")).toBe(true);
  });

  it("the new concave shapes carry generous text insets so labels stay inside", () => {
    expect(shapeInset("star").left).toBeGreaterThan(0);
    expect(shapeInset("star").top).toBeGreaterThan(0);
    expect(shapeInset("cloud").left).toBeGreaterThan(0);
    expect(shapeInset("document").bottom).toBeGreaterThan(0); // clear of the wave
    expect(shapeInset("callout").bottom).toBeGreaterThan(0); // clear of the tail
    expect(shapeInset("octagon").left).toBeGreaterThan(0);
    expect(shapeInset("trapezoid").left).toBeGreaterThan(0);
  });

  it("no new shape carries the cylinder-only overlay path", () => {
    for (const shape of NEW_SHAPES) {
      expect(shapeOverlayPath(shape, 0, 0, 100, 60), shape).toBeNull();
    }
  });
});
