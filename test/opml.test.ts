import { describe, expect, it } from "vitest";
import { fromOpml, toOpml } from "../src/io/opml";
import type { MapNode, MindMapDoc } from "../src/model/types";

const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "Plan",
  root: {
    id: "r",
    topic: "Plan",
    children: [
      {
        id: "a",
        topic: "Strategy",
        note: "the why",
        children: [{ id: "a1", topic: "Grow EU", children: [] }],
      },
      { id: "b", topic: "Ops & metrics", children: [] },
    ],
  },
};

// Compare tree shape ignoring ids (which are regenerated on import).
function shape(node: MapNode): unknown {
  return { topic: node.topic, note: node.note, children: node.children.map(shape) };
}

describe("opml I/O", () => {
  it("exports nested <outline> elements with a title", () => {
    const opml = toOpml(doc);
    expect(opml).toContain('<opml version="2.0">');
    expect(opml).toContain("<title>Plan</title>");
    expect(opml).toContain('<outline text="Strategy" _note="the why">');
    expect(opml).toContain('<outline text="Grow EU" />');
    expect(opml).toContain('text="Ops &amp; metrics"'); // XML-escaped
  });

  it("round-trips topics, notes, and structure", () => {
    expect(shape(fromOpml(toOpml(doc)).root)).toEqual(shape(doc.root));
  });

  it("wraps multiple top-level outlines under a title root", () => {
    const opml = `<?xml version="1.0"?><opml version="2.0"><head><title>Two Tops</title></head>
      <body><outline text="One"/><outline text="Two"/></body></opml>`;
    const result = fromOpml(opml);
    expect(result.root.topic).toBe("Two Tops");
    expect(result.root.children.map((c) => c.topic)).toEqual(["One", "Two"]);
  });

  it("rejects non-OPML input", () => {
    expect(() => fromOpml("<html><body>nope</body></html>")).toThrow(/Not an OPML/);
  });

  it("handles a missing head title, the @_title attribute, and attribute-less outlines", () => {
    // No <head>; the single top-level outline names itself with `title=` rather
    // than `text=`, and its child has neither attribute.
    const opml = `<?xml version="1.0"?><opml version="2.0"><body>
      <outline title="From title attr"><outline/></outline></body></opml>`;
    const result = fromOpml(opml);
    expect(result.root.topic).toBe("From title attr"); // @_title fallback
    expect(result.root.children.map((c) => c.topic)).toEqual([""]); // neither attr → empty
  });
});
