import { r2 } from "./geometry";

// The relationship arrowhead geometry, in one place so the live canvas edge (CrosslinkEdge) and the
// SVG exporter (exportSvg) emit the byte-identical path — "canvas == export". Pure (no React, no DOM)
// so it's unit-tested directly.

/** A filled triangle arrowhead with its tip at (tipX,tipY), pointing away from (fromX,fromY).
 *  Shared by the canvas edge and the SVG exporter so a relationship reads directionally in both
 *  — the flowchart / concept-map connector. Returns an SVG path `d`. */
export function arrowHeadPath(
  tipX: number,
  tipY: number,
  fromX: number,
  fromY: number,
  size = 9,
): string {
  const dx = tipX - fromX;
  const dy = tipY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const bx = tipX - ux * size; // base centre, `size` back from the tip
  const by = tipY - uy * size;
  const px = -uy; // perpendicular
  const py = ux;
  const w = size * 0.55;
  return `M ${r2(tipX)} ${r2(tipY)} L ${r2(bx + px * w)} ${r2(by + py * w)} L ${r2(bx - px * w)} ${r2(by - py * w)} Z`;
}
