// Smart alignment guides for the free-canvas (whiteboard) layout: while a topic is dragged, snap its
// edges/centres to nearby topics and surface guide lines. Pure geometry (unit-tested); FlowMindMap
// feeds it the dragged box + the other boxes during onNodeDrag and renders the returned guides.

export interface SnapBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A guide line to draw: a vertical (`x`) or horizontal (`y`) line at `pos`, spanning `start..end`
 *  along the other axis (flow coordinates). */
export interface GuideLine {
  axis: "x" | "y";
  pos: number;
  start: number;
  end: number;
}

export interface SnapResult {
  /** The snapped top-left position (unchanged on the axes with no match). */
  x: number;
  y: number;
  guides: GuideLine[];
}

interface Best {
  delta: number;
  pos: number;
  lo: number;
  hi: number;
}

/** Best snap on one axis: compare the dragged box's three lines (start / centre / end) to every other
 *  box's three lines; the closest pair within `threshold` wins. `lo`/`hi` track the other box's extent
 *  on the *perpendicular* axis (for the guide line's span). */
function bestOnAxis(
  dStart: number,
  dSize: number,
  boxes: readonly { lineA: number; lineB: number; lineC: number; lo: number; hi: number }[],
  threshold: number,
): Best | null {
  const dLines = [dStart, dStart + dSize / 2, dStart + dSize];
  let best: Best | null = null;
  for (const b of boxes) {
    for (const oe of [b.lineA, b.lineB, b.lineC]) {
      for (const de of dLines) {
        const delta = oe - de;
        if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
          best = { delta, pos: oe, lo: b.lo, hi: b.hi };
        }
      }
    }
  }
  return best;
}

/** Snap a dragged box to nearby boxes (edges + centres) and return the adjusted position + guides.
 *  No match on an axis → that coordinate is unchanged and no guide for it. Pure + deterministic. */
export function computeSnap(
  dragged: SnapBox,
  others: readonly SnapBox[],
  threshold = 6,
): SnapResult {
  const bestX = bestOnAxis(
    dragged.x,
    dragged.w,
    others.map((o) => ({
      lineA: o.x,
      lineB: o.x + o.w / 2,
      lineC: o.x + o.w,
      lo: o.y,
      hi: o.y + o.h,
    })),
    threshold,
  );
  const bestY = bestOnAxis(
    dragged.y,
    dragged.h,
    others.map((o) => ({
      lineA: o.y,
      lineB: o.y + o.h / 2,
      lineC: o.y + o.h,
      lo: o.x,
      hi: o.x + o.w,
    })),
    threshold,
  );
  const x = bestX ? dragged.x + bestX.delta : dragged.x;
  const y = bestY ? dragged.y + bestY.delta : dragged.y;
  const guides: GuideLine[] = [];
  if (bestX) {
    guides.push({
      axis: "x",
      pos: bestX.pos,
      start: Math.min(y, bestX.lo),
      end: Math.max(y + dragged.h, bestX.hi),
    });
  }
  if (bestY) {
    guides.push({
      axis: "y",
      pos: bestY.pos,
      start: Math.min(x, bestY.lo),
      end: Math.max(x + dragged.w, bestY.hi),
    });
  }
  return { x, y, guides };
}
