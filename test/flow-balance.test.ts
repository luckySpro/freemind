import { describe, expect, it } from "vitest";
import { balanceMap, findNode, setNodeSide } from "../src/mindmap/flow/ops";
import { project } from "../src/mindmap/flow/project";
import type { MapNode, MindMapDoc } from "../src/model/types";

// Two-sided ("side") map balancing: main branches are split left/right by subtree weight using
// Longest-Processing-Time (assignSides), honouring any pinned side; setNodeSide pins a branch and
// balanceMap clears every pin so the auto-balance reasserts.

const PALETTE = ["#E8593C", "#3B8BD4", "#27500A"];
const leaf = (id: string, side?: "left" | "right"): MapNode => ({
  id,
  topic: id,
  children: [],
  ...(side ? { side } : {}),
});
const branch = (id: string, kids: number, side?: "left" | "right"): MapNode => ({
  id,
  topic: id,
  children: Array.from({ length: kids }, (_, i) => leaf(`${id}${i}`)),
  ...(side ? { side } : {}),
});
const rootWith = (children: MapNode[]): MindMapDoc => ({
  schemaVersion: 1,
  id: "d",
  title: "R",
  root: { id: "r", topic: "R", children },
});
const sub = (n: MapNode): number => 1 + n.children.reduce((s, c) => s + sub(c), 0);

function sideById(doc: MindMapDoc): Map<string, "left" | "right" | undefined> {
  const proj = project(doc, PALETTE, false, "side");
  return new Map(proj.nodes.map((n) => [n.id, n.data.side]));
}
function sideWeights(doc: MindMapDoc): { left: number; right: number } {
  const sides = sideById(doc);
  let left = 0;
  let right = 0;
  for (const c of doc.root.children) {
    if (sides.get(c.id) === "left") left += sub(c);
    else right += sub(c);
  }
  return { left, right };
}

describe("two-sided map balancing", () => {
  it("balances main branches by subtree weight regardless of order (LPT, not in-order greedy)", () => {
    // Four size-1 branches THEN one size-5 branch. In-order greedy lands 7/2; LPT lands 5/4.
    const doc = rootWith([leaf("a"), leaf("b"), leaf("c"), leaf("d"), branch("e", 4)]);
    const { left, right } = sideWeights(doc);
    expect(left + right).toBe(9);
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1); // optimal split — only LPT achieves this
  });

  it("honours a pinned branch and balances the rest around it", () => {
    const doc = rootWith([branch("a", 4, "left"), leaf("b"), leaf("c")]); // a (size 5) pinned left
    const sides = sideById(doc);
    expect(sides.get("a")).toBe("left"); // pin honoured
    // b + c (size 1 each) go right to counterbalance the heavy left pin
    expect(sides.get("b")).toBe("right");
    expect(sides.get("c")).toBe("right");
  });

  it("setNodeSide pins a branch; undefined clears it", () => {
    const doc = rootWith([leaf("a"), leaf("b")]);
    expect(findNode(setNodeSide(doc, "a", "left").doc, "a")?.side).toBe("left");
    const pinned = setNodeSide(doc, "a", "right").doc;
    expect(findNode(setNodeSide(pinned, "a", undefined).doc, "a")?.side).toBeUndefined();
  });

  it("balanceMap clears every main branch's pin; no-op when nothing is pinned", () => {
    const doc = rootWith([leaf("a", "left"), leaf("b", "right")]);
    const balanced = balanceMap(doc).doc;
    expect(balanced.root.children.every((c) => c.side === undefined)).toBe(true);
    const clean = rootWith([leaf("a"), leaf("b")]);
    expect(balanceMap(clean).doc).toBe(clean); // same ref → no spurious undo step
  });
});
