// Vertical placement of the drag-to-relate grip on a topic node's outward edge (right for a
// right-growing branch, left for a left-growing one — both grip and collapse toggle mirror together
// via `tipLeft`, so they always share the SAME edge). The grip normally sits 16px BELOW the node's
// vertical centre, to clear the centred ＋ add-child handle (C4). But when a collapse toggle shares
// that edge — it's anchored bottom:-9 at 18px, so its top sits 9px above the node's bottom — a short
// node has no room for ＋ + grip + toggle, and the grip's rect used to overlap the (always-visible)
// toggle. So when a same-edge toggle is present we clamp the grip to stay a few px above the toggle.
// The ＋ and grip are both hover-only and horizontally offset (13px vs 8px from the edge), so letting
// the grip approach the ＋ on a very short node is the lesser evil; the persistent toggle is the one
// that must stay clear. Pure + constant-shared so a clearance test can mirror the CSS exactly.

export const GRIP_SIZE = 16; // px square (matches the inline width/height)
export const GRIP_BELOW_CENTER = 16; // px the grip drops below centre to clear the ＋
export const TOGGLE_CLEARANCE = 20; // grip top is held to ≤ (100% − this) when a same-edge toggle is present
export const TOGGLE_TOP_FROM_BOTTOM = 9; // the toggle (bottom:-9, 18px) has its top 9px above node bottom

/** The CSS `top` for the grip element (a separate `translateY(-50%)` centres it on this point). */
export function relateGripTopCss(sameEdgeToggle: boolean): string {
  const belowCentre = `calc(50% + ${GRIP_BELOW_CENTER}px)`;
  // On a short node `100% − 20px` wins (grip rides just above the toggle); on a tall one the +16px
  // offset wins (unchanged behaviour). min() resolves per the live node height — no JS measurement.
  return sameEdgeToggle ? `min(${belowCentre}, calc(100% - ${TOGGLE_CLEARANCE}px))` : belowCentre;
}

/** Resolve the grip's [top, bottom] px for a concrete node height — mirrors `relateGripTopCss` for tests. */
export function relateGripRectPx(
  h: number,
  sameEdgeToggle: boolean,
): { top: number; bottom: number } {
  const belowCentre = 0.5 * h + GRIP_BELOW_CENTER;
  const topPoint = sameEdgeToggle ? Math.min(belowCentre, h - TOGGLE_CLEARANCE) : belowCentre;
  const top = topPoint - GRIP_SIZE / 2; // translateY(-50%)
  return { top, bottom: top + GRIP_SIZE };
}

/** The collapse toggle's top edge in px (anchored bottom:-9, height 18 → top at h − 9). */
export function collapseToggleTopPx(h: number): number {
  return h - TOGGLE_TOP_FROM_BOTTOM;
}
