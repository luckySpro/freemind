import { t } from "../i18n/registry";
import "./messages";
// Excel (.xlsx) export + import: the map as an indented outline worksheet — each node on
// its own row, its topic placed in the column matching its depth (so the tree reads as an
// indented outline across columns), with a trailing Notes column.
//
// A .xlsx is an Open Packaging Conventions ZIP of SpreadsheetML parts. The exporter emits
// the minimal valid set — [Content_Types].xml, _rels/.rels, xl/workbook.xml (+ rels),
// xl/worksheets/sheet1.xml, xl/styles.xml — using inline strings (no sharedStrings
// part) to keep it compact. Pure + deterministic (entry mtimes pinned); only escaped
// topic/note text is interpolated.
//
// The importer reads xl/worksheets/sheet1.xml from any .xlsx ZIP and reconstructs the
// canonical mind-map tree. It handles all three SpreadsheetML cell value encodings:
// inline strings (t="inlineStr"), shared strings (t="s" + xl/sharedStrings.xml), and
// plain numeric/string values in <v>. Column letters map to 0-based depth; the first row
// whose first non-empty cell matches /^Level \d+$/ (or "Level 1") is treated as a header
// and skipped. A stack-based outline builder reconstructs the tree.

import { XMLParser } from "fast-xml-parser";
import { strFromU8 } from "fflate";
import type { MapNode, MindMapDoc } from "../model/types";
import { escapeXml, zipOoxml } from "./ooxml";
import { unzipOrThrow } from "./zip";

const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_PKG = "http://schemas.openxmlformats.org/package/2006/relationships";
const NS_CT = "http://schemas.openxmlformats.org/package/2006/content-types";
const REL_OFFICEDOC = `${NS_R}/officeDocument`;
const REL_WORKSHEET = `${NS_R}/worksheet`;
const REL_STYLES = `${NS_R}/styles`;
const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

// 1 -> "A", 26 -> "Z", 27 -> "AA"
function colLetter(col: number): string {
  let s = "";
  let n = col;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

interface OutlineRow {
  topic: string;
  depth: number;
  note?: string;
}

function flatten(doc: MindMapDoc): { rows: OutlineRow[]; maxDepth: number } {
  const rows: OutlineRow[] = [];
  let maxDepth = 0;
  const walk = (node: MapNode, depth: number) => {
    if (depth > maxDepth) maxDepth = depth;
    rows.push({
      topic: node.topic,
      depth,
      note: node.note?.trim().replace(/\s+/g, " ") || undefined,
    });
    for (const child of node.children) walk(child, depth + 1);
  };
  walk(doc.root, 0);
  return { rows, maxDepth };
}

function cell(ref: string, text: string, bold = false): string {
  return `<c r="${ref}"${bold ? ' s="1"' : ""} t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
}

function sheetXml(doc: MindMapDoc): string {
  const { rows, maxDepth } = flatten(doc);
  const notesCol = maxDepth + 2; // level columns are 1..maxDepth+1; Notes sits after them
  const out: string[] = [];

  const header: string[] = [];
  for (let d = 0; d <= maxDepth; d++)
    header.push(cell(`${colLetter(d + 1)}1`, `Level ${d + 1}`, true));
  header.push(cell(`${colLetter(notesCol)}1`, "Notes", true));
  out.push(`<row r="1">${header.join("")}</row>`);

  rows.forEach((row, i) => {
    const r = i + 2; // row 1 is the header
    const cells = [cell(`${colLetter(row.depth + 1)}${r}`, row.topic)];
    if (row.note) cells.push(cell(`${colLetter(notesCol)}${r}`, row.note));
    out.push(`<row r="${r}">${cells.join("")}</row>`);
  });

  return `${XML_DECL}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_R}"><sheetData>${out.join("")}</sheetData></worksheet>`;
}

const CONTENT_TYPES = `${XML_DECL}<Types xmlns="${NS_CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

const ROOT_RELS = `${XML_DECL}<Relationships xmlns="${NS_PKG}"><Relationship Id="rId1" Type="${REL_OFFICEDOC}" Target="xl/workbook.xml"/></Relationships>`;

const WORKBOOK = `${XML_DECL}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_R}"><sheets><sheet name="Map" sheetId="1" r:id="rId1"/></sheets></workbook>`;

const WORKBOOK_RELS = `${XML_DECL}<Relationships xmlns="${NS_PKG}"><Relationship Id="rId1" Type="${REL_WORKSHEET}" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL_STYLES}" Target="styles.xml"/></Relationships>`;

// Minimal styles: index 0 = default, index 1 = bold (for the header row). Excel expects
// the two canonical fills (none + gray125) and a default font/border/cellStyleXf present.
const STYLES = `${XML_DECL}<styleSheet xmlns="${NS_MAIN}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

export function buildXlsx(doc: MindMapDoc): Uint8Array {
  return zipOoxml({
    "[Content_Types].xml": CONTENT_TYPES,
    "_rels/.rels": ROOT_RELS,
    "xl/workbook.xml": WORKBOOK,
    "xl/_rels/workbook.xml.rels": WORKBOOK_RELS,
    "xl/worksheets/sheet1.xml": sheetXml(doc),
    "xl/styles.xml": STYLES,
  });
}

// ---------------------------------------------------------------------------
// Importer
// ---------------------------------------------------------------------------

// biome-ignore lint/suspicious/noExplicitAny: tolerant shape from the XML parser
type Xml = any;

function asList<T>(x: T | T[] | undefined | null): T[] {
  if (x === undefined || x === null) return [];
  return Array.isArray(x) ? x : [x];
}

// "A" -> 0, "B" -> 1, "Z" -> 25, "AA" -> 26
function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

// Extract column letters from a cell reference like "B3" -> "B", "AA12" -> "AA"
function colLettersFromRef(ref: string): string {
  const m = ref.match(/^([A-Za-z]+)/);
  return m ? m[1] : "";
}

// Resolve a <t> value which fast-xml-parser may hand back as a string or { "#text": ... }
function tText(t: Xml): string {
  if (t == null) return "";
  if (typeof t === "string" || typeof t === "number") return String(t);
  if (typeof t === "object") return String(t["#text"] ?? "");
  return "";
}

// Read a cell's text value from a parsed <c> element, given the shared-strings table.
function cellValue(c: Xml, sharedStrings: string[]): string {
  const type: string = c?.["@_t"] ?? "";
  if (type === "inlineStr") {
    // <c t="inlineStr"><is><t>…</t></is></c>
    return tText(c?.is?.t);
  }
  if (type === "s") {
    // <c t="s"><v>index</v></c>
    const idx = Number(c?.v);
    return Number.isFinite(idx) ? (sharedStrings[idx] ?? "") : "";
  }
  // Fallback: plain <v> (numbers, untyped strings from some exporters)
  const v = c?.v;
  if (v == null) return "";
  return String(v);
}

// Module-level counter so generated ids are unique within a session.
let xlN = 0;

function nextId(): string {
  xlN += 1;
  return `xl${xlN}`;
}

interface ParsedRow {
  depth: number;
  topic: string;
  note?: string;
}

/** Parse xl/sharedStrings.xml into a plain string array (index -> value). */
function parseSharedStrings(xml: string): string[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const tree = parser.parse(xml);
  const sst = tree?.sst ?? tree;
  return asList(sst?.si).map((si: Xml) => tText(si?.t));
}

/** Parse xl/worksheets/sheet1.xml rows into (depth, topic, note?) tuples. */
function parseRows(xml: string, sharedStrings: string[]): ParsedRow[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const tree = parser.parse(xml);
  const sheetData = tree?.worksheet?.sheetData ?? tree?.sheetData;
  const allRows = asList(sheetData?.row);

  const result: ParsedRow[] = [];
  for (const row of allRows) {
    const cells = asList(row?.c);
    if (cells.length === 0) continue;

    // Build a map of 0-based col index -> text for non-empty cells in this row
    const colMap = new Map<number, string>();
    for (const c of cells) {
      const ref: string = c?.["@_r"] ?? "";
      const letters = colLettersFromRef(ref);
      if (!letters) continue;
      const text = cellValue(c, sharedStrings).trim();
      if (text) colMap.set(colIndex(letters), text);
    }

    if (colMap.size === 0) continue; // fully empty row

    // Find the first (lowest col index) non-empty cell
    const firstCol = Math.min(...colMap.keys());
    const firstText = colMap.get(firstCol) ?? "";

    // Detect header row: any cell value matching /^Level \d+$/ in the first column
    if (/^Level \d+$/i.test(firstText)) continue;

    // depth = column index of the first non-empty cell (col A=0 → depth 0, B=1 → depth 1, …)
    const depth = firstCol;
    const topic = firstText;

    // Note: any non-empty cell in a strictly greater column index (the Notes column sits last)
    let note: string | undefined;
    for (const [col, text] of colMap) {
      if (col > firstCol) {
        note = text;
        break; // take the first one (Notes is always the rightmost, but guard for any extra)
      }
    }

    result.push({ depth, topic, ...(note ? { note } : {}) });
  }
  return result;
}

/** Stack-based outline builder: ordered (depth, topic, note) rows → MapNode tree. */
function buildTree(rows: ParsedRow[]): MapNode {
  if (rows.length === 0) throw new Error(t("io.err.xlsxNoRows"));

  // Each entry: [node, depth]
  const stack: Array<[MapNode, number]> = [];

  let root: MapNode | undefined;

  for (const row of rows) {
    const node: MapNode = {
      id: nextId(),
      topic: row.topic,
      children: [],
      ...(row.note ? { note: row.note } : {}),
    };

    if (root === undefined) {
      root = node;
      stack.push([node, row.depth]);
      continue;
    }

    // Pop the stack until we find the most recent node with strictly smaller depth
    while (stack.length > 1 && stack[stack.length - 1][1] >= row.depth) {
      stack.pop();
    }

    const [parent] = stack[stack.length - 1];
    parent.children.push(node);
    stack.push([node, row.depth]);
  }

  if (!root) throw new Error(t("io.err.xlsxNoRows"));
  return root;
}

/**
 * Import a .xlsx file (Uint8Array) and return a canonical MindMapDoc.
 *
 * Reads xl/worksheets/sheet1.xml (and xl/sharedStrings.xml if present) from the
 * OOXML ZIP. Each data row maps depth (column index of first non-empty cell) →
 * nesting level; a stack-based outline builder reconstructs the tree.
 */
export function fromXlsx(bytes: Uint8Array): MindMapDoc {
  const files = unzipOrThrow(bytes, ".xlsx");

  const sheetEntry = files["xl/worksheets/sheet1.xml"];
  if (!sheetEntry) throw new Error(t("io.err.xlsxNoSheet"));

  // Parse shared strings if present (real Excel files use them; our exporter does not)
  const sharedStrings: string[] = [];
  const ssEntry = files["xl/sharedStrings.xml"];
  if (ssEntry) {
    sharedStrings.push(...parseSharedStrings(strFromU8(ssEntry)));
  }

  const rows = parseRows(strFromU8(sheetEntry), sharedStrings);
  if (rows.length === 0) throw new Error(t("io.err.xlsxNoRows"));

  const root = buildTree(rows);
  const title = root.topic;

  return {
    schemaVersion: 1,
    id: nextId(),
    title,
    root,
    meta: { source: "xlsx" },
  };
}
