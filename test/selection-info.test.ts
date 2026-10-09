import { describe, expect, it } from "vitest";
import type { MindMapDoc } from "../src/model/types";
import { selectionCrumbs, selectionInfo } from "../src/selectionInfo";

// selectionInfo / selectionCrumbs are the pure inspector-header derivations lifted out of App: the
// breadcrumb, the quick-facts line, the created/modified line, and the canvas breadcrumb trail.

const T = 1_700_000_000_000;
const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "Root",
  root: {
    id: "r",
    topic: "Root",
    children: [
      {
        id: "a",
        topic: "Alpha",
        note: "hello world",
        createdAt: T,
        modifiedAt: T,
        children: [
          { id: "a1", topic: "One", children: [] },
          { id: "a2", topic: "Two", children: [] },
        ],
      },
      { id: "b", topic: "Beta", children: [] },
    ],
  },
};

describe("selectionInfo", () => {
  it("returns empty parts when there is no selection", () => {
    expect(selectionInfo(doc, null, null)).toEqual({ breadcrumb: "", facts: "", times: "" });
  });

  it("builds the breadcrumb, facts, and times lines for a selected node", () => {
    const info = selectionInfo(doc, doc.root.children[0], "a", T + 120_000); // 2 min later
    expect(info.breadcrumb).toBe("Root");
    expect(info.facts).toContain("#1"); // outline number
    expect(info.facts).toContain("depth 1");
    expect(info.facts).toContain("2 children"); // plural
    expect(info.facts).toContain("note 2w · 11c");
    expect(info.times).toBe("created 2 min. ago · modified 2 min. ago");
  });

  it("singularises one child and surfaces a reading time for a long note", () => {
    const d: MindMapDoc = {
      ...doc,
      root: {
        id: "r",
        topic: "R",
        children: [
          {
            id: "x",
            topic: "X",
            note: "word ".repeat(60), // ~60 words → over the ~min-read threshold
            children: [{ id: "x1", topic: "k", children: [] }],
          },
        ],
      },
    };
    const info = selectionInfo(d, d.root.children[0], "x");
    expect(info.facts).toContain("1 child"); // singular
    expect(info.facts).toMatch(/~\d+ min read/);
    expect(info.times).toBe(""); // no timestamps on this node
  });

  it("selectionCrumbs returns the root→selected trail (empty without a selection)", () => {
    expect(selectionCrumbs(doc, null, null)).toEqual([]);
    const crumbs = selectionCrumbs(doc, doc.root.children[0].children[0], "a1");
    expect(crumbs.map((c) => c.topic)).toEqual(["Root", "Alpha", "One"]);
    expect(crumbs.map((c) => c.id)).toEqual(["r", "a", "a1"]);
  });
});
