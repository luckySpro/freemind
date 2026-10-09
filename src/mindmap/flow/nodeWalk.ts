// Shared tree-walk helper for the canonical model. Several ops repeat the same recursion (e.g.
// collapse/expand to a depth); this centralises the walk — and the depth bookkeeping — in one place.
// Pure; no DOM, no flow-state coupling.

import type { MapNode } from "../../model/types";

/** Depth-first walk of a node and its subtree, passing each node's depth (the start node = `depth`). */
export function walkTree(
  node: MapNode,
  visit: (node: MapNode, depth: number) => void,
  depth = 0,
): void {
  visit(node, depth);
  for (const child of node.children) walkTree(child, visit, depth + 1);
}

/** Count all descendants of a node (the size of the branch beneath it) — drives the delete toast. */
export function countDescendants(n: MapNode): number {
  let total = 0;
  for (const k of n.children) total += 1 + countDescendants(k);
  return total;
}

/** The id of a node and every node beneath it — e.g. a drag-to-reparent can't target its own subtree. */
export function subtreeIds(node: MapNode | null): Set<string> {
  const ids = new Set<string>();
  if (node) walkTree(node, (n) => ids.add(n.id));
  return ids;
}
