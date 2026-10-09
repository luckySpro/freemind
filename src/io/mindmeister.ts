import { t } from "../i18n/registry";
import "./messages";
import { strFromU8 } from "fflate";
import type { MapNode, MindMapDoc } from "../model/types";
import { isDangerousUrl } from "./urlSafety";
import { unzipOrThrow } from "./zip";

// MindMeister `.mind` importer (import-only).
//
// A `.mind` file is a ZIP archive containing `map.json` (plus optional asset
// files for attached images/videos). The JSON uses `map_version` at the root,
// a `root` node for the central topic, and recursive `children` arrays — confirmed
// against the open-source mindmeister-to-freemind converter
// (https://github.com/p2c2e/mindmeister-to-freemind/blob/master/mind2mm.go) and
// the fileinfo.com format spec. Notes and hyperlinks are not publicly documented;
// we probe the most likely field names and accept both string and object forms so
// the importer degrades gracefully against real files. fflate does the unzip.
//
// NOTE: schema confirmed against community reverse-engineering; not yet validated
// against a real MindMeister-exported .mind file — validate with a real file when
// one is available (same caveat as the .smmx and .mmap importers).

// biome-ignore lint/suspicious/noExplicitAny: tolerant shape from arbitrary MindMeister JSON
type Json = any;

let mmId = 0;

/** Extract a plain-text note from a node, tolerating string or object forms. */
function noteOf(n: Json): string {
  // documented candidates: `note` (string), `notes` (string or object with text/content)
  const raw = n?.note ?? n?.notes;
  if (typeof raw === "string") return raw.trim();
  if (raw && typeof raw === "object") {
    const inner = raw.text ?? raw.content ?? raw["#text"];
    if (typeof inner === "string") return inner.trim();
  }
  return "";
}

/** Extract a hyperlink from a node, tolerating string or { url } object forms. */
function linkOf(n: Json): string {
  // documented candidates: `link` (string), `hyperlink` (string), `url` (string),
  // or any of those as { url } objects (common in REST-style JSON)
  const raw = n?.link ?? n?.hyperlink ?? n?.url;
  if (typeof raw === "string" && raw) return raw;
  if (raw && typeof raw === "object") {
    const url = raw.url ?? raw.href;
    if (typeof url === "string" && url) return url;
  }
  return "";
}

/** Recursively convert a MindMeister node to a canonical MapNode. */
function toNode(n: Json): MapNode {
  mmId += 1;
  // `title` is the documented key; accept `text` as a common fallback
  const topic = String(n?.title ?? n?.text ?? "").trim();
  // `children` is confirmed; `nodes` is a common JSON-API alias
  const kids: Json[] = Array.isArray(n?.children)
    ? n.children
    : Array.isArray(n?.nodes)
      ? n.nodes
      : [];
  const node: MapNode = {
    id: `mm${mmId}`,
    topic,
    children: kids.map(toNode),
  };
  const note = noteOf(n);
  if (note) node.note = note;
  const link = linkOf(n);
  if (link && !isDangerousUrl(link)) node.hyperlink = link;
  return node;
}

/**
 * Decode a MindMeister `.mind` file (ZIP containing `map.json`) into the
 * canonical MindMapDoc model.
 *
 * Signature: `fromMind(bytes: Uint8Array): MindMapDoc`
 */
export function fromMind(bytes: Uint8Array): MindMapDoc {
  mmId = 0;
  const files = unzipOrThrow(bytes, ".mind");
  const mapJson = files["map.json"];
  if (!mapJson) throw new Error(t("io.err.mindNoMapJson"));

  let data: Json;
  try {
    data = JSON.parse(strFromU8(mapJson));
  } catch {
    throw new Error(t("io.err.mindBadJson"));
  }

  // Root node: confirmed key is `root`; fall back through `map.root` and bare
  // `data` (in case a stripped export omits the wrapper object)
  const rootRaw: Json = data?.root ?? data?.map?.root ?? data;
  if (!rootRaw || typeof rootRaw !== "object") {
    throw new Error(t("io.err.mindNoRoot"));
  }

  const root = toNode(rootRaw);
  const rawTitle = String(data?.title ?? data?.name ?? root.topic ?? "").trim();
  const title = rawTitle || "Imported MindMeister map";

  return {
    schemaVersion: 1,
    id: `mm${mmId + 1}`,
    title,
    root,
    meta: { source: "mindmeister" },
  };
}
