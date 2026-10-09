import { describe, expect, it } from "vitest";
import { fromMarkdown } from "../src/io/markdown";
import { fromMarkmap } from "../src/io/markmap";
import type { MapNode } from "../src/model/types";

// Compare topic-tree shape, ignoring ids (importers mint fresh ones).
function shape(n: MapNode): { topic: string; children: unknown[] } {
  return { topic: n.topic, children: n.children.map(shape) };
}

const MARKMAP_WITH_FRONTMATTER = `---
title: My Markmap
markmap:
  colorFreezeLevel: 2
---
# Root Topic
- Branch A
  - Leaf 1
  - Leaf 2
- Branch B
`;

const MARKMAP_NO_FRONTMATTER = `# Plain Markdown Map
- Alpha
  - Alpha-1
- Beta
`;

describe("markmap io", () => {
  it("strips frontmatter and parses the Markdown body correctly", () => {
    const doc = fromMarkmap(MARKMAP_WITH_FRONTMATTER);
    // Children hierarchy must match what fromMarkdown produces for the body alone.
    // Root topic itself is overridden by the frontmatter title: field (tested below).
    const bodyOnly = fromMarkdown("# Root Topic\n- Branch A\n  - Leaf 1\n  - Leaf 2\n- Branch B\n");
    expect(doc.root.children.map(shape)).toEqual(bodyOnly.root.children.map(shape));
  });

  it("uses the frontmatter title: field as the map title", () => {
    const doc = fromMarkmap(MARKMAP_WITH_FRONTMATTER);
    expect(doc.title).toBe("My Markmap");
    expect(doc.root.topic).toBe("My Markmap");
  });

  it("works with no frontmatter (plain Markdown pass-through)", () => {
    const doc = fromMarkmap(MARKMAP_NO_FRONTMATTER);
    const direct = fromMarkdown(MARKMAP_NO_FRONTMATTER);
    expect(shape(doc.root)).toEqual(shape(direct.root));
    expect(doc.title).toBe("Plain Markdown Map");
  });

  it("sets meta.source to 'markmap'", () => {
    const doc = fromMarkmap(MARKMAP_WITH_FRONTMATTER);
    expect(doc.meta?.source).toBe("markmap");
  });

  it("sets meta.source to 'markmap' even without frontmatter", () => {
    const doc = fromMarkmap(MARKMAP_NO_FRONTMATTER);
    expect(doc.meta?.source).toBe("markmap");
  });

  it("preserves hierarchy depth from the body", () => {
    const doc = fromMarkmap(MARKMAP_WITH_FRONTMATTER);
    const branchA = doc.root.children.find((c) => c.topic === "Branch A");
    expect(branchA).toBeDefined();
    expect(branchA?.children.map((c) => c.topic)).toEqual(["Leaf 1", "Leaf 2"]);
    expect(doc.root.children.find((c) => c.topic === "Branch B")).toBeDefined();
  });

  it("handles a frontmatter block with no title: field — falls back to H1", () => {
    const text = "---\nmarkmap:\n  colorFreezeLevel: 3\n---\n# Derived Title\n- x\n";
    const doc = fromMarkmap(text);
    expect(doc.title).toBe("Derived Title");
  });

  it("handles a frontmatter title with surrounding quotes", () => {
    const text = "---\ntitle: 'Quoted Title'\n---\n# Ignored Heading\n- x\n";
    const doc = fromMarkmap(text);
    expect(doc.title).toBe("Quoted Title");
  });

  it("is a no-op rewrite: fromMarkmap body shape equals fromMarkdown body shape", () => {
    const body = "# Hello\n- one\n  - one-a\n- two\n";
    expect(shape(fromMarkmap(body).root)).toEqual(shape(fromMarkdown(body).root));
  });
});
