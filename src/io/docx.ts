import { t } from "../i18n/registry";
import "./messages";
// Word (.docx) import + export: the map as an indented outline document.
//
// A .docx is an Open Packaging Conventions ZIP of XML parts.
//
// EXPORT: We emit the minimal valid set — [Content_Types].xml, _rels/.rels,
// word/document.xml — and style every paragraph with DIRECT formatting
// (bold / size / indent) rather than named paragraph styles: a styles.xml-less
// document that relies on "latent" built-in styles renders inconsistently across
// Word / LibreOffice / Pages / Google Docs, whereas direct run properties render
// identically everywhere.  Pure + deterministic (entry mtimes pinned), so it's
// unit-testable by unzipping and validating the XML.
//
// IMPORT (fromDocx): reads word/document.xml from any .docx ZIP and rebuilds the
// mind-map tree from paragraph depth cues.  Depth is determined by:
//   1. Named style: /^Title$/i → 0, /^Heading(\d+)$/i → N (real Word docs).
//   2. Indentation: round(w:ind@w:left / 360) — matches our own exporter's output
//      so buildDocx→fromDocx round-trips exactly.
// Italic runs at indent = parent's indent + 360 are re-attached as notes (as
// written by our exporter).  The "• " bullet prefix added by our exporter is
// stripped from child topics.  Styling, images, hyperlinks, and rich text are
// intentionally not imported — only the plain-text topic tree + notes.

import { XMLParser } from "fast-xml-parser";
import { strFromU8 } from "fflate";
import type { MapNode, MindMapDoc } from "../model/types";
import { escapeXml, zipOoxml } from "./ooxml";
import { unzipOrThrow } from "./zip";

const TWIPS_PER_LEVEL = 360; // 0.25" of left indent per outline level

interface RunOpts {
  bold?: boolean;
  italic?: boolean;
  /** Font size in half-points (Word's unit): 24 = 12pt. */
  sizeHalfPt?: number;
}

function run(text: string, opts: RunOpts = {}): string {
  const rPr = [
    opts.bold ? "<w:b/>" : "",
    opts.italic ? "<w:i/>" : "",
    opts.sizeHalfPt ? `<w:sz w:val="${opts.sizeHalfPt}"/>` : "",
  ].join("");
  // xml:space="preserve" keeps the bullet's trailing space and any indentation.
  return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function paragraph(runsXml: string, indentTwips = 0): string {
  const pPr = indentTwips ? `<w:pPr><w:ind w:left="${indentTwips}"/></w:pPr>` : "";
  return `<w:p>${pPr}${runsXml}</w:p>`;
}

// A note may be multi-line; each non-blank line becomes its own italic paragraph.
function noteParagraphs(note: string, indentTwips: number): string[] {
  return note
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => paragraph(run(line, { italic: true }), indentTwips));
}

function bodyXml(doc: MindMapDoc): string {
  const out: string[] = [];
  const title = doc.title || doc.root.topic || "Mind map";
  out.push(paragraph(run(title, { bold: true, sizeHalfPt: 36 }))); // 18pt title
  if (doc.root.note?.trim()) out.push(...noteParagraphs(doc.root.note, TWIPS_PER_LEVEL));

  const walk = (node: MapNode, depth: number) => {
    for (const child of node.children) {
      const isBranch = depth === 0; // a direct child of the root is a top-level branch
      const indent = (depth + 1) * TWIPS_PER_LEVEL;
      out.push(
        paragraph(
          run(`• ${child.topic}`, { bold: isBranch, sizeHalfPt: isBranch ? 28 : undefined }),
          indent,
        ),
      );
      if (child.note?.trim()) out.push(...noteParagraphs(child.note, indent + TWIPS_PER_LEVEL));
      walk(child, depth + 1);
    }
  };
  walk(doc.root, 0);
  return out.join("");
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

function documentXml(doc: MindMapDoc): string {
  // A4 page (11906×16838 twips) with 1" (1440 twip) margins.
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml(doc)}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
}

export function buildDocx(doc: MindMapDoc): Uint8Array {
  return zipOoxml({
    "[Content_Types].xml": CONTENT_TYPES,
    "_rels/.rels": RELS,
    "word/document.xml": documentXml(doc),
  });
}

// ---------------------------------------------------------------------------
// IMPORTER
// ---------------------------------------------------------------------------

// biome-ignore lint/suspicious/noExplicitAny: tolerant shape from the XML parser
type Xml = any;

function asList<T>(x: T | T[] | undefined | null): T[] {
  if (x === undefined || x === null) return [];
  return Array.isArray(x) ? x : [x];
}

/** Coerce a w:t value (string, or `{ "#text": "…", "@_xml:space": "preserve" }`) to string. */
function wText(t: Xml): string {
  if (t == null) return "";
  if (typeof t === "string" || typeof t === "number") return String(t);
  return String(t["#text"] ?? "");
}

/** Concatenate all w:t text across all w:r runs in a paragraph element. */
function paraText(p: Xml): string {
  return asList(p?.["w:r"])
    .map((r: Xml) => asList(r?.["w:t"]).map(wText).join(""))
    .join("");
}

/** True when ALL runs in the paragraph carry <w:i/> (i.e. the note-paragraph style we emit). */
function isAllItalic(p: Xml): boolean {
  const runs = asList(p?.["w:r"]);
  if (runs.length === 0) return false;
  return runs.every((r: Xml) => {
    const rPr = r?.["w:rPr"];
    // fast-xml-parser collapses a self-closing tag to `""` or `true` or an empty object.
    return rPr != null && (rPr["w:i"] !== undefined || rPr["w:i/"] !== undefined);
  });
}

/** Return the paragraph's indent in twips (0 if absent). */
function paraIndent(p: Xml): number {
  const ind = p?.["w:pPr"]?.["w:ind"];
  if (ind == null) return 0;
  const val = ind["@_w:left"];
  return Number(val) || 0;
}

/** Depth from a named style (Title → 0; Heading1 → 1; Heading2 → 2; …); -1 if none. */
function styleDepth(p: Xml): number {
  const style = p?.["w:pPr"]?.["w:pStyle"];
  if (style == null) return -1;
  const val: string = String(style["@_w:val"] ?? style["@_w:styleId"] ?? style ?? "");
  if (/^Title$/i.test(val)) return 0;
  const m = /^Heading\s*(\d+)$/i.exec(val);
  return m ? Number(m[1]) : -1;
}

let dxCounter = 0;

function nextId(): string {
  dxCounter += 1;
  return `dx${dxCounter}`;
}

interface ParaRow {
  text: string;
  depth: number;
  indent: number; // raw twip indent — used for note detection
  italic: boolean;
}

export function fromDocx(bytes: Uint8Array): MindMapDoc {
  dxCounter = 0;

  // Unzip and locate word/document.xml.
  const files = unzipOrThrow(bytes, ".docx");
  const xmlEntry = files["word/document.xml"];
  if (!xmlEntry) throw new Error(t("io.err.docxNoDocument"));

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const tree = parser.parse(strFromU8(xmlEntry));

  // Navigate to w:body paragraphs.
  const body =
    tree?.["w:document"]?.["w:body"] ?? tree?.["w:document"]?.["w:body"] ?? tree?.document?.body;
  const rawParas = asList(body?.["w:p"] ?? null);

  if (rawParas.length === 0) throw new Error(t("io.err.docxNoParagraphs"));

  // Build (text, depth, indent, italic) rows — skip empty paragraphs.
  const rows: ParaRow[] = [];
  for (const p of rawParas) {
    const text = paraText(p).trim();
    if (!text) continue;
    const indent = paraIndent(p);
    const sd = styleDepth(p);
    const depth = sd >= 0 ? sd : Math.round(indent / TWIPS_PER_LEVEL);
    rows.push({ text, depth, indent, italic: isAllItalic(p) });
  }

  if (rows.length === 0) throw new Error(t("io.err.docxNoParagraphs"));

  // Stack-based outline builder.
  // Stack entries: { node, depth, indent } — we carry `indent` so that our exporter's
  // note paragraphs (italic, indent = parent indent + 360) can be detected and reattached.
  interface StackEntry {
    node: MapNode;
    depth: number;
    indent: number; // raw twip indent of the node paragraph
  }

  const rootRow = rows[0];
  const root: MapNode = {
    id: nextId(),
    topic: rootRow.text.replace(/^•\s*/, ""),
    children: [],
  };
  const stack: StackEntry[] = [{ node: root, depth: rootRow.depth, indent: rootRow.indent }];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    // Detect note paragraphs: italic AND indent === top-of-stack's indent + TWIPS_PER_LEVEL.
    // This matches what our exporter emits (noteParagraphs at indent + TWIPS_PER_LEVEL).
    // For heading-style docs no such notes exist, so this only fires for our own output.
    const top = stack[stack.length - 1];
    if (row.italic && row.indent === top.indent + TWIPS_PER_LEVEL) {
      // Append to the current top node's note (multi-line notes get multiple paragraphs).
      top.node.note = top.node.note ? `${top.node.note}\n${row.text}` : row.text;
      continue;
    }

    // Pop the stack until we find a node with strictly smaller depth.
    while (stack.length > 1 && stack[stack.length - 1].depth >= row.depth) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    const newNode: MapNode = {
      id: nextId(),
      topic: row.text.replace(/^•\s*/, ""), // strip bullet prefix from our exporter
      children: [],
    };
    parent.node.children.push(newNode);
    stack.push({ node: newNode, depth: row.depth, indent: row.indent });
  }

  return {
    schemaVersion: 1,
    id: nextId(),
    title: root.topic,
    root,
    meta: { source: "docx" },
  };
}
