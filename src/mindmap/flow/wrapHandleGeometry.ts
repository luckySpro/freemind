// Geometry for the on-canvas wrap-width resize grip (10b Layer 2). The grip sits on a node's RIGHT
// edge, but that edge is contested: the add-child ＋ and the relate grip both sit at the vertical
// centre (top:50%), and the collapse toggle at the bottom-right corner. So the grip is TOP-anchored and
// only shown when the node is tall enough that its bar clears the centred ＋/relate cluster — the
// "clearance" the feature is gated on (see NEXT_STEPS 10b). Pure + unit-tested so the placement and the
// fits() rule can't silently drift into overlapping the other affordances. The inspector Wrap slider
// works on ANY topic; this grip is the direct-manipulation shortcut on taller nodes.

/** Bar offset from the node's top edge (px). */
export const WRAP_HANDLE_TOP = 4;
/** Bar height (px). */
export const WRAP_HANDLE_H = 18;
/** Bar width (px). */
export const WRAP_HANDLE_W = 6;

// The add-child ＋ / relate grip are vertically centred (top:50%); a 24px target → ±12px around centre.
const CENTRE_CLUSTER_HALF = 12;
// Minimum gap the bar's bottom must keep from the cluster's top so the two never touch.
const CLEARANCE = 2;

/** Smallest node height (px) at which the grip clears the centre cluster and is shown. Derived from the
 *  constants above so the render gate and the clearance test share one source of truth. */
export const WRAP_HANDLE_MIN_NODE_H =
  2 * (CENTRE_CLUSTER_HALF + CLEARANCE + WRAP_HANDLE_TOP + WRAP_HANDLE_H); // = 72

/** True when a node of `nodeHeight` px has room for the top-anchored wrap grip WITHOUT its bar
 *  overlapping the centred ＋/relate cluster. Below this the grip is hidden and the inspector Wrap
 *  slider (which works on any topic) is the only wrap control. */
export function wrapHandleFits(nodeHeight: number): boolean {
  return nodeHeight >= WRAP_HANDLE_MIN_NODE_H;
}
