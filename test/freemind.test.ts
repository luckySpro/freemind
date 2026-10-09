import { describe, expect, it } from "vitest";
import { fromFreemind, toFreemind } from "../src/io/freemind";
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
        topic: "Alpha & <co>",
        hyperlink: "https://example.com",
        children: [{ id: "a1", topic: "Has note", note: "line one\nline two", children: [] }],
      },
      { id: "b", topic: 'Beta "quoted"', collapsed: true, children: [] },
    ],
  },
};

const topics = (n: MapNode): unknown => [n.topic, ...n.children.map(topics)];

describe("FreeMind .mm round-trip", () => {
  it("preserves the topic tree (including XML-special characters)", () => {
    const back = fromFreemind(toFreemind(doc));
    expect(topics(back.root)).toEqual(topics(doc.root));
  });

  it("preserves hyperlink, collapsed, and notes", () => {
    const back = fromFreemind(toFreemind(doc));
    const alpha = back.root.children[0];
    const beta = back.root.children[1];
    expect(alpha.hyperlink).toBe("https://example.com");
    expect(alpha.children[0].note).toBe("line one\nline two");
    expect(beta.collapsed).toBe(true);
  });

  it("drops a dangerous-scheme link on export and import", () => {
    const evil: MindMapDoc = {
      ...doc,
      root: {
        id: "r",
        topic: "R",
        children: [{ id: "x", topic: "x", hyperlink: "javascript:alert(1)", children: [] }],
      },
    };
    expect(toFreemind(evil)).not.toContain("javascript:");
    const raw = `<map version="1.0.1"><node TEXT="R"><node TEXT="x" LINK="javascript:alert(1)"/></node></map>`;
    expect(fromFreemind(raw).root.children[0].hyperlink).toBeUndefined();
  });

  it("parses a hand-written FreeMind file with a NOTE", () => {
    const raw = `<map version="1.0.1">
  <node TEXT="Plan">
    <node TEXT="Phase 1" FOLDED="true">
      <richcontent TYPE="NOTE"><html><head></head><body><p>Do the thing</p></body></html></richcontent>
    </node>
  </node>
</map>`;
    const out = fromFreemind(raw);
    expect(out.root.topic).toBe("Plan");
    expect(out.root.children[0].topic).toBe("Phase 1");
    expect(out.root.children[0].collapsed).toBe(true);
    expect(out.root.children[0].note).toBe("Do the thing");
  });

  it("rejects non-FreeMind input", () => {
    expect(() => fromFreemind("<html></html>")).toThrow();
  });
});
