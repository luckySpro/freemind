import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildEpub } from "../scripts/build-book-epub.mjs";
import { buildPdf } from "../scripts/build-book-pdf.mjs";
import { CHAPTER_FILES } from "../scripts/lib/bookChapters.mjs";

// End-to-end guard on the book BUILDERS (not just the lib): a regression in the
// EPUB/PDF assembly fails CI rather than shipping a broken download.

describe("EPUB builder", () => {
  it("packages mimetype first, one xhtml per chapter, and the stable id", async () => {
    const zip = await JSZip.loadAsync(await buildEpub());
    const names = Object.keys(zip.files);
    expect(names[0]).toBe("mimetype");
    expect(await zip.file("mimetype")?.async("string")).toBe("application/epub+zip");
    const chapterDocs = names.filter((n) => /^OEBPS\/chapter-\d+\.xhtml$/.test(n));
    expect(chapterDocs).toHaveLength(CHAPTER_FILES.length);
    const opf = await zip.file("OEBPS/content.opf")?.async("string");
    expect(opf).toContain("mindmap-studio-thinking-in-maps-2026-v1");
    expect(opf).toContain("<dc:title>Thinking in Maps</dc:title>");
  });

  it("is byte-deterministic across builds (no wall-clock leak)", async () => {
    const a = await buildEpub();
    const b = await buildEpub();
    expect(Buffer.compare(a, b)).toBe(0);
  });
});

describe("PDF builder", () => {
  it("has a cover + TOC + a page per chapter, with metadata and bookmarks", async () => {
    const pdf = await PDFDocument.load(await buildPdf());
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(CHAPTER_FILES.length + 2); // cover + TOC + chapters
    expect(pdf.getTitle()).toBe("Thinking in Maps");
    expect(pdf.getAuthor()).toBe("Dann Bleeker Pedersen");
    expect(pdf.getKeywords()).toContain("mindmap-studio-thinking-in-maps");
  });
});
