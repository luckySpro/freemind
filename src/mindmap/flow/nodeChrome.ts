// Pure visibility rules for a topic node's on-canvas chrome (the hover action bar + the ＋ add
// affordances). Kept out of TopicNode.tsx so the gating is unit-testable and has one source of truth.

/** Whether to show a node's on-node ＋ add buttons: while a pointer hovers it, never while editing.
 *  Selection alone no longer shows them — one click used to stack the action bar, both ＋, the relate
 *  grip, the task box and the edit hint on one topic. A selected topic shows just the action bar
 *  (NodePopover), which also carries Add child / Add sibling on touch. Keyboard: Tab / Enter. */
export function showNodeAffordances(hovered: boolean, isEditing: boolean): boolean {
  return hovered && !isEditing;
}

/** Which edge of the selected node the action bar (NodePopover) aligns to, so it stays on-screen.
 *  Centred by default; a node near the pane's left/right edge would push a centred bar off-screen
 *  (on a phone the 7-button touch bar is ~300px — most of the width), so it anchors to that node's
 *  near edge instead and grows inward. All values are pane-relative screen pixels. */
export function popoverAlign(
  nodeLeft: number,
  nodeRight: number,
  paneWidth: number,
  barWidth: number,
): "start" | "center" | "end" {
  const centre = (nodeLeft + nodeRight) / 2;
  if (centre - barWidth / 2 < 0) return "start";
  if (centre + barWidth / 2 > paneWidth) return "end";
  return "center";
}

/** Upper zoom bound for every whole-map "fit to screen" (mount, the Fit command, Ctrl/⌘+1, re-layout).
 *  Without it a small map fills the pane at the 3× max zoom — the 7-topic Brainstorm template opened
 *  at 300% with house-sized topics. A small map now sits at natural size in the middle instead. */
export const FIT_MAX_ZOOM = 1;

/** Counter-scale for on-canvas node affordances (＋, collapse toggle, relate grip, task box, hints) so
 *  they keep their designed SCREEN size when zoomed IN — at 300% they were tripled and the hint ran off
 *  the pane. Below 100% they shrink with the map as before: counter-scaling there would blow them up
 *  relative to the now-small topics and bury them. Published as the `--mm-aff-scale` CSS variable. */
export function affordanceScale(zoom: number): number {
  return 1 / Math.max(zoom, 1);
}
