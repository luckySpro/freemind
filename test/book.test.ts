import { describe, expect, it } from "vitest";
import {
  BOOK_ID,
  BOOK_TITLE,
  CHAPTER_FILES,
  TOC_GROUPS,
  readChapterMetadata,
} from "../scripts/lib/bookChapters.mjs";
import {
  diagramCaption,
  diagramLayout,
  diagramSvg,
  hasDiagram,
} from "../scripts/lib/bookDiagrams.mjs";

// Guards the book infrastructure (scripts/lib/*) — so a broken diagram model, or a
// chapter added to the manifest without a matching file, fails CI instead of a reader.

describe("book chapter manifest", () => {
  it("reads every chapter with a non-empty H1 title", async () => {
    const chapters = await readChapterMetadata();
    expect(chapters).toHaveLength(CHAPTER_FILES.length);
    for (const c of chapters) {
      expect(c.title.trim().length).toBeGreaterThan(0);
      expect(c.slug).toBe(c.filename.replace(/\.md$/, ""));
    }
  });

  it("starts with the foreword and has a stable book identity", async () => {
    const chapters = await readChapterMetadata();
    expect(chapters[0].filename).toBe("00-foreword.md");
    expect(BOOK_TITLE).toBe("Thinking in Maps");
    expect(BOOK_ID).toMatch(/^urn:uuid:/);
  });

  it("sorts every chapter into exactly one TOC group", async () => {
    const chapters = await readChapterMetadata();
    for (const c of chapters) {
      const groups = TOC_GROUPS.filter((g) => g.match(c));
      expect(groups, `${c.filename} should match one TOC group`).toHaveLength(1);
    }
  });
});

describe("book diagrams (generated from source constants)", () => {
  it("lays out first-map as a root plus six branches", () => {
    const { nodes, edges, width, height } = diagramLayout("first-map");
    expect(nodes).toHaveLength(7); // 1 root + 6 children
    expect(edges).toHaveLength(6); // one connector per child
    expect(nodes[0].root).toBe(true);
    expect(nodes[0].label).toBe("New idea");
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  it("renders first-map as a well-formed SVG carrying every label", () => {
    const svg = diagramSvg("first-map");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    for (const label of ["New idea", "Who", "What", "Why", "How", "When", "Where"]) {
      expect(svg).toContain(label);
    }
  });

  it("lays out swot as a root plus four branches", () => {
    const { nodes, edges } = diagramLayout("swot");
    expect(nodes).toHaveLength(5); // 1 root + 4 children
    expect(edges).toHaveLength(4);
    const svg = diagramSvg("swot");
    for (const label of ["Our product", "Strengths", "Weaknesses", "Opportunities", "Threats"]) {
      expect(svg).toContain(label);
    }
  });

  it("reports known vs unknown diagrams", () => {
    expect(hasDiagram("first-map")).toBe(true);
    expect(hasDiagram("swot")).toBe(true);
    expect(hasDiagram("does-not-exist")).toBe(false);
    expect(diagramCaption("first-map").length).toBeGreaterThan(0);
  });

  it("throws on an unknown diagram layout rather than emitting a blank", () => {
    expect(() => diagramLayout("nope")).toThrow();
  });
});
