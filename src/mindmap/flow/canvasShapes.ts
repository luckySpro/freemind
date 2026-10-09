import type { CanvasShape } from "../../model/types";
import { type Rect, r2 } from "./geometry";
import { withAlpha } from "./style";

// Pure geometry for the free background shapes + smart containers (Tier 4 items 23 + 22): rect / ellipse
// / block-arrow / chevron, plus swimlane + matrix containers. ONE source of truth shared by the canvas
// overlay (CanvasShapes.tsx) and the SVG exporter (exportSvg.ts), so the screen and every export match
// (canvas == export). All coordinates are absolute flow space from the shape's own pos + size.

const SHAPE_STROKE = "#8a84c6"; // default accent (matches the backdrop family)

/** A drawing primitive both the canvas and the exporter render identically (discriminated by `t`). */
export type ShapePrim =
  | {
      t: "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      rx: number;
      fill: string;
      stroke: string;
    }
  | { t: "ellipse"; cx: number; cy: number; rx: number; ry: number; fill: string; stroke: string }
  | { t: "path"; d: string; fill: string; stroke: string }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string }
  | { t: "text"; x: number; y: number; s: string; fill: string; anchor: "start" | "middle" };

export interface CanvasShapeGeometry {
  prims: ShapePrim[];
  bbox: Rect;
}

/** Whether a shape kind is a smart container (captures topics; drawn with lane/cell dividers). */
export function isContainer(kind: CanvasShape["kind"]): boolean {
  return kind === "swimlane" || kind === "matrix";
}

/** A shape's box in flow coords (top-left + size). */
export interface ShapeBox {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type ResizeCorner = "nw" | "ne" | "sw" | "se";
export const SHAPE_MIN_W = 40;
export const SHAPE_MIN_H = 30;

/** Apply a pointer delta (in flow units) to a shape box: a move slides it; a corner resize moves the
 *  grabbed corner while the OPPOSITE corner stays fixed, min-clamped so the box can't shrink below the
 *  minimum (the clamp pushes the dragged corner, never the anchor — so the anchor never drifts). Pure —
 *  the bug-prone bit of the shape drag, so it's unit-tested away from the canvas. */
export function dragBox(
  box: ShapeBox,
  mode: "move" | ResizeCorner,
  dx: number,
  dy: number,
): ShapeBox {
  if (mode === "move") return { ...box, x: box.x + dx, y: box.y + dy };
  const left = box.x;
  const top = box.y;
  const right = box.x + box.w;
  const bottom = box.y + box.h;
  if (mode === "nw") {
    const mx = Math.min(left + dx, right - SHAPE_MIN_W);
    const my = Math.min(top + dy, bottom - SHAPE_MIN_H);
    return { x: mx, y: my, w: right - mx, h: bottom - my };
  }
  if (mode === "ne") {
    const mx = Math.max(right + dx, left + SHAPE_MIN_W);
    const my = Math.min(top + dy, bottom - SHAPE_MIN_H);
    return { x: left, y: my, w: mx - left, h: bottom - my };
  }
  if (mode === "sw") {
    const mx = Math.min(left + dx, right - SHAPE_MIN_W);
    const my = Math.max(bottom + dy, top + SHAPE_MIN_H);
    return { x: mx, y: top, w: right - mx, h: my - top };
  }
  const mx = Math.max(right + dx, left + SHAPE_MIN_W);
  const my = Math.max(bottom + dy, top + SHAPE_MIN_H);
  return { x: left, y: top, w: mx - left, h: my - top };
}

/** Stroke + translucent fill for a shape, from its optional colour override (else the default accent). */
export function resolveShapeStyle(color?: string): { stroke: string; fill: string } {
  const stroke = color || SHAPE_STROKE;
  return { stroke, fill: withAlpha(stroke, 0.08) };
}

// Rightward block arrow inside the box: a shaft (middle half) with a triangular head on the right third.
function blockArrowPath(x: number, y: number, w: number, h: number): string {
  const headX = x + w * 0.62;
  const p = (px: number, py: number) => `${r2(px)},${r2(py)}`;
  return `M${p(x, y + h * 0.28)} L${p(headX, y + h * 0.28)} L${p(headX, y)} L${p(x + w, y + h / 2)} L${p(headX, y + h)} L${p(headX, y + h * 0.72)} L${p(x, y + h * 0.72)} Z`;
}

// Rightward chevron (a thick arrowhead spanning the box).
function chevronPath(x: number, y: number, w: number, h: number): string {
  const p = (px: number, py: number) => `${r2(px)},${r2(py)}`;
  return `M${p(x, y)} L${p(x + w * 0.6, y)} L${p(x + w, y + h / 2)} L${p(x + w * 0.6, y + h)} L${p(x, y + h)} L${p(x + w * 0.4, y + h / 2)} Z`;
}

/** A topic's on-canvas box (freeform positions), the input to container capture. */
export interface NodeRectLite {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The ids of the topics whose CENTRE falls inside a shape's box (axis-aligned) — a smart container's
 *  captured members (item 22). Pure; the drag handler feeds it the live node rects. */
export function nodesInside(shape: CanvasShape, rects: NodeRectLite[]): string[] {
  const { x, y } = shape.pos;
  const { w, h } = shape.size;
  return rects
    .filter((r) => {
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      return cx >= x && cx <= x + w && cy >= y && cy <= y + h;
    })
    .map((r) => r.id);
}

/** The number of lanes/rows for a container (clamped to a sane range; defaults 3 / 2). */
export function containerLanes(s: CanvasShape): number {
  return Math.max(1, Math.min(12, s.lanes ?? 3));
}
export function containerRows(s: CanvasShape): number {
  return Math.max(1, Math.min(12, s.rows ?? 2));
}

export function canvasShapeGeometry(shape: CanvasShape): CanvasShapeGeometry {
  const { x, y } = shape.pos;
  const { w, h } = shape.size;
  const { stroke, fill } = resolveShapeStyle(shape.color);
  const prims: ShapePrim[] = [];
  const bbox: Rect = { x, y, w, h };

  switch (shape.kind) {
    case "rect":
      prims.push({ t: "rect", x, y, w, h, rx: 10, fill, stroke });
      break;
    case "ellipse":
      prims.push({
        t: "ellipse",
        cx: x + w / 2,
        cy: y + h / 2,
        rx: w / 2,
        ry: h / 2,
        fill,
        stroke,
      });
      break;
    case "blockArrow":
      prims.push({ t: "path", d: blockArrowPath(x, y, w, h), fill, stroke });
      break;
    case "chevron":
      prims.push({ t: "path", d: chevronPath(x, y, w, h), fill, stroke });
      break;
    case "swimlane": {
      const n = containerLanes(shape);
      const headH = Math.min(34, h * 0.18);
      prims.push({ t: "rect", x, y, w, h, rx: 8, fill, stroke });
      // Header band across the top.
      prims.push({ t: "line", x1: x, y1: y + headH, x2: x + w, y2: y + headH, stroke });
      // Lane dividers + per-lane header labels.
      for (let i = 1; i < n; i++) {
        const lx = x + (w * i) / n;
        prims.push({ t: "line", x1: lx, y1: y, x2: lx, y2: y + h, stroke });
      }
      if (shape.label)
        prims.push({
          t: "text",
          x: x + 8,
          y: y + headH * 0.7,
          s: shape.label,
          fill: stroke,
          anchor: "start",
        });
      break;
    }
    case "matrix": {
      const cols = containerLanes(shape);
      const rowN = containerRows(shape);
      prims.push({ t: "rect", x, y, w, h, rx: 8, fill, stroke });
      for (let i = 1; i < cols; i++) {
        const lx = x + (w * i) / cols;
        prims.push({ t: "line", x1: lx, y1: y, x2: lx, y2: y + h, stroke });
      }
      for (let j = 1; j < rowN; j++) {
        const ly = y + (h * j) / rowN;
        prims.push({ t: "line", x1: x, y1: ly, x2: x + w, y2: ly, stroke });
      }
      break;
    }
  }

  if (shape.label && !isContainer(shape.kind)) {
    prims.push({
      t: "text",
      x: x + w / 2,
      y: y + h / 2 + 5,
      s: shape.label,
      fill: stroke,
      anchor: "middle",
    });
  }
  return { prims, bbox };
}
