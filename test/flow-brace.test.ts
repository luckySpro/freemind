import { describe, expect, it } from "vitest";
import { braceGeometry, bracePath, computeBraces } from "../src/mindmap/flow/brace";
import type { MindMapDoc } from "../src/model/types";

// Brace-map fork geometry: the single source of truth shared by the canvas overlay and the SVG
// exporter, so testing it here pins canvas == export for the "{" connectors.

const parent = { x: 0, y: 40, w: 100, h: 40 }; // centre y = 60
const children = [
  { x: 200, y: 0, w: 80, h: 40 }, // centre y = 20
  { x: 220, y: 80, w: 80, h: 40 }, // centre y = 100
];

describe("flow brace map (pure geometry)", () => {
  it("spine spans the children's centres, set in beside the leftmost child (BRACE_GAP)", () => {
    const g = braceGeometry(parent, children);
    expect(g.spineX).toBe(178); // min child left (200) - 22
    expect(g.spineTop).toBe(20);
    expect(g.spineBottom).toBe(100);
    expect(g.parentRightX).toBe(100);
    expect(g.parentTeeY).toBe(60); // parent centre, within [20,100]
    expect(g.stubs).toEqual([
      { y: 20, fromX: 178, toX: 200 },
      { y: 100, fromX: 178, toX: 220 },
    ]);
  });

  it("clamps the parent tee into the spine span", () => {
    const g = braceGeometry({ x: 0, y: 500, w: 100, h: 40 }, children); // centre 520 > spineBottom
    expect(g.parentTeeY).toBe(100);
  });

  it("bracePath emits a parent tee, a spine, and one stub per child", () => {
    const d = bracePath(braceGeometry(parent, children));
    expect((d.match(/M /g) ?? []).length).toBe(4); // tee + spine + 2 stubs
    expect(d).toContain("M 100 60 L 178 60"); // parent tee
    expect(d).toContain("M 178 20 L 178 100"); // spine
  });

  it("computeBraces yields one group per visible parent-with-children, skipping collapsed", () => {
    const doc: MindMapDoc = {
      schemaVersion: 1,
      id: "d",
      title: "R",
      root: {
        id: "r",
        topic: "R",
        children: [
          { id: "a", topic: "A", children: [{ id: "a1", topic: "A1", children: [] }] },
          {
            id: "b",
            topic: "B",
            collapsed: true,
            children: [{ id: "b1", topic: "B1", children: [] }],
          },
        ],
      },
    };
    const groups = computeBraces(doc);
    expect(groups.map((g) => g.parentId).sort()).toEqual(["a", "r"]); // b collapsed → skipped
    expect(groups.find((g) => g.parentId === "r")?.childIds).toEqual(["a", "b"]);
  });
});
