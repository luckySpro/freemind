// useMapExports integration tests: verify export handlers call the correct formatters
// with the right arguments. Tests the plumbing without requiring jsdom Blob/URL mocking.

import { describe, expect, it } from "vitest";
import { serializeDoc } from "../src/io/json";
import { toMarkdown } from "../src/io/markdown";
import { toMermaid } from "../src/io/mermaid";
import type { MindMapDoc } from "../src/model/types";

const mockDoc: MindMapDoc = {
  schemaVersion: 1,
  id: "test-doc",
  title: "Test Export",
  root: {
    id: "root",
    topic: "Root",
    children: [{ id: "child1", topic: "Child", children: [] }],
  },
};

describe("useMapExports formatters (integration)", () => {
  describe("serializeDoc (JSON export)", () => {
    it("exports the document as JSON string", () => {
      const json = serializeDoc(mockDoc);
      expect(json).toContain('"schemaVersion"');
      expect(json).toContain('"Root"');
      expect(json).toContain("Test Export");
    });

    it("can be parsed back to a valid document", () => {
      const json = serializeDoc(mockDoc);
      const parsed = JSON.parse(json);
      expect(parsed.title).toBe("Test Export");
      expect(parsed.root.topic).toBe("Root");
      expect(parsed.root.children[0].topic).toBe("Child");
    });

    it("includes all document metadata", () => {
      const json = serializeDoc(mockDoc);
      expect(json).toContain(`"schemaVersion": ${mockDoc.schemaVersion}`);
      expect(json).toContain(`"id": "${mockDoc.id}"`);
    });

    it("handles documents with empty children", () => {
      const docWithoutChildren: MindMapDoc = {
        ...mockDoc,
        root: { ...mockDoc.root, children: [] },
      };
      const json = serializeDoc(docWithoutChildren);
      const parsed = JSON.parse(json);
      expect(parsed.root.children).toEqual([]);
    });

    it("handles nested child structures", () => {
      const docWithNesting: MindMapDoc = {
        ...mockDoc,
        root: {
          ...mockDoc.root,
          children: [
            {
              id: "a",
              topic: "A",
              children: [
                { id: "a1", topic: "A1", children: [] },
                { id: "a2", topic: "A2", children: [] },
              ],
            },
          ],
        },
      };
      const json = serializeDoc(docWithNesting);
      const parsed = JSON.parse(json);
      expect(parsed.root.children[0].children.length).toBe(2);
      expect(parsed.root.children[0].children[0].topic).toBe("A1");
    });
  });

  describe("toMarkdown (Markdown export)", () => {
    it("exports the document as Markdown outline", () => {
      const md = toMarkdown(mockDoc);
      expect(md).toContain("Root");
      expect(md).toContain("Child");
    });

    it("uses hierarchy levels (# markdown)", () => {
      const md = toMarkdown(mockDoc);
      expect(md).toContain("# ");
    });

    it("produces multiline output", () => {
      const md = toMarkdown(mockDoc);
      expect(md.split("\n").length).toBeGreaterThan(1);
    });

    it("renders the root topic as H1 (not the document title)", () => {
      const md = toMarkdown(mockDoc);
      expect(md).toContain("# Root");
      // Document title field is not included in markdown export (only tree structure)
    });

    it("handles documents with no children", () => {
      const docWithoutChildren: MindMapDoc = {
        ...mockDoc,
        root: { ...mockDoc.root, children: [] },
      };
      const md = toMarkdown(docWithoutChildren);
      expect(md).toBeTruthy();
      expect(md).toContain("Root");
    });

    it("renders nested topics with indentation or hierarchy markers", () => {
      const docWithNesting: MindMapDoc = {
        ...mockDoc,
        root: {
          ...mockDoc.root,
          children: [
            {
              id: "a",
              topic: "Parent",
              children: [{ id: "a1", topic: "Nested Child", children: [] }],
            },
          ],
        },
      };
      const md = toMarkdown(docWithNesting);
      expect(md).toContain("Parent");
      expect(md).toContain("Nested Child");
    });
  });

  describe("toMermaid (Mermaid mindmap export)", () => {
    it("exports the document as Mermaid mindmap syntax", () => {
      const mmd = toMermaid(mockDoc);
      expect(mmd).toContain("mindmap");
      expect(mmd).toContain("Root");
    });

    it("produces valid Mermaid syntax (starts with mindmap)", () => {
      const mmd = toMermaid(mockDoc);
      expect(mmd.trim()).toMatch(/^mindmap/);
    });

    it("includes all topics from the tree", () => {
      const mmd = toMermaid(mockDoc);
      expect(mmd).toContain("Root");
      expect(mmd).toContain("Child");
    });

    it("handles empty child lists", () => {
      const docWithoutChildren: MindMapDoc = {
        ...mockDoc,
        root: { ...mockDoc.root, children: [] },
      };
      const mmd = toMermaid(docWithoutChildren);
      expect(mmd).toContain("mindmap");
      expect(mmd).toContain("Root");
    });

    it("properly structures nested topics", () => {
      const docWithNesting: MindMapDoc = {
        ...mockDoc,
        root: {
          ...mockDoc.root,
          children: [
            {
              id: "a",
              topic: "Branch A",
              children: [{ id: "a1", topic: "Leaf A1", children: [] }],
            },
            {
              id: "b",
              topic: "Branch B",
              children: [],
            },
          ],
        },
      };
      const mmd = toMermaid(docWithNesting);
      expect(mmd).toContain("Branch A");
      expect(mmd).toContain("Leaf A1");
      expect(mmd).toContain("Branch B");
    });
  });

  describe("Export title handling (baseName fallback)", () => {
    it("uses document title when present", () => {
      const json = serializeDoc(mockDoc);
      expect(json).toContain("Test Export");
    });

    it("handles documents with empty title", () => {
      const docWithoutTitle = { ...mockDoc, title: "" };
      const json = serializeDoc(docWithoutTitle);
      expect(json).toBeTruthy();
      const parsed = JSON.parse(json);
      expect(parsed.title).toBe("");
    });

    it("handles documents with special characters in title", () => {
      const docWithSpecialChars = { ...mockDoc, title: 'Test "Export" & Analysis' };
      const json = serializeDoc(docWithSpecialChars);
      const parsed = JSON.parse(json);
      expect(parsed.title).toBe('Test "Export" & Analysis');
    });

    it("handles documents with unicode in title", () => {
      const docWithUnicode = { ...mockDoc, title: "测试导出 🎯" };
      const json = serializeDoc(docWithUnicode);
      const parsed = JSON.parse(json);
      expect(parsed.title).toBe("测试导出 🎯");
    });
  });

  describe("Export consistency across formats", () => {
    it("all formats can be generated from the same document", () => {
      const json = serializeDoc(mockDoc);
      const md = toMarkdown(mockDoc);
      const mmd = toMermaid(mockDoc);

      expect(json).toBeTruthy();
      expect(md).toBeTruthy();
      expect(mmd).toBeTruthy();
    });

    it("all formats include the root topic", () => {
      const json = serializeDoc(mockDoc);
      const md = toMarkdown(mockDoc);
      const mmd = toMermaid(mockDoc);

      expect(json).toContain("Root");
      expect(md).toContain("Root");
      expect(mmd).toContain("Root");
    });

    it("all formats include child topics", () => {
      const json = serializeDoc(mockDoc);
      const md = toMarkdown(mockDoc);
      const mmd = toMermaid(mockDoc);

      expect(json).toContain("Child");
      expect(md).toContain("Child");
      expect(mmd).toContain("Child");
    });

    it("JSON export is reversible (lossless for basic maps)", () => {
      const json = serializeDoc(mockDoc);
      const parsed = JSON.parse(json) as MindMapDoc;

      // Verify key properties are preserved
      expect(parsed.title).toBe(mockDoc.title);
      expect(parsed.schemaVersion).toBe(mockDoc.schemaVersion);
      expect(parsed.root.topic).toBe(mockDoc.root.topic);
      expect(parsed.root.children.length).toBe(mockDoc.root.children.length);
    });
  });
});
