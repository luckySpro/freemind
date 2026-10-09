import type { MindMapDoc } from "../model/types";
import { fromMarkdown } from "./markdown";

// Markmap <-> canonical model.
//
// A Markmap file (`.mm.md`) is standard Markdown optionally preceded by a YAML
// frontmatter block (`---` … `---`). The heading/bullet hierarchy is identical
// to the format fromMarkdown already understands, so this module's only job is
// stripping (and optionally reading) that frontmatter before delegating.
//
// Reuse policy: all Markdown parsing is done by fromMarkdown; this file adds
// nothing beyond the frontmatter handling.

/** Extract a `title:` value from a YAML frontmatter string, or return null. */
function parseFrontmatterTitle(frontmatter: string): string | null {
  for (const line of frontmatter.split(/\r?\n/)) {
    const m = line.match(/^title\s*:\s*(.+)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

/**
 * Parse a Markmap document into a MindMapDoc.
 *
 * Strips the optional YAML frontmatter (`---` … `---`) and delegates the
 * remaining Markdown to `fromMarkdown`. If the frontmatter contains a
 * `title:` field it overrides the title that `fromMarkdown` would derive from
 * the first `#` heading (or the "Untitled map" default).
 */
export function fromMarkmap(text: string): MindMapDoc {
  let body = text;
  let frontmatterTitle: string | null = null;

  // Detect a leading frontmatter block: first non-empty line must be exactly `---`.
  const trimmed = text.replace(/^[ \t]*\n/, "");
  if (trimmed.startsWith("---")) {
    // Find the closing `---` on its own line.
    const rest = trimmed.slice(3);
    const closeIdx = rest.search(/\r?\n---(\r?\n|$)/);
    if (closeIdx !== -1) {
      const frontmatter = rest.slice(0, closeIdx);
      frontmatterTitle = parseFrontmatterTitle(frontmatter);
      // Advance past the closing `---` line.
      const afterClose = rest.slice(closeIdx).replace(/\r?\n---/, "");
      body = afterClose;
    }
  }

  const doc = fromMarkdown(body);

  if (frontmatterTitle) {
    doc.title = frontmatterTitle;
    doc.root.topic = frontmatterTitle;
  }

  doc.meta = { ...doc.meta, source: "markmap" };

  return doc;
}
