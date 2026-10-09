import { applyRollups, collectRollupMapIds } from "./mindmap/flow/ops";
import type { MapNode, MindMapDoc } from "./model/types";

// Automated multi-map roll-ups: a node bound to a source map (node.rollup) mirrors that map's
// branches. This refreshes every roll-up in a doc by loading its sources and grafting the latest —
// the automated cousin of cross-map branch paste (which is the manual version).

interface RollupResult {
  doc: MindMapDoc;
  /** How many roll-up nodes were refreshed. */
  count: number;
  /** Source map ids that couldn't be loaded (deleted / missing). */
  missing: string[];
}

/** Refresh every roll-up in `doc`: load each referenced source map via `load`, then graft its
 *  branches under the bound nodes. A source equal to the doc's own id is skipped (no self-pull).
 *  Pure orchestration over a pluggable loader, so it's testable without a store. */
export async function refreshRollups(
  doc: MindMapDoc,
  load: (mapId: string) => Promise<MindMapDoc | null>,
): Promise<RollupResult> {
  const ids = collectRollupMapIds(doc).filter((id) => id !== doc.id);
  if (ids.length === 0) return { doc, count: 0, missing: [] };
  const sources = new Map<string, MapNode[]>();
  const missing: string[] = [];
  for (const id of ids) {
    const src = await load(id).catch(() => null);
    if (src) sources.set(id, src.root.children);
    else missing.push(id);
  }
  const { doc: next, count } = applyRollups(doc, sources);
  return { doc: next, count, missing };
}
