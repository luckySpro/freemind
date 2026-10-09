import { t } from "../i18n/registry";
// Native, lossless JSON I/O for the canonical model. Unlike Markdown/PNG/SVG
// (lossy or derived), this round-trips the full doc — notes, links, boundaries,
// icons, tags — so a map can be saved and restored exactly. Pure + deterministic.

import { normalizeDoc } from "../model/normalize";
import type { MindMapDoc } from "../model/types";

export function serializeDoc(doc: MindMapDoc): string {
  return JSON.stringify(doc, null, 2);
}

export function parseDoc(text: string): MindMapDoc {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(t("io.err.notValidJson"));
  }
  if (
    !data ||
    typeof data !== "object" ||
    (data as { schemaVersion?: unknown }).schemaVersion !== 1 ||
    typeof (data as { root?: unknown }).root !== "object" ||
    (data as { root?: unknown }).root === null
  ) {
    throw new Error(t("io.err.notStudioJson"));
  }
  // Coerce a hand-edited / schema-drifted file to a projectable shape (real children arrays etc.).
  return normalizeDoc(data as MindMapDoc);
}
