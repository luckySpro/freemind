import type { NodeShape } from "../../model/types";
import { r2 } from "./geometry";

// Pure node-shape geometry, shared by the on-canvas backdrop (TopicNode), the SVG exporter
// (exportSvg), and the style-picker icons (Panels) so the screen, the export, and the picker
// stay identical. The everyday rounded-rect / box / pill cases stay plain CSS rounded
// rectangles; the "geometric" shapes are painted as an SVG <path> sized to the node box.
// Flowchart vocabulary: diamond = decision, parallelogram = input/output, hexagon =
// preparation, cylinder = data store, ellipse = terminator/start-end, trapezoid = manual
// operation, octagon = stop/limit, document = report/output, callout = annotation/speech.
// Decorative vector shapes round it out: star = highlight, cloud = idea/external system.
// Every path here MUST stay mathematically inside the given box so it scales cleanly via the
// canvas's `preserveAspectRatio="none"` viewBox and lines up 1:1 in the export.

const GEOMETRIC: ReadonlySet<string> = new Set([
  "ellipse",
  "diamond",
  "parallelogram",
  "hexagon",
  "cylinder",
  "trapezoid",
  "octagon",
  "document",
  "callout",
  "star",
  "cloud",
]);

/** True when the shape is painted as an SVG path (vs a CSS rounded rectangle). */
export function isGeometric(shape: NodeShape | undefined): shape is NodeShape {
  return shape != null && GEOMETRIC.has(shape);
}

/** Extra padding (px) so a topic's text stays inside a narrowing shape. */
export interface ShapeInset {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
const NO_INSET: ShapeInset = { left: 0, right: 0, top: 0, bottom: 0 };

export function shapeInset(shape: NodeShape | undefined): ShapeInset {
  switch (shape) {
    case "diamond":
      return { left: 22, right: 22, top: 12, bottom: 12 };
    case "parallelogram":
      return { left: 16, right: 16, top: 0, bottom: 0 };
    case "hexagon":
      return { left: 18, right: 18, top: 0, bottom: 0 };
    case "ellipse":
      return { left: 14, right: 14, top: 6, bottom: 6 };
    case "cylinder":
      return { left: 4, right: 4, top: 12, bottom: 8 };
    case "trapezoid":
      // Sloped sides pull the top corners in, so keep the label clear of them.
      return { left: 18, right: 18, top: 0, bottom: 0 };
    case "octagon":
      return { left: 12, right: 12, top: 6, bottom: 6 };
    case "document":
      // The wavy bottom edge eats into the lower band — keep text above it.
      return { left: 4, right: 4, top: 2, bottom: 14 };
    case "callout":
      // Leave room for the speech tail hanging off the bottom-left.
      return { left: 4, right: 4, top: 2, bottom: 16 };
    case "star":
      // A five-point star is mostly empty corners; pull the label deep into the body.
      return { left: 26, right: 26, top: 30, bottom: 16 };
    case "cloud":
      // Concave scalloped edges — inset on every side so the label sits in the core.
      return { left: 22, right: 22, top: 14, bottom: 14 };
    default:
      return NO_INSET;
  }
}

function cylinderRy(h: number): number {
  return Math.min(h * 0.16, 12);
}

/** A five-point star inscribed in the box: 10 alternating outer/inner vertices, the outer ring
 *  touching the box edges (top point at the top-centre). Stays inside [x,x2]×[y,y2] by construction. */
function starPath(x: number, y: number, w: number, h: number): string {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2;
  const ry = h / 2;
  // Inner radius ratio for a classic 5-point star.
  const ir = 0.42;
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    // Start at the top point (-90°) and step every 36°, alternating outer/inner radius.
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const er = i % 2 === 0 ? 1 : ir;
    const px = cx + Math.cos(ang) * rx * er;
    const py = cy + Math.sin(ang) * ry * er;
    pts.push(`${i === 0 ? "M" : "L"} ${r2(px)} ${r2(py)}`);
  }
  return `${pts.join(" ")} Z`;
}

/** A puffy cloud: a ring of bumps (arcs) bulging outward, every point kept inside the box so it
 *  scales cleanly. Built from five top/side lobes plus a flatter base. */
function cloudPath(x: number, y: number, w: number, h: number): string {
  const x2 = x + w;
  const y2 = y + h;
  // Bumps live in an inner band so their outward bulge never leaves the box.
  const ix = x + w * 0.04;
  const ix2 = x2 - w * 0.04;
  const iy = y + h * 0.16;
  const iy2 = y2 - h * 0.06;
  const top = y + h * 0.4;
  // Walk the perimeter clockwise from the lower-left, arcing out for each lobe.
  return [
    `M ${r2(ix)} ${r2(iy2)}`,
    // left side lobe
    `C ${r2(x)} ${r2(iy2)} ${r2(x)} ${r2(top)} ${r2(ix + w * 0.06)} ${r2(top)}`,
    // top-left lobe
    `C ${r2(x + w * 0.06)} ${r2(iy)} ${r2(x + w * 0.32)} ${r2(y)} ${r2(cxAt(x, w, 0.4))} ${r2(iy)}`,
    // top-right lobe
    `C ${r2(cxAt(x, w, 0.58))} ${r2(y)} ${r2(ix2 - w * 0.04)} ${r2(iy)} ${r2(ix2 - w * 0.04)} ${r2(top)}`,
    // right side lobe
    `C ${r2(x2)} ${r2(top)} ${r2(x2)} ${r2(iy2)} ${r2(ix2)} ${r2(iy2)}`,
    // base
    `C ${r2(cxAt(x, w, 0.62))} ${r2(y2)} ${r2(cxAt(x, w, 0.38))} ${r2(y2)} ${r2(ix)} ${r2(iy2)}`,
    "Z",
  ].join(" ");
}

/** Helper: an absolute x at fraction `t` of the box width (keeps cloud control points readable). */
function cxAt(x: number, w: number, t: number): number {
  return x + w * t;
}

/** The fill+stroke outline for a geometric shape, as an SVG path `d` (absolute coords). */
export function shapePath(shape: NodeShape, x: number, y: number, w: number, h: number): string {
  const x2 = x + w;
  const y2 = y + h;
  const cx = x + w / 2;
  const cy = y + h / 2;
  switch (shape) {
    case "diamond":
      return `M ${r2(cx)} ${r2(y)} L ${r2(x2)} ${r2(cy)} L ${r2(cx)} ${r2(y2)} L ${r2(x)} ${r2(cy)} Z`;
    case "parallelogram": {
      const s = Math.min(w * 0.22, h * 0.8);
      return `M ${r2(x + s)} ${r2(y)} L ${r2(x2)} ${r2(y)} L ${r2(x2 - s)} ${r2(y2)} L ${r2(x)} ${r2(y2)} Z`;
    }
    case "hexagon": {
      const c = Math.min(w * 0.16, h * 0.5);
      return `M ${r2(x + c)} ${r2(y)} L ${r2(x2 - c)} ${r2(y)} L ${r2(x2)} ${r2(cy)} L ${r2(x2 - c)} ${r2(y2)} L ${r2(x + c)} ${r2(y2)} L ${r2(x)} ${r2(cy)} Z`;
    }
    case "ellipse": {
      const rx = w / 2;
      const ry = h / 2;
      // A full ellipse as two semicircular arcs (so it shares the <path> pipeline).
      return `M ${r2(x)} ${r2(cy)} A ${r2(rx)} ${r2(ry)} 0 1 0 ${r2(x2)} ${r2(cy)} A ${r2(rx)} ${r2(ry)} 0 1 0 ${r2(x)} ${r2(cy)} Z`;
    }
    case "cylinder": {
      const ry = cylinderRy(h);
      const rx = w / 2;
      return `M ${r2(x)} ${r2(y + ry)} A ${r2(rx)} ${r2(ry)} 0 0 1 ${r2(x2)} ${r2(y + ry)} L ${r2(x2)} ${r2(y2 - ry)} A ${r2(rx)} ${r2(ry)} 0 0 1 ${r2(x)} ${r2(y2 - ry)} Z`;
    }
    case "trapezoid": {
      // Wider base than top — the top corners pull in by `s` (a manual-operation flowchart box).
      const s = Math.min(w * 0.2, h * 0.8);
      return `M ${r2(x + s)} ${r2(y)} L ${r2(x2 - s)} ${r2(y)} L ${r2(x2)} ${r2(y2)} L ${r2(x)} ${r2(y2)} Z`;
    }
    case "octagon": {
      // Cut all four corners by the same chamfer so the eight edges fit the box.
      const c = Math.min(w * 0.29, h * 0.29);
      return `M ${r2(x + c)} ${r2(y)} L ${r2(x2 - c)} ${r2(y)} L ${r2(x2)} ${r2(y + c)} L ${r2(x2)} ${r2(y2 - c)} L ${r2(x2 - c)} ${r2(y2)} L ${r2(x + c)} ${r2(y2)} L ${r2(x)} ${r2(y2 - c)} L ${r2(x)} ${r2(y + c)} Z`;
    }
    case "document": {
      // A page whose bottom edge waves: it dips down then rises, but never leaves the box.
      const wave = Math.min(h * 0.18, 16);
      const baseY = y2 - wave;
      return `M ${r2(x)} ${r2(y)} L ${r2(x2)} ${r2(y)} L ${r2(x2)} ${r2(baseY)} C ${r2(x + w * 0.75)} ${r2(y2)} ${r2(x + w * 0.25)} ${r2(baseY - wave)} ${r2(x)} ${r2(baseY)} Z`;
    }
    case "callout": {
      // A rounded speech rectangle with a small tail hanging off the bottom-left.
      const rad = Math.min(w * 0.08, h * 0.22, 14);
      const tailW = Math.min(w * 0.16, 22);
      const tailH = Math.min(h * 0.22, 14);
      const bodyB = y2 - tailH; // body's bottom edge; the tail dips below it
      const tx = x + w * 0.22; // tail anchor on the body's bottom edge
      return [
        `M ${r2(x + rad)} ${r2(y)}`,
        `L ${r2(x2 - rad)} ${r2(y)}`,
        `Q ${r2(x2)} ${r2(y)} ${r2(x2)} ${r2(y + rad)}`,
        `L ${r2(x2)} ${r2(bodyB - rad)}`,
        `Q ${r2(x2)} ${r2(bodyB)} ${r2(x2 - rad)} ${r2(bodyB)}`,
        `L ${r2(tx + tailW)} ${r2(bodyB)}`,
        `L ${r2(tx)} ${r2(y2)}`,
        `L ${r2(tx)} ${r2(bodyB)}`,
        `L ${r2(x + rad)} ${r2(bodyB)}`,
        `Q ${r2(x)} ${r2(bodyB)} ${r2(x)} ${r2(bodyB - rad)}`,
        `L ${r2(x)} ${r2(y + rad)}`,
        `Q ${r2(x)} ${r2(y)} ${r2(x + rad)} ${r2(y)}`,
        "Z",
      ].join(" ");
    }
    case "star":
      return starPath(x, y, w, h);
    case "cloud":
      return cloudPath(x, y, w, h);
    default:
      return `M ${r2(x)} ${r2(y)} L ${r2(x2)} ${r2(y)} L ${r2(x2)} ${r2(y2)} L ${r2(x)} ${r2(y2)} Z`;
  }
}

/** An extra stroke-only path drawn over the fill (the cylinder's front lip); null otherwise. */
export function shapeOverlayPath(
  shape: NodeShape,
  x: number,
  y: number,
  w: number,
  h: number,
): string | null {
  if (shape !== "cylinder") return null;
  const ry = cylinderRy(h);
  const rx = w / 2;
  return `M ${r2(x)} ${r2(y + ry)} A ${r2(rx)} ${r2(ry)} 0 0 0 ${r2(x + w)} ${r2(y + ry)}`;
}
