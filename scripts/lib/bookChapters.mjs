/**
 * Shared chapter manifest + book metadata used by both
 * `scripts/build-book-epub.mjs` and `scripts/build-book-pdf.mjs`, so the
 * EPUB and PDF stay in lockstep (same chapters, same order, same identity).
 *
 * Hand-listed (rather than an alphabetical directory sort) so re-ordering and
 * renaming is explicit and appendices never intermix with numbered chapters.
 * Mirrors `docs/guide/README.md`.
 *
 * Add a chapter: append the filename to CHAPTER_FILES AND give the new file an
 * H1. `readChapterMetadata` reads the H1 (title) + optional H3 (subtitle) from
 * the source, so a rename can't silently drift the table of contents.
 */

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = resolve(HERE, "..", "..");
export const GUIDE_DIR = join(PROJECT_ROOT, "docs", "guide"); // book source (markdown)
export const PUBLIC_DIR = join(PROJECT_ROOT, "public"); // book output (deploys with the site)

// --- book identity -----------------------------------------------------------
// Stable id, pinned once: e-readers (Kindle included) cache by identifier, so a
// fresh id every build would force readers to re-add the book as a new title.
export const BOOK_ID = "urn:uuid:mindmap-studio-thinking-in-maps-2026-v1";
export const BOOK_TITLE = "Thinking in Maps";
export const BOOK_SUBTITLE =
  "A practical guide to mind mapping — the technique and the canvas — with MindMap Studio.";
export const BOOK_AUTHOR = "Dann Bleeker Pedersen";
export const BOOK_LANG = "en";
export const BOOK_PUBLISHER = "mindmap-studio.struktureretsundfornuft.dk";
export const BOOK_SUBJECTS = ["Mind mapping", "Visual thinking", "Brainstorming", "MindMap Studio"];
// Output basenames (shared so the workflow + builders agree on the filenames).
export const BOOK_SLUG = "Thinking-in-Maps";

/**
 * Canonical chapter order. Each entry is a filename relative to GUIDE_DIR.
 */
export const CHAPTER_FILES = [
  "00-foreword.md",
  "01-your-first-map.md",
  "02-anatomy-of-a-map.md",
  "03-structuring-ideas.md",
  "04-enriching-nodes.md",
  "05-navigating-large-maps.md",
  "06-sharing-and-exporting.md",
  "07-presenting-and-workshops.md",
  "08-thinking-with-maps.md",
  "appendix-a-keyboard-reference.md",
  "appendix-b-format-reference.md",
  "appendix-c-further-reading.md",
];

/**
 * Read the chapter manifest with H1 (title) + optional H3 (subtitle) derived
 * from the source. Throws on the first chapter missing an H1 — a manuscript
 * error worth surfacing loudly rather than emitting an empty TOC label.
 */
export async function readChapterMetadata() {
  const result = [];
  for (const filename of CHAPTER_FILES) {
    const full = join(GUIDE_DIR, filename);
    const raw = await readFile(full, "utf8");
    const h1Match = raw.match(/^#\s+(.+?)\s*$/m);
    if (!h1Match) throw new Error(`No H1 found in ${filename}`);
    const h3Match = raw.match(/^###\s+(.+?)\s*$/m);
    result.push({
      filename,
      slug: filename.replace(/\.md$/, ""),
      title: h1Match[1],
      subtitle: h3Match ? h3Match[1] : null,
      raw,
    });
  }
  return result;
}

/**
 * TOC part-headers. Matched on the filename prefix (stable across H1 renames)
 * so the PDF and EPUB show the same hierarchy.
 */
export const TOC_GROUPS = [
  { label: "Front matter", match: (c) => c.filename.startsWith("00-") },
  { label: "Part 1 — Getting started", match: (c) => /^0[12]-/.test(c.filename) },
  { label: "Part 2 — Building maps", match: (c) => /^0[345]-/.test(c.filename) },
  { label: "Part 3 — Sharing your thinking", match: (c) => /^0[67]-/.test(c.filename) },
  { label: "Part 4 — The practice", match: (c) => c.filename.startsWith("08-") },
  { label: "Appendices", match: (c) => c.filename.startsWith("appendix-") },
];
