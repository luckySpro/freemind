import { isDangerousUrl } from "../io/urlSafety";
import type { MapAttachment, MapNode, MindMapDoc } from "./types";

// Defensive normalisation for docs entering the app from an UNTRUSTED store — IndexedDB (which can
// hold a partially-written or schema-drifted map) or a hand-edited .json file. The model is a tree the
// projector walks with `node.children.reduce(...)` / `for (… of node.children)`, so a node whose
// `children` is missing or not an array throws and white-screens the whole app — and on the boot path
// that means an unrecoverable blank screen. normalizeDoc coerces every node to a structurally-safe
// shape (string id, string topic, real children array) so a corrupt map renders (salvaged, possibly
// empty) instead of crashing. A well-formed doc passes through value-identical.

function newId(): string {
  const c = globalThis.crypto;
  return c?.randomUUID
    ? c.randomUUID()
    : `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Coerce any value into a structurally-valid MapNode (recursively). Non-object children are dropped. */
function normalizeNode(value: unknown): MapNode {
  const o = (value && typeof value === "object" ? value : {}) as Partial<MapNode> &
    Record<string, unknown>;
  const children = Array.isArray(o.children)
    ? o.children.filter((c) => c && typeof c === "object").map(normalizeNode)
    : [];
  const node = {
    ...o,
    id: typeof o.id === "string" && o.id ? o.id : newId(),
    topic: typeof o.topic === "string" ? o.topic : "",
    children,
  } as MapNode;
  // A stored/hand-edited doc is untrusted (only touched when actually unsafe, so a clean doc passes
  // through value-identical): strip a script-bearing hyperlink, and keep only attachments that are
  // genuine inline `data:` URLs — a `javascript:` "attachment" would execute when its <a> is clicked
  // (the download attribute is ignored for javascript: URLs).
  if (typeof node.hyperlink === "string" && isDangerousUrl(node.hyperlink))
    node.hyperlink = undefined;
  // Additional hyperlinks: keep only non-empty strings with a safe scheme; drop the array entirely
  // when nothing survives, so a clean node stays lossless (no stray empty `hyperlinks: []`).
  if (Array.isArray(node.hyperlinks)) {
    const safe = (node.hyperlinks as unknown[]).filter(
      (u): u is string => typeof u === "string" && u.trim() !== "" && !isDangerousUrl(u),
    );
    if (safe.length !== node.hyperlinks.length)
      node.hyperlinks = safe.length > 0 ? safe : undefined;
  }
  if (Array.isArray(node.attachments)) {
    const safe = (node.attachments as MapAttachment[]).filter(
      (a) =>
        a &&
        typeof a === "object" &&
        typeof a.dataUrl === "string" &&
        a.dataUrl.startsWith("data:"),
    );
    // Drop the array entirely when nothing safe remains, so a sanitised node stays lossless (no stray
    // empty `attachments: []` that a clean node wouldn't carry).
    if (safe.length !== node.attachments.length)
      node.attachments = safe.length > 0 ? safe : undefined;
  }
  return node;
}

/** Make a loaded/parsed doc safe to project: guarantees `root` and every node carry a real children
 *  array (and a string id/topic). A well-formed doc is unchanged in value. Pure (returns a new graph). */
export function normalizeDoc(doc: MindMapDoc): MindMapDoc {
  return {
    ...doc,
    root: normalizeNode(doc.root),
    floatingTopics: Array.isArray(doc.floatingTopics)
      ? doc.floatingTopics.filter((f) => f && typeof f === "object").map(normalizeNode)
      : undefined,
  };
}
