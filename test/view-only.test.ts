import { describe, expect, it } from "vitest";
import { isViewIntent, onlyFoldsChanged } from "../src/mindmap/flow/viewOnly";
import type { MindMapDoc } from "../src/model/types";

const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "T",
  root: {
    id: "r",
    topic: "Root",
    children: [{ id: "a", topic: "A", children: [{ id: "a1", topic: "A1", children: [] }] }],
  },
};

describe("onlyFoldsChanged", () => {
  it("allows collapsing and expanding a branch", () => {
    const folded: MindMapDoc = {
      ...doc,
      root: { ...doc.root, children: [{ ...doc.root.children[0], collapsed: true }] },
    };
    expect(onlyFoldsChanged(doc, folded)).toBe(true);
    expect(onlyFoldsChanged(folded, doc)).toBe(true);
  });

  it("treats any other change as an edit", () => {
    const renamed: MindMapDoc = {
      ...doc,
      root: { ...doc.root, children: [{ ...doc.root.children[0], topic: "A!" }] },
    };
    expect(onlyFoldsChanged(doc, renamed)).toBe(false);
    expect(onlyFoldsChanged(doc, { ...doc, title: "Other" })).toBe(false);
    const added: MindMapDoc = {
      ...doc,
      root: {
        ...doc.root,
        children: [...doc.root.children, { id: "b", topic: "B", children: [] }],
      },
    };
    expect(onlyFoldsChanged(doc, added)).toBe(false);
  });
});

describe("isViewIntent", () => {
  it("keeps navigation, zoom, copy and reading a note", () => {
    for (const k of [
      "selectDir",
      "zoomIn",
      "zoomOut",
      "zoomReset",
      "copyBranch",
      "openNote",
    ] as const)
      expect(isViewIntent(k)).toBe(true);
  });

  it("drops every editing intent", () => {
    for (const k of [
      "addChild",
      "addSibling",
      "delete",
      "rename",
      "typeEdit",
      "pasteBranch",
      "undo",
    ] as const)
      expect(isViewIntent(k)).toBe(false);
  });
});
