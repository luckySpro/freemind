import type { MindMapDoc } from "../../model/types";
import { type NodeRectLite, isContainer, nodesInside } from "./canvasShapes";
import { type OpResult, setNodePositions, setShapePos } from "./ops";

// The smart-container drag transform (Tier 4 item 22), kept OUT of ops.ts so the shape geometry it needs
// (canvasShapes: nodesInside / isContainer) stays in the lazy canvas chunk rather than being pulled into
// the eager entry bundle. Imported only by the (lazy) FlowMindMap. Pure + unit-tested.

/** Move a shape to (x, y) AND, when it's a smart container, carry every topic it captured — those whose
 *  centre sits inside the container's OLD box — by the same delta, in ONE undo step. A plain (non-
 *  container) shape just moves. `rects` are the live freeform node boxes (from the canvas). */
export function moveShapeAndCapture(
  doc: MindMapDoc,
  id: string,
  x: number,
  y: number,
  rects: NodeRectLite[],
): OpResult {
  const shape = (doc.shapes ?? []).find((s) => s.id === id);
  if (!shape) return { doc };
  const moved = setShapePos(doc, id, x, y).doc;
  if (!isContainer(shape.kind)) return { doc: moved };
  const dx = x - shape.pos.x;
  const dy = y - shape.pos.y;
  const captured = new Set(nodesInside(shape, rects));
  if (captured.size === 0) return { doc: moved };
  const moves = rects
    .filter((r) => captured.has(r.id))
    .map((r) => ({ id: r.id, x: r.x + dx, y: r.y + dy }));
  return setNodePositions(moved, moves);
}
