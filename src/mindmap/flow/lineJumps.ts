import { r2 } from "./geometry";

// Line-jumps ("hops"): where two RELATIONSHIP lines cross, draw a small semicircular bump on
// exactly ONE of them so the crossing reads as "passes over", not "joins" (the MindManager
// convention). This is the single source of truth for the geometry — used by BOTH the live
// canvas relationship edge (CrosslinkEdge) AND the SVG exporter (exportSvg.ts), so the same
// crossings produce the same hops on screen and in every PNG/SVG/PDF (the repo's canvas==export
// invariant).
//
// Relationships are drawn as gently-curved beziers, but for crossing DETECTION + hop PLACEMENT we
// approximate each relationship by its straight endpoint CHORD. A hop placed at the chord-crossing
// of a gently-curved relationship reads correctly, and chord–chord intersection is exact + cheap
// (no bezier–bezier root-finding). When line-jumps is on, the relationship line is itself drawn as
// the chord with hops cut in (see hopPath) — so the drawn line and the hop always agree.

/** A relationship reduced to its straight chord, with a deterministic ordering key + endpoint ids. */
export interface HopSegment {
  /** Stable id (the relationship/link id). */
  id: string;
  /** Array-order index; at a crossing the HIGHER order hops over the lower, so only one bump appears. */
  order: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  /** Endpoint node ids — used to skip pairs that legitimately share a node (they meet, don't cross). */
  fromId?: string;
  toId?: string;
}

/** A single hop: the crossing point + the parametric position `t` (0..1 from this segment's source)
 *  along the hopping segment, so multiple hops on one line can be ordered source→target. */
export interface Hop {
  /** Crossing point. */
  x: number;
  y: number;
  /** Position along the hopping segment, 0 at its source .. 1 at its target. */
  t: number;
}

/** Radius of the semicircular hop bump, in flow units. Small + fixed so it reads as a bump, not a loop. */
export const HOP_RADIUS = 6;

/** Two segments share an endpoint node → they legitimately meet, so never hop. */
function sharesEndpoint(a: HopSegment, b: HopSegment): boolean {
  if (a.fromId === undefined && a.toId === undefined) return false;
  return a.fromId === b.fromId || a.fromId === b.toId || a.toId === b.fromId || a.toId === b.toId;
}

/**
 * Intersection of segment a (p→p+r) and segment b (q→q+s), as the parameter `t` along `a` and `u`
 * along `b` (both in (0,1) for a proper interior crossing). Returns null when parallel/collinear or
 * when the crossing is at/beyond an endpoint. Standard 2D segment-segment test.
 */
function intersectParam(a: HopSegment, b: HopSegment): { t: number; u: number } | null {
  const rx = a.tx - a.sx;
  const ry = a.ty - a.sy;
  const sx = b.tx - b.sx;
  const sy = b.ty - b.sy;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-9) return null; // parallel or collinear
  const qpx = b.sx - a.sx;
  const qpy = b.sy - a.sy;
  const t = (qpx * sy - qpy * sx) / denom;
  const u = (qpx * ry - qpy * rx) / denom;
  // Strict interior so lines that merely touch at a shared endpoint (t or u == 0/1) don't count.
  const eps = 1e-6;
  if (t <= eps || t >= 1 - eps || u <= eps || u >= 1 - eps) return null;
  return { t, u };
}

/**
 * Compute the hops that fall on `seg`: every crossing with another relationship where `seg` is the
 * designated hopper (the higher `order`; ties broken by id so the choice is deterministic and only
 * ONE of the two lines hops). Returned in source→target order along `seg`. Pure.
 */
export function hopsFor(seg: HopSegment, all: HopSegment[]): Hop[] {
  const hops: Hop[] = [];
  for (const other of all) {
    if (other === seg || other.id === seg.id) continue;
    if (sharesEndpoint(seg, other)) continue;
    const hit = intersectParam(seg, other);
    if (!hit) continue;
    // Exactly one line hops: the later edge in array order (tie → larger id) bumps over the earlier.
    const segHops = seg.order > other.order || (seg.order === other.order && seg.id > other.id);
    if (!segHops) continue;
    hops.push({
      x: seg.sx + (seg.tx - seg.sx) * hit.t,
      y: seg.sy + (seg.ty - seg.sy) * hit.t,
      t: hit.t,
    });
  }
  hops.sort((p, q) => p.t - q.t);
  return hops;
}

/** Count every crossing among the segments (one per crossing pair), ignoring shared-endpoint pairs.
 *  Equivalent to the total number of hops drawn across all lines — handy for tests + sanity checks. */
export function crossingCount(all: HopSegment[]): number {
  let n = 0;
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      if (sharesEndpoint(a, b)) continue;
      if (intersectParam(a, b)) n += 1;
    }
  }
  return n;
}

/**
 * The SVG path `d` for `seg`'s relationship line, drawn along its chord with a semicircular hop cut
 * in at each crossing where `seg` is the hopper. With no hops this is a plain straight line, so the
 * line and its bumps are always one continuous path (no separate line beneath to peek through).
 *
 * Each hop: stop `HOP_RADIUS` before the crossing, arc a semicircle of radius `HOP_RADIUS` over to
 * `HOP_RADIUS` past it (the arc spans the line's own direction, bulging to one side), then carry on.
 * Adjacent crossings closer than 2·HOP_RADIUS are spaced by clamping each arc's entry to the previous
 * arc's exit, so hops never overlap or run backwards.
 */
export function hopPath(seg: HopSegment, all: HopSegment[]): string {
  const dx = seg.tx - seg.sx;
  const dy = seg.ty - seg.sy;
  const len = Math.hypot(dx, dy);
  const start = `M ${r2(seg.sx)} ${r2(seg.sy)}`;
  if (len < 1e-6) return `${start} L ${r2(seg.tx)} ${r2(seg.ty)}`;
  const ux = dx / len;
  const uy = dy / len;
  const hops = hopsFor(seg, all);
  if (hops.length === 0) return `${start} L ${r2(seg.tx)} ${r2(seg.ty)}`;

  const parts = [start];
  // `sweep` alternates the bulge side per line via a stable parity, so two hopped lines that happen
  // to share a hopper still look natural; 1 = clockwise arc relative to the line direction.
  const sweep = 1;
  let prevExit = 0; // distance along the line already consumed by the previous hop's exit
  for (const hop of hops) {
    const d = hop.t * len; // distance of the crossing from the source
    let entry = d - HOP_RADIUS;
    let exit = d + HOP_RADIUS;
    // Don't back up past where the previous arc left off, and keep the arc on the line.
    if (entry < prevExit) entry = prevExit;
    if (exit > len) exit = len;
    if (entry >= exit) {
      // Degenerate (crossing too close to an end or the previous hop) — skip the arc, stay on the line.
      continue;
    }
    const ex = seg.sx + ux * entry;
    const ey = seg.sy + uy * entry;
    const xx = seg.sx + ux * exit;
    const xy = seg.sy + uy * exit;
    const radius = (exit - entry) / 2; // half the chord the arc spans (≈ HOP_RADIUS away from ends)
    parts.push(`L ${r2(ex)} ${r2(ey)}`);
    parts.push(`A ${r2(radius)} ${r2(radius)} 0 0 ${sweep} ${r2(xx)} ${r2(xy)}`);
    prevExit = exit;
  }
  parts.push(`L ${r2(seg.tx)} ${r2(seg.ty)}`);
  return parts.join(" ");
}
