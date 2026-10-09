import { describe, expect, it } from "vitest";
import { dashArray, matchBorderColor, r2 } from "../src/mindmap/flow/geometry";
import { countDescendants, subtreeIds, walkTree } from "../src/mindmap/flow/nodeWalk";
import { summaryLabel } from "../src/mindmap/flow/style";
import type { MapNode } from "../src/model/types";

// Coverage for small shared flow helpers — several feed the canvas==export invariant (border colour,
// rounding, dash), so pin them so a refactor can't drift canvas and export apart.

describe("matchBorderColor", () => {
  it("extracts the colour token from a CSS border shorthand", () => {
    expect(matchBorderColor("2px solid #e23")).toBe("#e23");
    expect(matchBorderColor("1px dashed #1b8a5e")).toBe("#1b8a5e");
    expect(matchBorderColor("2px solid #11223344")).toBe("#11223344"); // 8-digit hex
    expect(matchBorderColor("3px solid rgba(0,0,0,0.5)")).toBe("rgba(0,0,0,0.5)");
  });
  it("returns null when there is no colour or no border", () => {
    expect(matchBorderColor("2px solid")).toBeNull();
    expect(matchBorderColor("")).toBeNull();
    expect(matchBorderColor(undefined)).toBeNull();
  });
});

describe("r2", () => {
  it("rounds to two decimals (compact, stable SVG coords)", () => {
    expect(r2(0)).toBe(0);
    expect(r2(10)).toBe(10);
    expect(r2(1.5)).toBe(1.5);
    expect(r2(Math.PI)).toBe(3.14);
    expect(r2(Math.E)).toBe(2.72);
    expect(r2(-Math.PI)).toBe(-3.14);
  });
});

describe("dashArray", () => {
  it("maps a dash style to its SVG dash array ('' = solid)", () => {
    expect(dashArray("dashed")).toBe("6 5");
    expect(dashArray("dotted")).toBe("2 4");
    expect(dashArray("solid")).toBe("");
    expect(dashArray(undefined)).toBe("");
  });
});

const leaf = (id: string): MapNode => ({ id, topic: id, children: [] });

describe("walkTree", () => {
  it("visits depth-first, root first, carrying each node's depth", () => {
    const tree: MapNode = {
      id: "r",
      topic: "r",
      children: [{ id: "a", topic: "a", children: [leaf("a1")] }, leaf("b")],
    };
    const seen: [string, number][] = [];
    walkTree(tree, (n, d) => seen.push([n.id, d]));
    expect(seen).toEqual([
      ["r", 0],
      ["a", 1],
      ["a1", 2],
      ["b", 1],
    ]);
  });
  it("a single leaf is visited once at the start depth", () => {
    const seen: [string, number][] = [];
    walkTree(leaf("x"), (n, d) => seen.push([n.id, d]), 5);
    expect(seen).toEqual([["x", 5]]);
  });
});

describe("countDescendants", () => {
  it("counts every node beneath, excluding the node itself", () => {
    const tree: MapNode = {
      id: "r",
      topic: "r",
      children: [{ id: "a", topic: "a", children: [leaf("a1"), leaf("a2")] }, leaf("b")],
    };
    expect(countDescendants(tree)).toBe(4); // a, a1, a2, b
    expect(countDescendants(leaf("x"))).toBe(0);
  });
});

describe("subtreeIds", () => {
  it("collects the node's id plus every descendant id", () => {
    const tree: MapNode = {
      id: "r",
      topic: "r",
      children: [{ id: "a", topic: "a", children: [leaf("a1")] }],
    };
    expect([...subtreeIds(tree)].sort()).toEqual(["a", "a1", "r"]);
    expect([...subtreeIds(leaf("x"))]).toEqual(["x"]);
  });
  it("returns an empty set for null", () => {
    expect(subtreeIds(null).size).toBe(0);
  });
});

describe("summaryLabel", () => {
  it("defaults blank/whitespace/undefined to 'Summary', else returns the label verbatim", () => {
    expect(summaryLabel(undefined)).toBe("Summary");
    expect(summaryLabel("")).toBe("Summary");
    expect(summaryLabel("   ")).toBe("Summary");
    expect(summaryLabel("Risks")).toBe("Risks");
    expect(summaryLabel("  Risks  ")).toBe("  Risks  "); // only blank-checks via trim; keeps the original
  });
});
