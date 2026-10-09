import { t } from "../i18n/registry";
import "./messages";
import { XMLParser } from "fast-xml-parser";
import type { MapNode, MindMapDoc } from "../model/types";
import { isDangerousUrl } from "./urlSafety";
import { escapeXmlAttr as escapeXml } from "./xml";

// FreeMind / Freeplane `.mm` <-> canonical model.
//
// `.mm` is plain XML: a single root `<node TEXT="…">` whose nested `<node>`s form the
// tree. It's the most widely interchanged mind-map format (FreeMind, Freeplane, and many
// importers read it). We round-trip the topic tree plus the fields that map cleanly:
//   • TEXT            <-> topic
//   • LINK            <-> hyperlink   (dangerous schemes dropped, like the rest of the app)
//   • FOLDED="true"   <-> collapsed
//   • <richcontent TYPE="NOTE">…</>  <-> note   (HTML body text)
// Per-node styling, icons and positions are tool-specific and intentionally not carried.
// fast-xml-parser is pulled in here, so the app loads this module on demand.

export function toFreemind(doc: MindMapDoc): string {
  const lines: string[] = [];
  const walk = (node: MapNode, depth: number) => {
    const pad = "  ".repeat(depth + 1);
    const attrs = [`TEXT="${escapeXml(node.topic)}"`];
    if (node.hyperlink && !isDangerousUrl(node.hyperlink)) {
      attrs.push(`LINK="${escapeXml(node.hyperlink)}"`);
    }
    if (node.collapsed) attrs.push('FOLDED="true"');
    const hasChildren = node.children.length > 0;
    const hasNote = Boolean(node.note);
    if (!hasChildren && !hasNote) {
      lines.push(`${pad}<node ${attrs.join(" ")}/>`);
      return;
    }
    lines.push(`${pad}<node ${attrs.join(" ")}>`);
    if (node.note) {
      const body = node.note
        .split(/\r?\n/)
        .map((line) => `<p>${escapeXml(line)}</p>`)
        .join("");
      lines.push(
        `${pad}  <richcontent TYPE="NOTE"><html><head></head><body>${body}</body></html></richcontent>`,
      );
    }
    for (const child of node.children) walk(child, depth + 1);
    lines.push(`${pad}</node>`);
  };
  walk(doc.root, 0);
  return `<map version="1.0.1">\n${lines.join("\n")}\n</map>\n`;
}

// biome-ignore lint/suspicious/noExplicitAny: tolerant shape from the XML parser
type Xml = any;

function asList<T>(x: T | T[] | undefined | null): T[] {
  if (x === undefined || x === null) return [];
  return Array.isArray(x) ? x : [x];
}

// Recursively gather text from a parsed richcontent subtree (skipping @_ attributes),
// joined into the note's plain text. fast-xml-parser turns the note HTML into nested
// objects, so we walk them rather than try to re-serialise the markup.
function collectText(node: Xml): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join("\n");
  const parts: string[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith("@_")) continue;
    parts.push(collectText(value));
  }
  return parts.filter(Boolean).join("\n");
}

function noteOf(o: Xml): string {
  for (const rc of asList(o?.richcontent)) {
    if (rc?.["@_TYPE"] === "NOTE") return collectText(rc).trim();
  }
  return "";
}

let fmId = 0;

export function fromFreemind(text: string): MindMapDoc {
  fmId = 0;
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const tree = parser.parse(text);
  const map = tree?.map;
  const rootEl = asList(map?.node)[0];
  if (!map || !rootEl) throw new Error(t("io.err.notFreeMind"));

  const toNode = (o: Xml): MapNode => {
    fmId += 1;
    const node: MapNode = {
      id: `fm${fmId}`,
      topic: String(o?.["@_TEXT"] ?? "").trim(),
      children: asList(o?.node).map(toNode),
    };
    const link = o?.["@_LINK"];
    if (typeof link === "string" && link && !isDangerousUrl(link)) node.hyperlink = link;
    if (o?.["@_FOLDED"] === "true" || o?.["@_FOLDED"] === true) node.collapsed = true;
    const note = noteOf(o);
    if (note) node.note = note;
    return node;
  };

  const root = toNode(rootEl);
  const title = root.topic || "Imported map";
  return {
    schemaVersion: 1,
    id: `fm${fmId + 1}`,
    title,
    root,
    meta: { source: "freemind" },
  };
}
