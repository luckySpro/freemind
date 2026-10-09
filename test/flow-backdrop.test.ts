import { describe, expect, it } from "vitest";
import { backdropGeometry, backdropRings } from "../src/mindmap/flow/backdrop";

// Dedicated-diagram backdrop geometry: the source of truth shared by the canvas overlay and the
// SVG exporter, so testing it here pins canvas == export for the frame.

describe("flow backdrop (pure geometry)", () => {
  it("onion draws N concentric circles (outer→inner) with band-top label anchors", () => {
    const g = backdropGeometry({ kind: "onion", rings: 3 });
    expect(g.shapes.map((s) => s.r)).toEqual([300, 200, 100]);
    expect(g.shapes.every((s) => s.type === "circle" && s.cx === 0 && s.cy === 0)).toBe(true);
    expect(g.anchors.map((a) => a.y)).toEqual([-250, -150, -50]); // mid-band of each ring
    expect(g.bbox).toEqual({ x: -300, y: -300, w: 600, h: 600 });
  });

  it("clamps onion ring count to 2..6 (default 3)", () => {
    expect(backdropRings({ kind: "onion", rings: 99 })).toBe(6);
    expect(backdropRings({ kind: "onion", rings: 1 })).toBe(2);
    expect(backdropRings({ kind: "onion" })).toBe(3);
  });

  it("venn frames have a fixed region count by kind", () => {
    expect(backdropRings({ kind: "venn2" })).toBe(3);
    expect(backdropRings({ kind: "venn3" })).toBe(7);
  });

  it("funnel draws one trapezoid path per stage + a band-centre anchor each", () => {
    const g = backdropGeometry({ kind: "funnel", rings: 4 });
    expect(g.shapes).toHaveLength(4);
    expect(g.shapes.every((s) => s.type === "path" && (s.d ?? "").startsWith("M "))).toBe(true);
    expect(g.anchors).toHaveLength(4);
    // bands stack downward
    expect(g.anchors[0].y).toBeLessThan(g.anchors[3].y);
  });

  it("venn2 = two overlapping circles + 3 region anchors (A, B, A∩B at centre)", () => {
    const g = backdropGeometry({ kind: "venn2" });
    expect(g.shapes.filter((s) => s.type === "circle")).toHaveLength(2);
    expect(g.anchors).toHaveLength(3);
    expect(g.anchors[2]).toEqual({ x: 0, y: 0 }); // intersection at centre
  });

  it("venn3 = three circles + 7 region anchors (triple overlap at centre)", () => {
    const g = backdropGeometry({ kind: "venn3" });
    expect(g.shapes.filter((s) => s.type === "circle")).toHaveLength(3);
    expect(g.anchors).toHaveLength(7);
    expect(g.anchors[6]).toEqual({ x: 0, y: 0 }); // A∩B∩C at centre
  });
});
