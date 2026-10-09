import { describe, expect, it } from "vitest";
import { resolveDropTarget } from "../src/mindmap/flow/dropTarget";
import type { RfNodeRect } from "../src/mindmap/flow/floating";

// resolveDropTarget is the pure hit-test + band decision behind the canvas drag-reorder (#8).

const nodes: RfNodeRect[] = [
  { id: "root", position: { x: 0, y: 0 }, measured: { width: 100, height: 40 } },
  { id: "a", position: { x: 200, y: 0 }, measured: { width: 100, height: 40 } },
  { id: "drag", position: { x: 500, y: 500 }, measured: { width: 20, height: 20 } },
];
const noExclude = new Set<string>(["drag"]);

describe("resolveDropTarget", () => {
  it("nests as a child when dropped on a node's middle band", () => {
    // drag top-left so its centre (x+10,y+10) lands mid-box of "a" (200..300, 0..40).
    const t = resolveDropTarget(nodes, "drag", noExclude, { x: 240, y: 10 }, "root");
    expect(t).toEqual({ id: "a", where: "child" });
  });

  it("reorders before / after when dropped on a node's top / bottom edge", () => {
    const before = resolveDropTarget(nodes, "drag", noExclude, { x: 240, y: -8 }, "root");
    expect(before).toEqual({ id: "a", where: "before" }); // centre near a's top
    const after = resolveDropTarget(nodes, "drag", noExclude, { x: 240, y: 28 }, "root");
    expect(after).toEqual({ id: "a", where: "after" }); // centre near a's bottom
  });

  it("collapses before/after to child on the root", () => {
    const t = resolveDropTarget(nodes, "drag", noExclude, { x: 40, y: -8 }, "root");
    expect(t).toEqual({ id: "root", where: "child" });
  });

  it("returns null when the drop misses every node, and never targets excluded ids", () => {
    expect(resolveDropTarget(nodes, "drag", noExclude, { x: 900, y: 900 }, "root")).toBeNull();
    // Excluding "a" (e.g. the dragged subtree) makes a drop over it miss.
    const ex = new Set<string>(["drag", "a"]);
    expect(resolveDropTarget(nodes, "drag", ex, { x: 240, y: 10 }, "root")).toBeNull();
  });
});
