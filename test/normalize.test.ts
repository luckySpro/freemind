import { describe, expect, it } from "vitest";
import { project } from "../src/mindmap/flow/project";
import { normalizeDoc } from "../src/model/normalize";
import type { MindMapDoc } from "../src/model/types";

// normalizeDoc guards the load/parse boundary: a corrupt or schema-drifted map (from IndexedDB or a
// hand-edited file) is coerced to a projectable shape so it renders salvaged instead of white-screening
// the app. A well-formed doc passes through unchanged.

describe("normalizeDoc", () => {
  it("coerces a missing children into an empty array", () => {
    const corrupt = {
      schemaVersion: 1,
      id: "d",
      title: "T",
      root: { id: "r", topic: "R" }, // no children
    } as unknown as MindMapDoc;
    const d = normalizeDoc(corrupt);
    expect(Array.isArray(d.root.children)).toBe(true);
    expect(d.root.children).toEqual([]);
  });

  it("drops non-object children and normalises nested nodes (non-array children → [])", () => {
    const corrupt = {
      schemaVersion: 1,
      id: "d",
      title: "T",
      root: {
        id: "r",
        topic: "R",
        children: [null, "x", { id: "a", topic: "A", children: "nope" }],
      },
    } as unknown as MindMapDoc;
    const d = normalizeDoc(corrupt);
    expect(d.root.children.map((c) => c.id)).toEqual(["a"]); // null + "x" dropped
    expect(d.root.children[0].children).toEqual([]); // "nope" → []
  });

  it("supplies an id when missing and coerces a non-string topic to empty", () => {
    const corrupt = {
      schemaVersion: 1,
      id: "d",
      title: "T",
      root: { children: [{ topic: 5, children: [] }] },
    } as unknown as MindMapDoc;
    const d = normalizeDoc(corrupt);
    expect(typeof d.root.id).toBe("string");
    expect(d.root.id.length).toBeGreaterThan(0);
    expect(d.root.children[0].topic).toBe(""); // non-string → ""
  });

  it("coerces a non-array floatingTopics to undefined and normalises valid ones", () => {
    const bad = {
      schemaVersion: 1,
      id: "d",
      title: "T",
      root: { id: "r", topic: "R", children: [] },
      floatingTopics: "oops",
    } as unknown as MindMapDoc;
    expect(normalizeDoc(bad).floatingTopics).toBeUndefined();
    const ok = {
      schemaVersion: 1,
      id: "d",
      title: "T",
      root: { id: "r", topic: "R", children: [] },
      floatingTopics: [{ id: "f", topic: "F" }], // missing children
    } as unknown as MindMapDoc;
    expect(normalizeDoc(ok).floatingTopics?.[0].children).toEqual([]);
  });

  it("passes a well-formed doc through value-identical (links/boundaries/fields preserved)", () => {
    const good: MindMapDoc = {
      schemaVersion: 1,
      id: "d",
      title: "T",
      root: {
        id: "r",
        topic: "R",
        children: [{ id: "a", topic: "A", note: "n", children: [] }],
      },
      links: [{ id: "l", from: "a", to: "r", label: "x" }],
      boundaries: [{ id: "bd", nodeIds: ["a"], label: "g" }],
    };
    expect(normalizeDoc(good)).toEqual(good);
  });

  it("strips a script-bearing hyperlink and a non-data: attachment from an untrusted doc (F3)", () => {
    const hostile = {
      schemaVersion: 1,
      id: "d",
      title: "T",
      root: {
        id: "r",
        topic: "R",
        children: [
          {
            id: "a",
            topic: "A",
            hyperlink: "javascript:alert(1)",
            attachments: [
              { name: "evil", dataUrl: "javascript:alert(1)", size: 1 },
              { name: "ok", dataUrl: "data:text/plain;base64,AA==", size: 2 },
            ],
            children: [],
          },
        ],
      },
    } as unknown as MindMapDoc;
    const a = normalizeDoc(hostile).root.children[0];
    expect(a.hyperlink).toBeUndefined(); // javascript: dropped
    expect(a.attachments?.map((x) => x.name)).toEqual(["ok"]); // only the data: attachment kept
  });

  it("filters unsafe / blank extras from a node's hyperlinks, dropping the array when empty", () => {
    const doc = {
      schemaVersion: 1,
      id: "d",
      title: "T",
      root: {
        id: "r",
        topic: "R",
        children: [
          {
            id: "a",
            topic: "A",
            hyperlinks: ["https://ok.test", " ", "javascript:alert(1)"],
            children: [],
          },
          { id: "b", topic: "B", hyperlinks: ["vbscript:x", ""], children: [] },
        ],
      },
    } as unknown as MindMapDoc;
    const [a, b] = normalizeDoc(doc).root.children;
    expect(a.hyperlinks).toEqual(["https://ok.test"]); // blank + javascript: dropped
    expect(b.hyperlinks).toBeUndefined(); // nothing safe left → array removed
  });

  it("leaves a clean hyperlinks array value-identical (lossless)", () => {
    const good = {
      schemaVersion: 1,
      id: "d",
      title: "T",
      root: {
        id: "r",
        topic: "R",
        children: [
          { id: "a", topic: "A", hyperlinks: ["https://a.test", "#node=b"], children: [] },
        ],
      },
    } as unknown as MindMapDoc;
    expect(normalizeDoc(good)).toEqual(good);
  });

  it("drops the attachments array entirely when nothing safe remains (stays lossless)", () => {
    const allUnsafe = {
      schemaVersion: 1,
      id: "d",
      title: "T",
      root: {
        id: "r",
        topic: "R",
        children: [
          {
            id: "a",
            topic: "A",
            attachments: [{ name: "evil", dataUrl: "javascript:alert(1)", size: 1 }],
            children: [],
          },
        ],
      },
    } as unknown as MindMapDoc;
    expect(normalizeDoc(allUnsafe).root.children[0].attachments).toBeUndefined();
  });

  it("keeps a safe hyperlink + data: attachment untouched", () => {
    const ok = {
      schemaVersion: 1,
      id: "d",
      title: "T",
      root: {
        id: "r",
        topic: "R",
        children: [
          {
            id: "a",
            topic: "A",
            hyperlink: "https://example.com",
            attachments: [{ name: "f", dataUrl: "data:text/plain;base64,AA==", size: 2 }],
            children: [],
          },
        ],
      },
    } as unknown as MindMapDoc;
    const a = normalizeDoc(ok).root.children[0];
    expect(a.hyperlink).toBe("https://example.com");
    expect(a.attachments).toHaveLength(1);
  });

  it("makes a corrupt doc projectable instead of throwing", () => {
    const corrupt = {
      schemaVersion: 1,
      id: "d",
      title: "T",
      root: { id: "r", topic: "R" }, // missing children → the hazard project() chokes on
    } as unknown as MindMapDoc;
    expect(() => project(corrupt, undefined, false, "side")).toThrow(); // the bug is real
    expect(() => project(normalizeDoc(corrupt), undefined, false, "side")).not.toThrow(); // fixed
  });
});
