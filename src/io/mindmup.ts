import { t } from "../i18n/registry";
import "./messages";
import type { MapNode, MindMapDoc } from "../model/types";
import { isDangerousUrl } from "./urlSafety";

// MindMup `.mup` importer (import-only).
//
// A `.mup` file is a JSON document whose top-level object IS the root node.
// The format uses `title` for the topic text, `ideas` (an object keyed by
// numeric rank strings) for child nodes, and an optional `attr` object for
// notes and hyperlinks. Children are ordered by the numeric value of their
// rank key (ascending); negative ranks represent left-side branches in
// MindMup's two-sided layout — we include them in rank order without
// preserving side information, which our model does not require.
//
// Format version 2 (the common `.mup` export) is targeted here. The importer
// also accepts files that lack `formatVersion` provided they carry a `title`
// or `ideas` field, so hand-crafted and version-1 files degrade gracefully.
//
// NOTE: schema verified against the publicly documented MindMup v2 format
// and the open-source MindMup repository; not yet validated against a real
// MindMup-exported .mup file — validate with a real file when one is available
// (same caveat as the .smmx, .mmap, and .mind importers).

// biome-ignore lint/suspicious/noExplicitAny: tolerant shape from arbitrary MindMup JSON
type Json = any;

let mupId = 0;

/** Sort the `ideas` object entries by numeric rank, ascending. */
function sortedIdeas(ideas: Json): Json[] {
  if (!ideas || typeof ideas !== "object") return [];
  return Object.entries(ideas as Record<string, Json>)
    .sort(([a], [b]) => Number.parseFloat(a) - Number.parseFloat(b))
    .map(([, node]) => node);
}

/** Recursively convert a MindMup node object to a canonical MapNode. */
function toNode(n: Json): MapNode {
  mupId += 1;
  const topic = String(n?.title ?? "").trim();

  const kids = sortedIdeas(n?.ideas);
  const node: MapNode = {
    id: `mup${mupId}`,
    topic,
    children: kids.map(toNode),
  };

  // Notes live at attr.note.text
  const noteText = n?.attr?.note?.text;
  if (typeof noteText === "string" && noteText.trim()) {
    node.note = noteText.trim();
  }

  // Hyperlinks live at attr.link.url
  const linkUrl = n?.attr?.link?.url;
  if (typeof linkUrl === "string" && linkUrl && !isDangerousUrl(linkUrl)) {
    node.hyperlink = linkUrl;
  }

  return node;
}

/**
 * Decode a MindMup `.mup` file (JSON text) into the canonical MindMapDoc model.
 *
 * Signature: `fromMindMup(text: string): MindMapDoc`
 */
export function fromMindMup(text: string): MindMapDoc {
  mupId = 0;

  let data: Json;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(t("io.err.mupBadJson"));
  }

  // The top-level object must look like a MindMup document: it must have at
  // least one of `title`, `ideas`, or `formatVersion`.
  if (
    data === null ||
    typeof data !== "object" ||
    (data.title === undefined && data.ideas === undefined && data.formatVersion === undefined)
  ) {
    throw new Error(t("io.err.mupMissingFields"));
  }

  const root = toNode(data);
  const rawTitle = String(data?.title ?? "").trim();
  const title = rawTitle || "Imported MindMup map";
  root.topic = title;

  return {
    schemaVersion: 1,
    id: `mup${mupId + 1}`,
    title,
    root,
    meta: { source: "mindmup" },
  };
}
