import type { Backdrop } from "../../model/types";
import { type Rect, r2 } from "./geometry";
import { resolveBackdropStyle } from "./style";

// Dedicated diagram backdrops (onion / funnel / Venn): a pure geometric frame drawn behind
// freely-positioned topics. One source of truth shared by the canvas overlay (DiagramBackdrop.tsx)
// and the SVG exporter, so the screen and the export match. Region *labels* are ordinary topics placed
// at the returned `anchors`, so the frame itself carries no text — only shapes.
//
// All coordinates are absolute flow space, centred on the origin; a builder seeds the topics around
// it (the map's other layouts ignore a backdrop — it only shows in free-canvas mode).

export interface BackdropPrimitive {
  type: "circle" | "path";
  cx?: number;
  cy?: number;
  r?: number;
  d?: string;
  fill: string;
  stroke: string;
}

export interface BackdropGeometry {
  shapes: BackdropPrimitive[];
  /** One suggested label position per region (a builder drops a topic at each). */
  anchors: { x: number; y: number }[];
  /** Bounding box of the whole frame (drives the overlay svg + the export viewBox). */
  bbox: Rect;
}

const ONION_R = 300; // outer radius

/** The number of rings/stages for onion + funnel (clamped to a sane range); venn is fixed by kind. */
export function backdropRings(b: Backdrop): number {
  if (b.kind === "venn2") return 3;
  if (b.kind === "venn3") return 7;
  return Math.max(2, Math.min(6, b.rings ?? 3));
}

function onion(rings: number, stroke: string): BackdropGeometry {
  const shapes: BackdropPrimitive[] = [];
  const anchors: { x: number; y: number }[] = [];
  for (let i = 0; i < rings; i++) {
    const r = (ONION_R * (rings - i)) / rings; // region 0 = outermost
    shapes.push({ type: "circle", cx: 0, cy: 0, r: r2(r), fill: "none", stroke });
    const rInner = (ONION_R * (rings - i - 1)) / rings;
    anchors.push({ x: 0, y: r2(-(r + rInner) / 2) }); // top-centre of each ring band
  }
  return { shapes, anchors, bbox: { x: -ONION_R, y: -ONION_R, w: 2 * ONION_R, h: 2 * ONION_R } };
}

const FUNNEL_W = 460;
const FUNNEL_H = 420;

function funnel(stages: number, stroke: string, fill: string): BackdropGeometry {
  const top = -FUNNEL_H / 2;
  const bandH = FUNNEL_H / stages;
  const halfAt = (frac: number) => (FUNNEL_W / 2) * (1 - 0.62 * frac); // full at top, ~38% at bottom
  const shapes: BackdropPrimitive[] = [];
  const anchors: { x: number; y: number }[] = [];
  for (let i = 0; i < stages; i++) {
    const yTop = top + i * bandH;
    const yBot = yTop + bandH;
    const wT = halfAt(i / stages);
    const wB = halfAt((i + 1) / stages);
    const d = `M ${r2(-wT)} ${r2(yTop)} L ${r2(wT)} ${r2(yTop)} L ${r2(wB)} ${r2(yBot)} L ${r2(-wB)} ${r2(yBot)} Z`;
    shapes.push({ type: "path", d, fill, stroke });
    anchors.push({ x: 0, y: r2(yTop + bandH / 2) });
  }
  return { shapes, anchors, bbox: { x: -FUNNEL_W / 2, y: top, w: FUNNEL_W, h: FUNNEL_H } };
}

const VENN_R = 175;
const VENN_SEP = 130;

function venn2(stroke: string, fill: string): BackdropGeometry {
  const ax = -VENN_SEP / 2;
  const bx = VENN_SEP / 2;
  const circle = (cx: number) => ({
    type: "circle" as const,
    cx,
    cy: 0,
    r: VENN_R,
    fill,
    stroke,
  });
  return {
    shapes: [circle(ax), circle(bx)],
    anchors: [
      { x: r2(ax - VENN_R * 0.45), y: 0 }, // A only
      { x: r2(bx + VENN_R * 0.45), y: 0 }, // B only
      { x: 0, y: 0 }, // A ∩ B
    ],
    bbox: { x: ax - VENN_R, y: -VENN_R, w: VENN_SEP + 2 * VENN_R, h: 2 * VENN_R },
  };
}

function venn3(stroke: string, fill: string): BackdropGeometry {
  const R = 160;
  const d = 96; // centre-to-circle distance
  const cx = r2(d * 0.866);
  const cy = r2(d * 0.5);
  const A = { x: 0, y: -d }; // top
  const B = { x: -cx, y: cy }; // bottom-left
  const C = { x: cx, y: cy }; // bottom-right
  const circle = (c: { x: number; y: number }) => ({
    type: "circle" as const,
    cx: c.x,
    cy: c.y,
    r: R,
    fill,
    stroke,
  });
  const mid = (p: { x: number; y: number }, q: { x: number; y: number }) => ({
    x: r2((p.x + q.x) / 2),
    y: r2((p.y + q.y) / 2),
  });
  return {
    shapes: [circle(A), circle(B), circle(C)],
    anchors: [
      { x: A.x, y: r2(A.y - R * 0.5) }, // A only
      { x: r2(B.x - R * 0.4), y: r2(B.y + R * 0.4) }, // B only
      { x: r2(C.x + R * 0.4), y: r2(C.y + R * 0.4) }, // C only
      mid(A, B), // A ∩ B
      mid(A, C), // A ∩ C
      mid(B, C), // B ∩ C
      { x: 0, y: 0 }, // A ∩ B ∩ C
    ],
    bbox: { x: B.x - R, y: A.y - R, w: C.x + R - (B.x - R), h: cy + R - (A.y - R) },
  };
}

/** Resolve a backdrop into drawable shapes + label anchors + a bounding box. */
export function backdropGeometry(b: Backdrop): BackdropGeometry {
  const rings = backdropRings(b);
  const { stroke, fill } = resolveBackdropStyle(b.color);
  switch (b.kind) {
    case "onion":
      return onion(rings, stroke);
    case "funnel":
      return funnel(rings, stroke, fill);
    case "venn2":
      return venn2(stroke, fill);
    case "venn3":
      return venn3(stroke, fill);
    default:
      return { shapes: [], anchors: [], bbox: { x: 0, y: 0, w: 0, h: 0 } };
  }
}
