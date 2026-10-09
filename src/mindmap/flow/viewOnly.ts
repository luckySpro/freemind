// View mode (read-only) rules — pure, so the gate FlowMindMap applies is unit-testable. In View mode
// the map can be read, navigated and folded, but not changed: every canvas edit funnels through
// FlowMindMap's `apply` (and undo/redo), which consult these.
import type { MindMapDoc } from "../../model/types";
import type { KeyIntent } from "./keyIntent";

/** Keyboard intents that only read or navigate — the ones View mode still honours. Copying a branch
 *  reads it; everything else in keyIntent edits (or starts an edit). */
const VIEW_INTENTS: ReadonlySet<NonNullable<KeyIntent>["kind"]> = new Set([
  "clearLinking",
  "clearDropTarget",
  "selectDir",
  "openNote",
  "copyBranch",
  "zoomIn",
  "zoomOut",
  "zoomReset",
]);

export function isViewIntent(kind: NonNullable<KeyIntent>["kind"]): boolean {
  return VIEW_INTENTS.has(kind);
}

// JSON replacer that drops the fold state — the one doc field View mode may change.
const withoutFolds = (key: string, value: unknown) => (key === "collapsed" ? undefined : value);

/** True when `next` differs from `prev` only in which branches are collapsed. Folding is how you read a
 *  big map, so View mode allows it (it's saved with the map, like any fold); anything else is an edit.
 *  Serialises both docs, so call it only on a blocked-or-allowed decision in View mode, not per render. */
export function onlyFoldsChanged(prev: MindMapDoc, next: MindMapDoc): boolean {
  if (prev === next) return true;
  return JSON.stringify(prev, withoutFolds) === JSON.stringify(next, withoutFolds);
}
