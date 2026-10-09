import { t } from "../i18n/registry";
import "./messages";
import { XMLParser } from "fast-xml-parser";
import type { MapNode, MindMapDoc } from "../model/types";
import { escapeXmlAttr as escapeXml } from "./xml";

// OPML <-> canonical model. OPML is the common outline-interchange format
// (Freeplane, OmniOutliner, Workflowy, …): nested <outline text="…"> elements.
// Notes round-trip via the de-facto `_note` attribute. This module pulls in
// fast-xml-parser, so the app loads it on demand (kept out of the entry bundle).

export function toOpml(doc: MindMapDoc): string {
  const lines: string[] = [];
  const walk = (node: MapNode, depth: number) => {
    const pad = "  ".repeat(depth + 3);
    const note = node.note ? ` _note="${escapeXml(node.note)}"` : "";
    const head = `${pad}<outline text="${escapeXml(node.topic)}"${note}`;
    if (node.children.length === 0) {
      lines.push(`${head} />`);
      return;
    }
    lines.push(`${head}>`);
    for (const child of node.children) walk(child, depth + 1);
    lines.push(`${pad}</outline>`);
  };
  walk(doc.root, 0);
  return `<?xml version="1.0" encoding="utf-8"?>
<opml version="2.0">
  <head><title>${escapeXml(doc.title)}</title></head>
  <body>
${lines.join("\n")}
  </body>
</opml>
`;
}

// biome-ignore lint/suspicious/noExplicitAny: tolerant shape from the XML parser
type Xml = any;

function asList<T>(x: T | T[] | undefined | null): T[] {
  if (x === undefined || x === null) return [];
  return Array.isArray(x) ? x : [x];
}

let opmlId = 0;

export function fromOpml(text: string): MindMapDoc {
  opmlId = 0;
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const tree = parser.parse(text);
  const opml = tree?.opml;
  if (!opml || opml.body === undefined) throw new Error(t("io.err.notOpml"));

  const title = String(opml.head?.title ?? t("io.title.importedOutline"));
  const toNode = (o: Xml): MapNode => {
    opmlId += 1;
    const node: MapNode = {
      id: `op${opmlId}`,
      topic: String(o?.["@_text"] ?? o?.["@_title"] ?? "").trim(),
      children: asList(o?.outline).map(toNode),
    };
    const note = o?.["@__note"];
    if (note !== undefined && note !== "") node.note = String(note);
    return node;
  };

  const tops = asList(opml.body.outline);
  // One top-level outline becomes the root; several get wrapped under a title root.
  const root =
    tops.length === 1 ? toNode(tops[0]) : { id: "root", topic: title, children: tops.map(toNode) };

  return {
    schemaVersion: 1,
    id: `op${opmlId + 1}`,
    title: title || root.topic || t("io.title.importedOutline"),
    root,
    meta: { source: "opml" },
  };
}
