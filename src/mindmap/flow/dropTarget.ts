import { dropWhereInBox } from "../../outline";
import type { RfNodeRect } from "./floating";

// Pure resolver for the canvas drag-reorder (#8): given the live node rects + where a topic was
// dragged, return which node it would drop on and WHERE within it (before/child/after). Kept out of
// FlowMindMap so the hit-test + band decision are unit-tested; the component is a thin wrapper.

export interface DropTarget {
  id: string;
  where: "before" | "child" | "after";
}

/** The drop target for a topic dragged to `dropPos` (its top-left): the first non-excluded node whose
 *  box contains the dragged node's centre, plus the band (before/child/after) the centre falls in.
 *  `excludeIds` is the dragged node + its subtree (you can't drop onto your own descendants). Pure. */
export function resolveDropTarget(
  nodes: readonly RfNodeRect[],
  draggedId: string,
  excludeIds: ReadonlySet<string>,
  dropPos: { x: number; y: number },
  rootId: string,
): DropTarget | null {
  const dragged = nodes.find((n) => n.id === draggedId);
  const cx = dropPos.x + (dragged?.measured?.width ?? 0) / 2;
  const cy = dropPos.y + (dragged?.measured?.height ?? 0) / 2;
  const hit = nodes.find((n) => {
    if (excludeIds.has(n.id)) return false;
    const w = n.measured?.width ?? 0;
    const h = n.measured?.height ?? 0;
    return (
      cx >= n.position.x && cx <= n.position.x + w && cy >= n.position.y && cy <= n.position.y + h
    );
  });
  if (!hit) return null;
  return {
    id: hit.id,
    where: dropWhereInBox(cy, hit.position.y, hit.measured?.height ?? 0, hit.id === rootId),
  };
}
