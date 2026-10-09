import type { InternalNode } from "@xyflow/react";
import type { BranchGrowth } from "../../model/types";
import type { LayoutKind } from "../contract";

// Floating-edge geometry: connect a node's border to another's, on the ray between their
// centres — so edges route correctly in ANY layout (side, org-chart, radial, fishbone, …)
// without per-layout handles. The rect-based core (`floatingPoints`) is pure, so the SVG
// exporter reuses the exact same geometry as the live canvas (canvas == export).

export interface Box {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export interface FloatingPoints {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
}

/** The point on box `a`'s border along the ray toward box `b`'s centre. */
function borderPoint(a: Box, b: Box): { x: number; y: number } {
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  if (dx === 0 && dy === 0) return { x: a.cx, y: a.cy };
  const w2 = a.w / 2 || 1;
  const h2 = a.h / 2 || 1;
  const scale = Math.min(w2 / (Math.abs(dx) || 1e-6), h2 / (Math.abs(dy) || 1e-6));
  return { x: a.cx + dx * scale, y: a.cy + dy * scale };
}

/** Border-to-border connection points between two boxes. Pure. */
export function floatingPoints(s: Box, t: Box): FloatingPoints {
  const a = borderPoint(s, t);
  const b = borderPoint(t, s);
  return { sx: a.x, sy: a.y, tx: b.x, ty: b.y };
}

export function nodeBox(node: InternalNode): Box {
  const w = node.measured?.width ?? 0;
  const h = node.measured?.height ?? 0;
  const x = node.internals.positionAbsolute.x;
  const y = node.internals.positionAbsolute.y;
  return { cx: x + w / 2, cy: y + h / 2, w, h };
}

export function getFloatingPoints(source: InternalNode, target: InternalNode): FloatingPoints {
  return floatingPoints(nodeBox(source), nodeBox(target));
}

// ── Organic branch connectors (the MindManager "trunk that fans" look) ───────────────────────────
// A parent's child branches all spring from ONE point on the side its children sit, leave straight
// out (so the fan never crosses), enter each child at its near end, overlap both boxes (always touch),
// and taper from a chunky trunk to a fine tip. All pure → the live canvas (BranchEdge) and the SVG
// exporter share this exact geometry (canvas == export).

export type AttachSide = "left" | "right" | "top" | "bottom";

/** Which axis a parent's children predominantly spread along. Picked per parent so every sibling
 *  resolves to a consistent side (one shared origin per side → no crossed fan); a two-sided centre
 *  topic naturally splits into a left group and a right group. */
export function childrenAxis(parent: Box, children: Box[]): "h" | "v" {
  let sx = 0;
  let sy = 0;
  for (const c of children) {
    sx += Math.abs(c.cx - parent.cx);
    sy += Math.abs(c.cy - parent.cy);
  }
  return sx >= sy ? "h" : "v";
}

/** The fan axis dictated by the layout's ORIENTATION: horizontal layouts attach children on a
 *  left/right side, vertical (org-chart) layouts on top/bottom. Other layouts (radial / timeline /
 *  fishbone / grid / brace / freeform) return undefined → the axis is inferred per parent from the
 *  children's spread (the original behaviour). Forcing the axis by orientation stops a parent whose
 *  children carry tall subtrees from being mis-read as vertical — which made a child in a horizontal
 *  map attach top/bottom and enter "from below" instead of from the parent-facing side. */
export function axisForLayoutKind(kind: LayoutKind): "h" | "v" | undefined {
  if (kind === "side" || kind === "left" || kind === "right") return "h";
  if (kind === "org-down" || kind === "org-up") return "v";
  return undefined;
}

/** Each parent's dominant child-axis ("h"/"v"), keyed by parent id — group the non-crosslink edges
 *  by source and run childrenAxis over the children's boxes. Shared by the live canvas (FlowMindMap's
 *  sync) and the SVG exporter so both pick the SAME branch attach sides (canvas == export). `rectOf`
 *  maps a node id to its box (undefined if unknown). `axisHint` (from `axisForLayoutKind`) forces the
 *  axis for every parent when the layout has a fixed orientation; absent → infer per parent. Pure. */
export function computeAxisByParent(
  edges: readonly { source: string; target: string; data?: { crosslink?: boolean } | null }[],
  rectOf: (id: string) => Box | null | undefined,
  axisHint?: "h" | "v",
): Map<string, "h" | "v"> {
  const kids = new Map<string, Box[]>();
  for (const e of edges) {
    if (e.data?.crosslink) continue;
    const cb = rectOf(e.target);
    if (!cb) continue;
    const a = kids.get(e.source);
    if (a) a.push(cb);
    else kids.set(e.source, [cb]);
  }
  const out = new Map<string, "h" | "v">();
  for (const [pid, cbs] of kids) {
    const pb = rectOf(pid);
    if (pb) out.set(pid, axisHint ?? childrenAxis(pb, cbs));
  }
  return out;
}

/** The side of the parent a child sits on, along the parent's dominant axis. */
export function attachSideFor(parent: Box, child: Box, axis: "h" | "v"): AttachSide {
  if (axis === "h") return child.cx >= parent.cx ? "right" : "left";
  return child.cy >= parent.cy ? "bottom" : "top";
}

/** Map-wide branch line-weight multiplier ("growth"): "regular" (or absent) keeps the historical
 *  widths, "fine" thins, "bold" thickens. One source of truth for the canvas + SVG export. Tamed from
 *  the original 0.6/1.6 so bold stays distinct without the trunk ballooning into a blob. */
export function branchGrowthFactor(growth?: BranchGrowth): number {
  return growth === "fine" ? 0.72 : growth === "bold" ? 1.3 : 1;
}

/** Trunk-only shrink when many children fan from ONE shared origin: their wide bases overlap into a
 *  merged "blob" at the parent, worse the more siblings there are. Thin the trunk past 3 siblings
 *  (down to 0.7×) so the fan stays legible; tips (at each child) are untouched. ≤3 children → 1× (no
 *  change for ordinary maps). Pure. */
export function fanTrunkFactor(fanCount?: number): number {
  const n = fanCount ?? 0;
  if (n <= 3) return 1;
  return Math.max(0.7, 1 - (n - 3) * 0.08);
}

/** Chunky-trunk → fine-tip half-widths by the child's depth (MindManager weight: mains thick, subs
 *  progressively thinner), scaled by the map's branch-growth weight. `fanCount` (the parent's child
 *  count) thins the trunk for dense fans so the shared origin doesn't blob. */
export function branchWidths(
  depth: number,
  growth?: BranchGrowth,
  fanCount?: number,
): { trunk: number; tip: number } {
  const f = branchGrowthFactor(growth);
  return {
    trunk: Math.max(7.5 - depth * 1.2, 3) * f * fanTrunkFactor(fanCount),
    tip: Math.max(2.4 - depth * 0.3, 0.9) * f,
  };
}

/** The single origin on the parent's `side` + the child's near-end entry, both tucked INTO the boxes
 *  (by `overlap`) so the branch always touches and the chunky bases merge into one trunk. The child
 *  entry slides toward the origin's level ("enter from the near end"): the top child connects at its
 *  lower end, the bottom child at its upper end, a level child at its mid. */
export function branchEndpoints(
  parent: Box,
  child: Box,
  side: AttachSide,
  overlap = 7,
  endInset = 9,
): FloatingPoints {
  const ov = Math.min(overlap, parent.w / 2, parent.h / 2, child.w / 2, child.h / 2);
  const pl = parent.cx - parent.w / 2;
  const pr = parent.cx + parent.w / 2;
  const pt = parent.cy - parent.h / 2;
  const pb = parent.cy + parent.h / 2;
  const cl = child.cx - child.w / 2;
  const cr = child.cx + child.w / 2;
  const ct = child.cy - child.h / 2;
  const cb = child.cy + child.h / 2;
  // Clamp the entry to the child's near edge, leaving a small inset so it lands on the rounded end.
  const slide = (lo: number, hi: number, v: number): number => {
    const pad = Math.min(endInset, (hi - lo) / 2);
    return Math.max(lo + pad, Math.min(hi - pad, v));
  };
  if (side === "right")
    return { sx: pr - ov, sy: parent.cy, tx: cl + ov, ty: slide(ct, cb, parent.cy) };
  if (side === "left")
    return { sx: pl + ov, sy: parent.cy, tx: cr - ov, ty: slide(ct, cb, parent.cy) };
  if (side === "bottom")
    return { sx: parent.cx, sy: pb - ov, tx: slide(cl, cr, parent.cx), ty: ct + ov };
  return { sx: parent.cx, sy: pt + ov, tx: slide(cl, cr, parent.cx), ty: cb - ov };
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

/** Filled tapered-ribbon path: leaves the origin straight out along `side` (so a single-origin fan
 *  stays monotonic — never crosses), eases into the child's near edge, and tapers trunk→tip with the
 *  width offset ⟂ the LOCAL tangent (even ribbon, trunk aligned to the branch). Pure. */
export function taperedRibbonPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  side: AttachSide,
  trunkHW: number,
  tipHW: number,
  bow = 0,
): string {
  const horizontal = side === "left" || side === "right";
  const dx = tx - sx;
  const dy = ty - sy;
  // Chord normal (also the degenerate-tangent fallback below).
  const chordLen = Math.hypot(dx, dy) || 1;
  const cnx = -dy / chordLen;
  const cny = dx / chordLen;
  // Straight-out departure along the side; ease in along the child's near-edge normal — plus an
  // optional perpendicular `bow` that arcs the WHOLE curve aside to route around an intervening box
  // (bow === 0 → byte-identical to the un-bowed ribbon, so branches with a clear path don't move).
  const c1x = (horizontal ? sx + dx * 0.5 : sx) + cnx * bow;
  const c1y = (horizontal ? sy : sy + dy * 0.5) + cny * bow;
  const c2x = (horizontal ? tx - dx * 0.5 : tx) + cnx * bow;
  const c2y = (horizontal ? ty : ty - dy * 0.5) + cny * bow;
  // Offset perpendicular to the local tangent at each end, not the chord — even taper. When an end
  // segment is degenerate (axis-aligned overlap: dx===0 on a horizontal side, dy===0 on a vertical
  // one → zero-length tangent), fall back to the CHORD normal so the ribbon keeps its width instead
  // of collapsing to a zero-area, invisible path.
  const sl = Math.hypot(c1x - sx, c1y - sy);
  const spx = sl < 1e-6 ? cnx : -(c1y - sy) / sl;
  const spy = sl < 1e-6 ? cny : (c1x - sx) / sl;
  const tl = Math.hypot(tx - c2x, ty - c2y);
  const tpx = tl < 1e-6 ? cnx : -(ty - c2y) / tl;
  const tpy = tl < 1e-6 ? cny : (tx - c2x) / tl;
  return [
    `M ${r2(sx + spx * trunkHW)} ${r2(sy + spy * trunkHW)}`,
    `C ${r2(c1x + spx * trunkHW)} ${r2(c1y + spy * trunkHW)} ${r2(c2x + tpx * tipHW)} ${r2(c2y + tpy * tipHW)} ${r2(tx + tpx * tipHW)} ${r2(ty + tpy * tipHW)}`,
    `L ${r2(tx - tpx * tipHW)} ${r2(ty - tpy * tipHW)}`,
    `C ${r2(c2x - tpx * tipHW)} ${r2(c2y - tpy * tipHW)} ${r2(c1x - spx * trunkHW)} ${r2(c1y - spy * trunkHW)} ${r2(sx - spx * trunkHW)} ${r2(sy - spy * trunkHW)}`,
    "Z",
  ].join(" ");
}

/** The relationship (cross-link) curve: a cubic that bows along the X axis, with both control points
 *  pinned to the horizontal midpoint. Shared by the live canvas edge (BranchEdge's sibling
 *  CrosslinkEdge) AND the SVG exporter so a relationship bows the SAME way on screen and in every
 *  export — canvas == export. Without this the canvas used React Flow's default bottom/top handles
 *  (a vertical bow) while the exporter drew this horizontal S, so the two disagreed. The label sits at
 *  the curve's geometric midpoint. */
export function crosslinkBezier(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  curve?: number,
): { path: string; labelX: number; labelY: number } {
  // Bow PERPENDICULAR to the chord (not a fixed axis), so the arc leaves/enters each end smoothly
  // instead of looking pinned. `curve` is the signed perpendicular offset of the arc's midpoint (a
  // draggable handle / the inspector sets it); absent = a gentle auto-bow proportional to the span.
  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len; // unit perpendicular (left of the chord)
  const ny = dx / len;
  const bow = curve ?? len * 0.14;
  const c1x = sx + dx / 3 + nx * bow;
  const c1y = sy + dy / 3 + ny * bow;
  const c2x = tx - dx / 3 + nx * bow;
  const c2y = ty - dy / 3 + ny * bow;
  const path = `M ${r2(sx)} ${r2(sy)} C ${r2(c1x)} ${r2(c1y)} ${r2(c2x)} ${r2(c2y)} ${r2(tx)} ${r2(ty)}`;
  // Label at the cubic's midpoint (t=0.5).
  const labelX = (sx + 3 * c1x + 3 * c2x + tx) / 8;
  const labelY = (sy + 3 * c1y + 3 * c2y + ty) / 8;
  return { path, labelX, labelY };
}

/** A React-Flow node reduced to what hit-testing needs: its top-left position + measured size. */
export interface RfNodeRect {
  id: string;
  position: { x: number; y: number };
  measured?: { width?: number; height?: number };
}

/** The id of the topmost node whose box contains the flow-space point (x,y), or null. Later nodes in
 *  the array paint on top, so the scan runs back-to-front. Pure — drives the drag-a-file-onto-a-topic
 *  drop hit-test. */
export function nodeAtPoint(nodes: RfNodeRect[], x: number, y: number): string | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    const w = n.measured?.width ?? 0;
    const h = n.measured?.height ?? 0;
    if (x >= n.position.x && x <= n.position.x + w && y >= n.position.y && y <= n.position.y + h)
      return n.id;
  }
  return null;
}

/** Invert crosslinkBezier's midpoint geometry: given where the user dragged the midpoint handle
 *  (px,py), return the signed `curve` (perpendicular bow) that puts the arc's midpoint there. The
 *  midpoint sits at chordMid + 0.75·curve·n (n = unit perpendicular), so curve = perp / 0.75. Only the
 *  perpendicular component of the drag matters; movement along the chord is ignored. Pure. */
export function curveFromHandle(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  px: number,
  py: number,
): number {
  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const perp = (px - (sx + tx) / 2) * nx + (py - (sy + ty) / 2) * ny;
  return perp / 0.75;
}

/** Right-angle "org-chart" connector: a uniform-width path from the parent's near-edge CENTRE to the
 *  child's near-edge centre via a shared mid bus (a vertical bus for top/bottom, horizontal for
 *  left/right) with small rounded corners. Org-down/org-up layouts use this instead of the organic
 *  taper, which reads wrong for a formal hierarchy. Siblings share the parent-edge point and the bus
 *  level, so they form the classic org "T". Pure → canvas (BranchEdge) and exporter share it. */
export function elbowPath(parent: Box, child: Box, side: AttachSide): string {
  const pl = parent.cx - parent.w / 2;
  const pr = parent.cx + parent.w / 2;
  const pt = parent.cy - parent.h / 2;
  const pb = parent.cy + parent.h / 2;
  const cl = child.cx - child.w / 2;
  const cr = child.cx + child.w / 2;
  const ct = child.cy - child.h / 2;
  const cb = child.cy + child.h / 2;
  // Endpoints on the facing edge centres (the org-chart "drop from the bottom-centre").
  const sx = side === "left" ? pl : side === "right" ? pr : parent.cx;
  const sy = side === "top" ? pt : side === "bottom" ? pb : parent.cy;
  const tx = side === "left" ? cr : side === "right" ? cl : child.cx;
  const ty = side === "top" ? cb : side === "bottom" ? ct : child.cy;
  if (side === "top" || side === "bottom") {
    const my = (sy + ty) / 2;
    const hx = Math.sign(tx - sx) || 1;
    const vy = Math.sign(my - sy) || 1;
    const r = Math.max(0, Math.min(6, Math.abs(tx - sx) / 2, Math.abs(my - sy), Math.abs(ty - my)));
    if (r < 0.5)
      return `M ${r2(sx)} ${r2(sy)} L ${r2(sx)} ${r2(my)} L ${r2(tx)} ${r2(my)} L ${r2(tx)} ${r2(ty)}`;
    return [
      `M ${r2(sx)} ${r2(sy)}`,
      `L ${r2(sx)} ${r2(my - vy * r)}`,
      `Q ${r2(sx)} ${r2(my)} ${r2(sx + hx * r)} ${r2(my)}`,
      `L ${r2(tx - hx * r)} ${r2(my)}`,
      `Q ${r2(tx)} ${r2(my)} ${r2(tx)} ${r2(my + vy * r)}`,
      `L ${r2(tx)} ${r2(ty)}`,
    ].join(" ");
  }
  // Horizontal bus (left/right) — kept general though org layouts use the vertical case above.
  const mx = (sx + tx) / 2;
  const vy = Math.sign(ty - sy) || 1;
  const hx = Math.sign(mx - sx) || 1;
  const r = Math.max(0, Math.min(6, Math.abs(ty - sy) / 2, Math.abs(mx - sx), Math.abs(tx - mx)));
  if (r < 0.5)
    return `M ${r2(sx)} ${r2(sy)} L ${r2(mx)} ${r2(sy)} L ${r2(mx)} ${r2(ty)} L ${r2(tx)} ${r2(ty)}`;
  return [
    `M ${r2(sx)} ${r2(sy)}`,
    `L ${r2(mx - hx * r)} ${r2(sy)}`,
    `Q ${r2(mx)} ${r2(sy)} ${r2(mx)} ${r2(sy + vy * r)}`,
    `L ${r2(mx)} ${r2(ty - vy * r)}`,
    `Q ${r2(mx)} ${r2(ty)} ${r2(mx + hx * r)} ${r2(ty)}`,
    `L ${r2(tx)} ${r2(ty)}`,
  ].join(" ");
}

// ── Selectable connector styles ───────────────────────────────────────────────────────────────────
// The per-map connector style (MindManager's Line Style picker). "organic" is the adaptive default
// (chunky taper, or an org-chart elbow on org layouts); the rest force one shape everywhere.
export type ConnectorStyle = "organic" | "curved" | "elbow" | "straight";

/** Parent's near-edge centre + child's near-edge centre, on the parent's attach `side` — the endpoints
 *  for the uniform-stroke connector styles (straight / curved / elbow). */
export function sideEndpoints(parent: Box, child: Box, side: AttachSide): FloatingPoints {
  const sx =
    side === "left"
      ? parent.cx - parent.w / 2
      : side === "right"
        ? parent.cx + parent.w / 2
        : parent.cx;
  const sy =
    side === "top"
      ? parent.cy - parent.h / 2
      : side === "bottom"
        ? parent.cy + parent.h / 2
        : parent.cy;
  const tx =
    side === "left" ? child.cx + child.w / 2 : side === "right" ? child.cx - child.w / 2 : child.cx;
  const ty =
    side === "top" ? child.cy + child.h / 2 : side === "bottom" ? child.cy - child.h / 2 : child.cy;
  return { sx, sy, tx, ty };
}

/** A straight (direct) connector: one uniform line from the parent's edge to the child's near edge. */
export function straightPath(parent: Box, child: Box, side: AttachSide): string {
  const { sx, sy, tx, ty } = sideEndpoints(parent, child, side);
  return `M ${r2(sx)} ${r2(sy)} L ${r2(tx)} ${r2(ty)}`;
}

/** A smooth uniform curved connector: leaves the parent perpendicular to its `side` and eases into the
 *  child's near edge. */
export function curvedPath(parent: Box, child: Box, side: AttachSide): string {
  const { sx, sy, tx, ty } = sideEndpoints(parent, child, side);
  const horizontal = side === "left" || side === "right";
  const c1x = horizontal ? (sx + tx) / 2 : sx;
  const c1y = horizontal ? sy : (sy + ty) / 2;
  const c2x = horizontal ? (sx + tx) / 2 : tx;
  const c2y = horizontal ? ty : (sy + ty) / 2;
  return `M ${r2(sx)} ${r2(sy)} C ${r2(c1x)} ${r2(c1y)} ${r2(c2x)} ${r2(c2y)} ${r2(tx)} ${r2(ty)}`;
}

export interface BranchRender {
  /** SVG path `d`. */
  d: string;
  /** Set for the filled organic ribbon; null when the branch is a uniform stroke. */
  fill: string | null;
  /** Set for the uniform-stroke styles (elbow / straight / curved / dashed); null for the ribbon. */
  stroke: string | null;
  width: number;
  /** SVG stroke-dasharray ("" = solid). */
  dash: string;
}

/** The perpendicular `bow` (signed offset of the tapered ribbon's control points) that routes a branch
 *  AROUND any node box (`others`, minus the two endpoint nodes `srcId`/`tgtId`) its straight path would
 *  otherwise pass behind. Returns 0 when the path is already clear (so a clear branch is byte-identical
 *  to before) AND when no displacement up to `maxBow` clears it — i.e. it NEVER returns a bow that still
 *  crosses a box: a branch is either fully cleared or left straight. Tries BOTH perpendicular directions
 *  and keeps the smallest |bow| that clears every nearby box. Pure → the canvas (sync stashes it on
 *  `data.attachBow`) and the SVG exporter both call it with the same boxes, so canvas == export. Only
 *  the tapered ribbon honours it. */
export function bowToClear(
  parent: Box,
  child: Box,
  side: AttachSide,
  others: readonly { id: string; box: Box }[],
  srcId: string,
  tgtId: string,
  margin = 8,
): number {
  if (others.length === 0) return 0;
  const { sx, sy, tx, ty } = branchEndpoints(parent, child, side);
  const horizontal = side === "left" || side === "right";
  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.hypot(dx, dy) || 1;
  const cnx = -dy / len;
  const cny = dx / len;
  const b1x = horizontal ? sx + dx * 0.5 : sx;
  const b1y = horizontal ? sy : sy + dy * 0.5;
  const b2x = horizontal ? tx - dx * 0.5 : tx;
  const b2y = horizontal ? ty : ty - dy * 0.5;
  // Cap the displacement so a bow can't fling wildly, but leave enough room to actually clear a box
  // wider than the branch is long (a short branch passing a big sibling needs a bow > its own length).
  const maxBow = Math.min(Math.max(len * 1.5, 180), 360);
  // Sample the centerline finely enough (~4px spacing, scaled to the bowed curve's length) that a short
  // obstacle box can't slip BETWEEN two samples — a coarse sampler would judge such a box cleared and
  // accept a bow whose true centerline still crosses it (the displaced-and-still-crossing failure).
  const samples = Math.min(Math.max(Math.ceil((len + maxBow) / 4), 120), 400);
  // Boxes (minus the endpoint nodes) overlapping the chord's bbox inflated by `pad`. The un-bowed cubic
  // stays inside the chord bbox, so band(margin) is all that can block a straight branch; a bowed branch
  // sweeps up to ~maxBow perpendicular, so band(maxBow+margin) is everything any bow ≤ maxBow can hit.
  const band = (pad: number): Box[] => {
    const loX = Math.min(sx, tx) - pad;
    const hiX = Math.max(sx, tx) + pad;
    const loY = Math.min(sy, ty) - pad;
    const hiY = Math.max(sy, ty) + pad;
    const out: Box[] = [];
    for (const o of others) {
      if (o.id === srcId || o.id === tgtId) continue;
      const b = o.box;
      if (
        b.cx + b.w / 2 >= loX &&
        b.cx - b.w / 2 <= hiX &&
        b.cy + b.h / 2 >= loY &&
        b.cy - b.h / 2 <= hiY
      )
        out.push(b);
    }
    return out;
  };
  // Deepest penetration of the bowed centerline into ANY box in `boxes` (>0 = inside box+margin).
  const deepest = (bow: number, boxes: readonly Box[]): number => {
    const c1x = b1x + cnx * bow;
    const c1y = b1y + cny * bow;
    const c2x = b2x + cnx * bow;
    const c2y = b2y + cny * bow;
    let pen = Number.NEGATIVE_INFINITY;
    for (const b of boxes) {
      // Sample t ∈ [0, 1] INCLUSIVE — the endpoints (t=0/1) matter: a box sitting on a fixed branch
      // endpoint can't be cleared by any bow (the cubic always passes through it), so it must be seen
      // and the branch left straight rather than displaced with the endpoint still inside the box.
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const u = 1 - t;
        const px = u * u * u * sx + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * tx;
        const py = u * u * u * sy + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ty;
        const p = Math.min(
          b.w / 2 + margin - Math.abs(px - b.cx),
          b.h / 2 + margin - Math.abs(py - b.cy),
        );
        if (p > pen) pen = p;
      }
    }
    return pen;
  };
  // Fast path (the common case — a clear branch): only the tight band can block the straight cubic, and
  // if nothing there is penetrated the branch is already clear, so skip the wider scan entirely.
  const tight = band(margin);
  if (tight.length === 0 || deepest(0, tight) <= 0) return 0;
  // It grazes → search BOTH perpendicular directions over the full swept region for the smallest |bow|
  // that clears every box; keep the smaller. If neither direction clears within maxBow (boxes straddling
  // the chord, or a box over an endpoint), return 0 — leave the branch straight rather than displace it
  // into something it still overlaps.
  const wide = band(maxBow + margin);
  const step = Math.max(4, margin);
  let best = 0;
  let bestAbs = Number.POSITIVE_INFINITY;
  for (const dir of [-1, 1] as const) {
    for (let bow = dir * step; Math.abs(bow) <= maxBow; bow += dir * step) {
      if (deepest(bow, wide) <= 0) {
        if (Math.abs(bow) < bestAbs) {
          bestAbs = Math.abs(bow);
          best = bow;
        }
        break;
      }
    }
  }
  return best;
}

/** Resolve a branch edge to its path + paint, honouring the map's connector style + a per-branch dash.
 *  ONE shared decision so the live canvas (BranchEdge) and the SVG exporter render identically
 *  (canvas == export). `attachSide` is the per-parent fan side; `elbow` marks an org-chart branch
 *  (used only for the adaptive "organic" style). A dashed branch can't be a filled ribbon, so it
 *  falls back to a uniform stroked curve. `bow` arcs the tapered ribbon around an intervening box
 *  (from `bowToClear`; 0 = straight, the default — only the tapered ribbon honours it). */
export function branchRender(
  parent: Box,
  child: Box,
  attachSide: AttachSide,
  data: {
    depth?: number;
    branchColor?: string;
    elbow?: boolean;
    connectorStyle?: ConnectorStyle;
    dash?: "solid" | "dashed" | "dotted";
    branchGrowth?: BranchGrowth;
    fanCount?: number;
  },
  bow = 0,
): BranchRender {
  const color = data.branchColor ?? "#999";
  const dashArr = data.dash === "dashed" ? "6 4" : data.dash === "dotted" ? "2 4" : "";
  const cs = data.connectorStyle ?? "organic";
  const effective = cs === "organic" ? (data.elbow ? "elbow" : "taper") : cs;
  if (effective === "taper" && !dashArr) {
    const ep = branchEndpoints(parent, child, attachSide);
    const { trunk, tip } = branchWidths(data.depth ?? 1, data.branchGrowth, data.fanCount);
    return {
      d: taperedRibbonPath(ep.sx, ep.sy, ep.tx, ep.ty, attachSide, trunk, tip, bow),
      fill: color,
      stroke: null,
      width: 0,
      dash: "",
    };
  }
  const elbowSide: AttachSide = data.elbow
    ? child.cy >= parent.cy
      ? "bottom"
      : "top"
    : attachSide;
  const d =
    effective === "elbow"
      ? elbowPath(parent, child, elbowSide)
      : effective === "straight"
        ? straightPath(parent, child, attachSide)
        : curvedPath(parent, child, attachSide); // "curved", or a dashed taper
  const width =
    Math.max(1.6, 3.4 - (data.depth ?? 1) * 0.5) * branchGrowthFactor(data.branchGrowth);
  return { d, fill: null, stroke: color, width, dash: dashArr };
}

/** Whether a branch renders as the organic tapered ribbon — the ONLY style that honours `bow`. Mirrors
 *  branchRender's `effective === "taper" && !dashArr`, so callers skip the obstacle-bow computation for
 *  elbow/straight/curved/dashed branches (where the bow would be discarded). One source of truth. */
export function isTaperBranch(data: {
  elbow?: boolean;
  connectorStyle?: ConnectorStyle;
  dash?: "solid" | "dashed" | "dotted";
}): boolean {
  const cs = data.connectorStyle ?? "organic";
  return cs === "organic" && !data.elbow && data.dash !== "dashed" && data.dash !== "dotted";
}
