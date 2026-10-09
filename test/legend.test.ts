import { describe, expect, it } from "vitest";
import { buildLegend } from "../src/legend";
import type { MindMapDoc } from "../src/model/types";

// buildLegend gathers the markers, tags, and conditional rules actually used in a map, each with a
// readable label — the shared source for the on-canvas legend overlay and the SVG export.
const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "R",
  root: {
    id: "r",
    topic: "Root",
    icons: ["⭐"],
    tags: ["q3"],
    children: [{ id: "a", topic: "A", icons: ["❗"], tags: ["risk"], children: [] }],
  },
  rules: [
    { id: "x", kind: "tag", value: "risk", style: { background: "#fee2e2" } },
    { id: "y", kind: "overdue", style: { border: "2px solid #b42318" } },
  ],
};

describe("buildLegend", () => {
  it("lists markers (named where known), tags, then rules with a colour", () => {
    const entries = buildLegend(doc);
    const markers = entries.filter((e) => e.kind === "marker");
    expect(new Set(markers.map((m) => m.icon))).toEqual(new Set(["⭐", "❗"]));
    expect(markers.find((m) => m.icon === "⭐")?.label).toBe("Star"); // catalogue name
    expect(markers.find((m) => m.icon === "❗")?.label).toBe("Important");
    const tags = entries.filter((e) => e.kind === "tag").map((t) => t.label);
    expect(tags).toEqual(["q3", "risk"]); // sorted by markerTagIndex
    const rules = entries.filter((e) => e.kind === "rule");
    expect(rules[0]).toMatchObject({ label: "tag risk", color: "#fee2e2" });
    expect(rules[1]).toMatchObject({ color: "#b42318" }); // colour pulled from the border shorthand
  });

  it("is empty for a map with no markers / tags / rules", () => {
    expect(
      buildLegend({
        schemaVersion: 1,
        id: "e",
        title: "E",
        root: { id: "r", topic: "R", children: [] },
      }),
    ).toEqual([]);
  });

  it("falls back to font colour, then branch colour, when neither background nor border is set", () => {
    const ruleOf = (d: MindMapDoc) => buildLegend(d).find((e) => e.kind === "rule");
    const withFontColor = ruleOf({
      ...doc,
      rules: [{ id: "z", kind: "completed", style: { color: "#123456" } }],
    });
    expect(withFontColor).toMatchObject({ color: "#123456" });

    const withBranchColor = ruleOf({
      ...doc,
      rules: [{ id: "z", kind: "completed", style: {}, branchColor: "#abcdef" }],
    });
    expect(withBranchColor).toMatchObject({ color: "#abcdef" });

    const withNone = ruleOf({
      ...doc,
      rules: [{ id: "z", kind: "completed", style: {} }],
    });
    expect(withNone?.color).toBeUndefined();
  });
});
