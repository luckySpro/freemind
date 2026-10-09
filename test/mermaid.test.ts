import { describe, expect, it } from "vitest";
import { fromMermaid, toMermaid } from "../src/io/mermaid";
import type { MapNode, MindMapDoc } from "../src/model/types";

const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "d1",
  title: "Root",
  root: {
    id: "r",
    topic: "Root",
    children: [
      {
        id: "a",
        topic: "Branch (A)",
        children: [
          { id: "a1", topic: "Leaf 1", children: [] },
          { id: "a2", topic: "Leaf 2", children: [] },
        ],
      },
      { id: "b", topic: "Branch B", children: [] },
    ],
  },
};

const topics = (n: MapNode): unknown => [n.topic, ...n.children.map(topics)];

describe("Mermaid mindmap round-trip", () => {
  it("starts with the mindmap header and a circle root", () => {
    const out = toMermaid(doc);
    expect(out.startsWith("mindmap\n")).toBe(true);
    expect(out).toContain('root(("Root"))');
  });

  it("preserves the topic tree, including parens in a topic", () => {
    const back = fromMermaid(toMermaid(doc));
    expect(topics(back.root)).toEqual(topics(doc.root));
  });

  it("round-trips topics containing double-quotes and brackets (entity-escaped, not backslash)", () => {
    // The exporter quotes node text and encodes embedded `"` as &quot; (the form Mermaid renders as
    // a literal quote); the importer decodes it. Brackets survive because the node text is quoted.
    // This pins the deliberate choice: backslash escaping would NOT round-trip through Mermaid.
    const tricky: MindMapDoc = {
      schemaVersion: 1,
      id: "q",
      title: "T",
      root: {
        id: "r",
        topic: "Root",
        children: [{ id: "n", topic: 'Say "Hi" [done]', children: [] }],
      },
    };
    const out = toMermaid(tricky);
    expect(out).toContain("&quot;"); // entity-escaped, not a raw or backslashed quote
    expect(out).not.toContain('\\"');
    expect(topics(fromMermaid(out).root)).toEqual(topics(tricky.root)); // exact round-trip
  });

  it("parses a hand-written mindmap with mixed shapes and indentation", () => {
    const text = `mindmap
  root((Central))
    [First]
      Grandchild
    Second`;
    const out = fromMermaid(text);
    expect(out.root.topic).toBe("Central");
    expect(out.root.children.map((c) => c.topic)).toEqual(["First", "Second"]);
    expect(out.root.children[0].children[0].topic).toBe("Grandchild");
  });

  it("treats a deeper sibling indentation correctly (no false nesting)", () => {
    const text = `mindmap
  Root
    A
    B`;
    const out = fromMermaid(text);
    expect(out.root.children.map((c) => c.topic)).toEqual(["A", "B"]);
  });

  it("rejects input with no nodes", () => {
    expect(() => fromMermaid("mindmap\n")).toThrow();
  });
});
