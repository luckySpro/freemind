// Big-map virtualisation policy. React Flow can cull off-screen nodes/edges from the DOM
// (`onlyRenderVisibleElements`) so pan/zoom/edit stays fluid on large maps — but on small maps the
// per-frame visibility bookkeeping is pure overhead (and can cause brief pop-in during camera
// animations). So we switch it on only once a map is big enough to benefit. Kept as a pure, tunable
// decision so the threshold is unit-testable and lives in exactly one place.

/** Node count at/above which a map renders only its visible elements. Below this, render everything. */
export const VIRTUALIZE_THRESHOLD = 500;

/** Whether a map of `nodeCount` nodes should virtualise (render only what's in/near the viewport). */
export function shouldVirtualize(nodeCount: number): boolean {
  return nodeCount >= VIRTUALIZE_THRESHOLD;
}
