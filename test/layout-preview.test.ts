import { describe, expect, it } from "vitest";
import { layoutPreviewModel } from "../src/layoutPreview";
import type { LayoutKind } from "../src/mindmap";

// layoutPreviewModel — the pure schematic-diagram model behind the MapPanel Layout gallery's SVG
// thumbnails (10c). Every pickable LayoutKind must render something recognisable; nothing should ever
// throw, and every coordinate must stay within the requested viewBox (a thumbnail that draws outside
// its own box would look broken in the menu).

const PICKABLE: LayoutKind[] = [
  "side",
  "right",
  "left",
  "org-down",
  "org-up",
  "radial",
  "timeline",
  "fishbone",
  "grid",
  "swimlane",
  "brace",
];

function withinBox(x: number, y: number, w: number, h: number, pad = 0.01) {
  expect(x).toBeGreaterThanOrEqual(-pad);
  expect(x).toBeLessThanOrEqual(w + pad);
  expect(y).toBeGreaterThanOrEqual(-pad);
  expect(y).toBeLessThanOrEqual(h + pad);
}

describe("layoutPreviewModel", () => {
  it("keeps every node, root, and line endpoint inside the w×h viewBox for every pickable kind", () => {
    for (const kind of PICKABLE) {
      const m = layoutPreviewModel(kind, 36, 24);
      if (m.root) withinBox(m.root.cx, m.root.cy, m.w, m.h);
      for (const n of m.nodes) withinBox(n.cx, n.cy, m.w, m.h);
      for (const l of m.lines) {
        withinBox(l.x1, l.y1, m.w, m.h);
        withinBox(l.x2, l.y2, m.w, m.h);
      }
    }
  });

  it("gives each direction (side/right/left) a root + 3-or-6 fanning children, matching its name", () => {
    const side = layoutPreviewModel("side");
    expect(side.root).toBeTruthy();
    expect(side.nodes).toHaveLength(6); // 3 left + 3 right
    expect(side.lines).toHaveLength(6); // one line per child

    const right = layoutPreviewModel("right");
    expect(right.nodes).toHaveLength(3);
    // every child sits to the right of the root (right-growing)
    for (const n of right.nodes) expect(n.cx).toBeGreaterThan(right.root?.cx ?? 0);

    const left = layoutPreviewModel("left");
    expect(left.nodes).toHaveLength(3);
    for (const n of left.nodes) expect(n.cx).toBeLessThan(left.root?.cx ?? 0);
  });

  it("radial fans children in a full ring (not biased left/right like side/right/left)", () => {
    const m = layoutPreviewModel("radial", 36, 24);
    expect(m.nodes.length).toBeGreaterThanOrEqual(4);
    const root = m.root;
    expect(root).toBeTruthy();
    // A genuine ring has children on both sides of the root's x AND y — not all crammed to one side.
    expect(m.nodes.some((n) => n.cx < (root?.cx ?? 0))).toBe(true);
    expect(m.nodes.some((n) => n.cx > (root?.cx ?? 0))).toBe(true);
    expect(m.nodes.some((n) => n.cy < (root?.cy ?? 0))).toBe(true);
    expect(m.nodes.some((n) => n.cy > (root?.cy ?? 0))).toBe(true);
  });

  it("org-down's root sits above its children; org-up's sits below (mirrored)", () => {
    const down = layoutPreviewModel("org-down");
    for (const n of down.nodes) expect(n.cy).toBeGreaterThan(down.root?.cy ?? 0);
    const up = layoutPreviewModel("org-up");
    for (const n of up.nodes) expect(n.cy).toBeLessThan(up.root?.cy ?? 0);
  });

  it("timeline chains nodes left-to-right rather than radiating from one root", () => {
    const m = layoutPreviewModel("timeline");
    const all = [m.root, ...m.nodes].filter((n): n is { cx: number; cy: number } => !!n);
    const xs = all.map((n) => n.cx);
    expect(xs).toEqual([...xs].sort((a, b) => a - b)); // strictly left-to-right order
    expect(m.lines).toHaveLength(all.length - 1); // a chain has one fewer line than points
  });

  it("grid and swimlane have no root (no single-topic reading) and swimlane draws lane paths", () => {
    const grid = layoutPreviewModel("grid");
    expect(grid.root).toBeUndefined();
    expect(grid.nodes.length).toBeGreaterThan(0);

    const swimlane = layoutPreviewModel("swimlane");
    expect(swimlane.root).toBeUndefined();
    expect(swimlane.paths?.length).toBeGreaterThan(0);
  });

  it("brace draws a bracket path alongside its listed nodes", () => {
    const m = layoutPreviewModel("brace");
    expect(m.paths?.length).toBeGreaterThan(0);
    expect(m.nodes.length).toBeGreaterThan(0);
  });

  it("falls back to a bare outline for a non-pickable kind (freeform) instead of throwing", () => {
    const m = layoutPreviewModel("freeform" as LayoutKind, 36, 24);
    expect(m.nodes).toEqual([]);
    expect(m.lines).toEqual([]);
    expect(m.paths?.length).toBe(1);
  });

  it("scales to a custom w×h", () => {
    const m = layoutPreviewModel("side", 60, 40);
    expect(m.w).toBe(60);
    expect(m.h).toBe(40);
    if (m.root) withinBox(m.root.cx, m.root.cy, 60, 40);
  });
});
