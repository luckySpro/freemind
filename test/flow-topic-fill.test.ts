import { describe, expect, it } from "vitest";
import { resolveLevelBox, resolveTopicFill } from "../src/mindmap/flow/style";

// resolveTopicFill turns a topic's fill mode (tint / gradient) + its branch colour into the concrete
// values the canvas node and the SVG exporter both render — so a filled topic looks identical in both.
describe("resolveTopicFill", () => {
  it("returns null when no fill mode is set (caller keeps the flat-fill path)", () => {
    expect(resolveTopicFill({ branchColor: "#3b8bd4" })).toBeNull();
  });

  it("tint → a light solid wash of the branch colour with readable (dark) text", () => {
    const f = resolveTopicFill({ mode: "tint", branchColor: "#3b8bd4" });
    expect(f).not.toBeNull();
    expect(f?.gradient).toBeNull();
    expect(f?.css).toBe(f?.solid); // a flat colour, not a gradient string
    expect(f?.css).toMatch(/^#[0-9a-f]{6}$/i);
    expect(f?.text).toBe("#1a1a1a"); // light wash → dark text
  });

  it("gradient → a vertical linear-gradient CSS string + stops for the SVG def", () => {
    const f = resolveTopicFill({ mode: "gradient", branchColor: "#3b8bd4" });
    expect(f?.css).toMatch(/^linear-gradient\(180deg,/);
    expect(f?.gradient?.top).toMatch(/^#[0-9a-f]{6}$/i);
    expect(f?.gradient?.bottom).toMatch(/^#[0-9a-f]{6}$/i);
    expect(f?.gradient?.top).not.toBe(f?.gradient?.bottom);
    expect(f?.solid).toBe("#3b8bd4"); // gradient's representative solid = the base colour
  });

  it("derives from an explicit background when present, else the branch colour", () => {
    const fromBg = resolveTopicFill({
      mode: "tint",
      background: "#e23b3b",
      branchColor: "#3b8bd4",
    });
    const fromBranch = resolveTopicFill({ mode: "tint", branchColor: "#3b8bd4" });
    expect(fromBg?.css).not.toBe(fromBranch?.css);
  });

  it("is deterministic", () => {
    expect(resolveTopicFill({ mode: "gradient", branchColor: "#27500a" })).toEqual(
      resolveTopicFill({ mode: "gradient", branchColor: "#27500a" }),
    );
  });
});

// A fill mode reverts the level-based default styling (depth-1 filled-main, depth-3+ underline-leaf)
// to a normal card, exactly like a manual background does — so the chosen fill actually shows.
describe("resolveLevelBox with a fill mode", () => {
  it("suppresses filled-main on a depth-1 topic when a fill is set", () => {
    const def = resolveLevelBox({ isRoot: false, geom: false, depth: 1, style: {} });
    expect(def.filledMain).toBe(true);
    const filled = resolveLevelBox({
      isRoot: false,
      geom: false,
      depth: 1,
      style: { fill: "tint" },
    });
    expect(filled.filledMain).toBe(false);
  });

  it("suppresses the underline-leaf on a depth-3+ topic when a fill is set", () => {
    const def = resolveLevelBox({ isRoot: false, geom: false, depth: 3, style: {} });
    expect(def.underlineLeaf).toBe(true);
    const filled = resolveLevelBox({
      isRoot: false,
      geom: false,
      depth: 3,
      style: { fill: "gradient" },
    });
    expect(filled.underlineLeaf).toBe(false);
  });
});
