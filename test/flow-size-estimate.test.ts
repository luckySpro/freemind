import { describe, expect, it } from "vitest";
import { estimateSizeOf } from "../src/mindmap/flow/layout";
import { project } from "../src/mindmap/flow/project";
import type { MindMapDoc, NodeStyle } from "../src/model/types";

// The per-topic wrap width (NodeStyle.maxWidth) caps the layout estimate and re-wraps for height, so a
// constrained topic reserves a narrower/taller slot before React Flow measures it.
const PALETTE = ["#E8593C", "#3B8BD4", "#27500A"];
const LONG = "A very long single line topic that would otherwise stretch far across the canvas";

const docWith = (style?: NodeStyle): MindMapDoc => ({
  schemaVersion: 1,
  id: "d",
  title: "R",
  root: {
    id: "r",
    topic: "Root",
    children: [{ id: "a", topic: LONG, ...(style ? { style } : {}), children: [] }],
  },
});

const sizeOfA = (style?: NodeStyle) => {
  const proj = project(docWith(style), PALETTE, false, "right");
  return estimateSizeOf(proj.nodes)("a");
};

describe("estimateSizeOf — per-topic wrap width", () => {
  it("caps the estimated width and grows the height when maxWidth is set", () => {
    const plain = sizeOfA();
    const wrapped = sizeOfA({ maxWidth: "160px" });
    expect(wrapped.width).toBeLessThan(plain.width);
    expect(wrapped.width).toBeLessThanOrEqual(160);
    expect(wrapped.height).toBeGreaterThan(plain.height); // more wrapped lines → taller
  });

  it("ignores a non-numeric / absent maxWidth (unchanged estimate)", () => {
    expect(sizeOfA({ maxWidth: "" }).width).toBe(sizeOfA().width);
  });
});
