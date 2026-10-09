import { nodePath } from "./mindmap/flow/ops";
import type { MapNode, MindMapDoc } from "./model/types";
import { noteCounts } from "./noteFormat";
import { outlineNumbers } from "./outline";
import { countWords } from "./stats";
import { timeAgo } from "./ui";

// Pure derivations behind the inspector header: the ancestor breadcrumb, the quick-facts line (outline
// number · depth · child count · note size · reading time) and the created/modified times line, plus
// the canvas breadcrumb trail. Lifted out of App so this formatting logic is unit-testable on its own
// (App just memoises calls to these). `now` is injectable so the time-ago strings are deterministic.

export interface SelectionInfo {
  /** Ancestor path "Root › Branch" (empty when nothing below the root is selected). */
  breadcrumb: string;
  /** Quick facts line: "#1.2 · depth 2 · 3 children · note 40w · 120c · ~1 min read". */
  facts: string;
  /** Created / modified line via relative time (empty when the node carries no timestamps). */
  times: string;
}

export function selectionInfo(
  doc: MindMapDoc,
  node: MapNode | null,
  id: string | null,
  now?: number,
): SelectionInfo {
  if (!node || !id) return { breadcrumb: "", facts: "", times: "" };
  const path = nodePath(doc, id);
  const breadcrumb = (path?.ancestors ?? []).map((a) => a.topic || "(untitled)").join(" › ");
  const outlineNo = outlineNumbers(doc.root, doc.meta?.numberStyle).get(id);
  const counts = noteCounts(node.note ?? "");
  const kids = node.children.length;
  // Reading load of this topic (its title + note) — words ÷ 200 wpm, surfaced only when non-trivial.
  const topicWords = countWords(node.topic) + counts.words;
  const facts = [
    outlineNo ? `#${outlineNo}` : null,
    `depth ${path?.depth ?? 0}`,
    `${kids} ${kids === 1 ? "child" : "children"}`,
    counts.chars ? `note ${counts.words}w · ${counts.chars}c` : null,
    topicWords >= 50 ? `~${Math.ceil(topicWords / 200)} min read` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const times = [
    node.createdAt ? `created ${timeAgo(node.createdAt, now)}` : null,
    node.modifiedAt ? `modified ${timeAgo(node.modifiedAt, now)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return { breadcrumb, facts, times };
}

/** The canvas breadcrumb trail: root → ancestors → selected, as `{ id, topic }` crumbs. Empty unless
 *  something below the root is selected. */
export function selectionCrumbs(
  doc: MindMapDoc,
  node: MapNode | null,
  id: string | null,
): { id: string; topic: string }[] {
  if (!node || !id) return [];
  const path = nodePath(doc, id);
  if (!path) return [];
  return [...path.ancestors, node].map((n) => ({ id: n.id, topic: n.topic }));
}
