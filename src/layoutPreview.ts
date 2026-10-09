import type { LayoutKind } from "./mindmap";

// Pure model for a layout's gallery thumbnail (10c): a tiny schematic diagram — a root dot, child
// dots, and the connecting lines/shapes that make the layout's pattern recognisable at a glance
// (mirrors designPreviewModel's role for the Canvas menu's design gallery). Kept pure (no DOM, no
// colour lookups) so it's unit-tested; the caller renders an <svg> from it, coloured via CSS vars so
// it re-themes with the chrome instead of carrying its own hex colours.

export interface LayoutPreviewModel {
  w: number;
  h: number;
  /** The root dot (larger). Absent for layouts with no single "root" reading (timeline/grid/swimlane). */
  root?: { cx: number; cy: number };
  /** Smaller child/row dots. */
  nodes: { cx: number; cy: number }[];
  /** Straight connector lines (root-to-child, or a chain/spine). */
  lines: { x1: number; y1: number; x2: number; y2: number }[];
  /** Extra static outline shapes (grid cells, swimlane rows, the brace bracket) as SVG path `d`s. */
  paths?: string[];
}

const ROOT_R = 3;
const NODE_R = 2;

/** Build the thumbnail model for a layout kind at size w×h (defaults sized for the menu icon slot).
 *  "freeform" has no gallery entry (it's a separate toggle, not a pickable layout) — falls back to a
 *  bare canvas outline rather than throwing, so an unexpected kind still renders something sane. Pure. */
export function layoutPreviewModel(kind: LayoutKind, w = 36, h = 24): LayoutPreviewModel {
  const cx = w / 2;
  const cy = h / 2;
  const line = (x1: number, y1: number, x2: number, y2: number) => ({ x1, y1, x2, y2 });
  const dot = (px: number, py: number) => ({ cx: px, cy: py });

  switch (kind) {
    case "side": {
      const left = [cy - 8, cy, cy + 8].map((y) => dot(cx - 12, y));
      const right = [cy - 8, cy, cy + 8].map((y) => dot(cx + 12, y));
      const nodes = [...left, ...right];
      return {
        w,
        h,
        root: dot(cx, cy),
        nodes,
        lines: nodes.map((n) => line(cx, cy, n.cx, n.cy)),
      };
    }
    case "right": {
      const nodes = [cy - 8, cy, cy + 8].map((y) => dot(cx + 9, y));
      return {
        w,
        h,
        root: dot(cx - 11, cy),
        nodes,
        lines: nodes.map((n) => line(cx - 11, cy, n.cx, n.cy)),
      };
    }
    case "left": {
      const nodes = [cy - 8, cy, cy + 8].map((y) => dot(cx - 9, y));
      return {
        w,
        h,
        root: dot(cx + 11, cy),
        nodes,
        lines: nodes.map((n) => line(cx + 11, cy, n.cx, n.cy)),
      };
    }
    case "radial": {
      const r = Math.min(w, h) / 2 - 3;
      const nodes = Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        return dot(cx + r * Math.cos(a), cy + r * Math.sin(a));
      });
      return { w, h, root: dot(cx, cy), nodes, lines: nodes.map((n) => line(cx, cy, n.cx, n.cy)) };
    }
    case "org-down": {
      const nodes = [cx - 11, cx, cx + 11].map((x) => dot(x, h - 4));
      return { w, h, root: dot(cx, 4), nodes, lines: nodes.map((n) => line(cx, 4, n.cx, n.cy)) };
    }
    case "org-up": {
      const nodes = [cx - 11, cx, cx + 11].map((x) => dot(x, 4));
      return {
        w,
        h,
        root: dot(cx, h - 4),
        nodes,
        lines: nodes.map((n) => line(cx, h - 4, n.cx, n.cy)),
      };
    }
    case "timeline": {
      const xs = [4, 4 + (w - 8) / 3, 4 + ((w - 8) * 2) / 3, w - 4];
      const nodes = xs.map((x) => dot(x, cy));
      const lines = [];
      for (let i = 0; i < nodes.length - 1; i++)
        lines.push(line(nodes[i].cx, cy, nodes[i + 1].cx, cy));
      return { w, h, root: nodes[0], nodes: nodes.slice(1), lines };
    }
    case "fishbone": {
      const spine = line(4, cy, w - 4, cy);
      const ribX = [w * 0.3, w * 0.5, w * 0.7];
      const lines = [spine];
      const nodes = [];
      for (const [i, x] of ribX.entries()) {
        const up = i % 2 === 0;
        const ty = up ? 4 : h - 4;
        lines.push(line(x, cy, x + 4, ty));
        nodes.push(dot(x + 4, ty));
      }
      return { w, h, root: dot(w - 4, cy), nodes, lines };
    }
    case "grid": {
      const xs = [w * 0.28, w * 0.5, w * 0.72];
      const ys = [h * 0.32, h * 0.72];
      const nodes = ys.flatMap((y) => xs.map((x) => dot(x, y)));
      return { w, h, nodes, lines: [] };
    }
    case "swimlane": {
      const ys = [h * 0.22, h * 0.5, h * 0.78];
      const paths = ys.map((y) => `M3 ${y} H${w - 3}`);
      const nodes = ys.flatMap((y) => [dot(w * 0.35, y), dot(w * 0.65, y)]);
      return { w, h, nodes, lines: [], paths };
    }
    case "brace": {
      const bx = w * 0.22;
      const paths = [`M${bx} 3 Q${bx - 4} ${cy} ${bx} ${cy} Q${bx - 4} ${cy} ${bx} ${h - 3}`];
      const nodes = [h * 0.28, h * 0.5, h * 0.72].map((y) => dot(w * 0.65, y));
      return { w, h, nodes, lines: [], paths };
    }
    default:
      return { w, h, nodes: [], lines: [], paths: [`M2 2 H${w - 2} V${h - 2} H2 Z`] };
  }
}

export const LAYOUT_PREVIEW_ROOT_R = ROOT_R;
export const LAYOUT_PREVIEW_NODE_R = NODE_R;
