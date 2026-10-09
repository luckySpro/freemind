import { t } from "../i18n/registry";
import type { MapNode, MindMapDoc } from "../model/types";

// Mermaid `mindmap` <-> canonical model.
//
// Mermaid's mindmap is a text format embedded in Markdown/docs: a `mindmap` header,
// then one node per line, hierarchy by indentation. We export the root as a circle
// (`(("…"))`) and every other node as a square (`["…"]`) with the text quoted so
// parentheses/brackets in topics don't break Mermaid's parser. Import is tolerant:
// it strips any node shape and uses relative indentation to rebuild the tree. Only the
// topic tree round-trips — Mermaid mindmap carries no notes/links/styling.

function escapeMermaid(t: string): string {
  return t.replace(/\r?\n/g, " ").replace(/"/g, "&quot;");
}

export function toMermaid(doc: MindMapDoc): string {
  const lines = ["mindmap", `  root(("${escapeMermaid(doc.root.topic)}"))`];
  const walk = (node: MapNode, depth: number) => {
    for (const child of node.children) {
      lines.push(`${"  ".repeat(depth)}["${escapeMermaid(child.topic)}"]`);
      walk(child, depth + 1);
    }
  };
  walk(doc.root, 2);
  return `${lines.join("\n")}\n`;
}

// Unwrap a node line's shape + quotes to its plain text. Handles ((circle)), {{hexagon}},
// [square], (round) and a leading optional id, then strips surrounding quotes and decodes
// the &quot; we (and Mermaid) use for embedded double-quotes.
function parseNodeText(line: string): string {
  const t = line.trim();
  const shape =
    t.match(/^[\w-]*\(\(([\s\S]*)\)\)$/) ||
    t.match(/^[\w-]*\{\{([\s\S]*)\}\}$/) ||
    t.match(/^[\w-]*\[([\s\S]*)\]$/) ||
    t.match(/^[\w-]*\(([\s\S]*)\)$/);
  let inner = shape ? shape[1] : t;
  inner = inner.trim().replace(/^"([\s\S]*)"$/, "$1");
  return inner
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .trim();
}

let mmId = 0;

export function fromMermaid(text: string): MindMapDoc {
  mmId = 0;
  const lines = text.split(/\r?\n/);
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().toLowerCase().startsWith("mindmap")) {
      start = i + 1;
      break;
    }
  }
  const stack: { indent: number; node: MapNode }[] = [];
  let root: MapNode | null = null;
  for (let i = start; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("%%")) continue; // blank / comment
    const topic = parseNodeText(raw);
    if (!topic) continue;
    const indent = raw.length - raw.trimStart().length;
    mmId += 1;
    const node: MapNode = { id: `mm${mmId}`, topic, children: [] };
    if (!root) {
      root = node;
      stack.push({ indent, node });
      continue;
    }
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1]?.node ?? root;
    parent.children.push(node);
    stack.push({ indent, node });
  }
  if (!root) throw new Error(t("io.err.notMermaid"));
  return {
    schemaVersion: 1,
    id: `mm${mmId + 1}`,
    title: root.topic,
    root,
    meta: { source: "mermaid" },
  };
}
