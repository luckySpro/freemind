// Tiny geometry helpers shared across the flow canvas overlays + the SVG exporter, so the
// "canvas == export" math stays single-source (and the same rounding is used everywhere).

/** An axis-aligned box in flow coordinates (top-left + size). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Round to 2 decimals — keeps emitted SVG coordinates compact + stable. */
export const r2 = (n: number): number => Math.round(n * 100) / 100;

/** Boundary outline shapes (MindManager: rounded-rect / rect / ellipse / scalloped cloud / polygon). */
export type BoundaryShape = "roundRect" | "rect" | "ellipse" | "cloud" | "polygon";

/** SVG path `d` for a boundary outline of the given shape over the box (x,y,w,h). Shared by the live
 *  canvas overlay + the SVG exporter so the enclosure draws identically (canvas == export). The cloud
 *  bumps bulge OUTWARD beyond the box, so render it in an overflow-visible svg. Pure. */
export function boundaryPath(
  shape: BoundaryShape | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
): string {
  if (shape === "rect") {
    return `M ${r2(x)} ${r2(y)} H ${r2(x + w)} V ${r2(y + h)} H ${r2(x)} Z`;
  }
  if (shape === "ellipse") {
    const cy = y + h / 2;
    const rx = w / 2;
    const ry = h / 2;
    return `M ${r2(x)} ${r2(cy)} A ${r2(rx)} ${r2(ry)} 0 1 0 ${r2(x + w)} ${r2(cy)} A ${r2(rx)} ${r2(ry)} 0 1 0 ${r2(x)} ${r2(cy)} Z`;
  }
  if (shape === "polygon") {
    const c = Math.min(w, h) * 0.2;
    return [
      `M ${r2(x + c)} ${r2(y)}`,
      `L ${r2(x + w - c)} ${r2(y)} L ${r2(x + w)} ${r2(y + c)}`,
      `L ${r2(x + w)} ${r2(y + h - c)} L ${r2(x + w - c)} ${r2(y + h)}`,
      `L ${r2(x + c)} ${r2(y + h)} L ${r2(x)} ${r2(y + h - c)}`,
      `L ${r2(x)} ${r2(y + c)} Z`,
    ].join(" ");
  }
  if (shape === "cloud") {
    const bump = 12;
    const n = (len: number): number => Math.max(2, Math.round(len / 38));
    const parts: string[] = [`M ${r2(x)} ${r2(y)}`];
    const nT = n(w);
    const sT = w / nT;
    for (let i = 0; i < nT; i++)
      parts.push(`Q ${r2(x + sT * i + sT / 2)} ${r2(y - bump)} ${r2(x + sT * (i + 1))} ${r2(y)}`);
    const nR = n(h);
    const sR = h / nR;
    for (let i = 0; i < nR; i++)
      parts.push(
        `Q ${r2(x + w + bump)} ${r2(y + sR * i + sR / 2)} ${r2(x + w)} ${r2(y + sR * (i + 1))}`,
      );
    const nB = n(w);
    const sB = w / nB;
    for (let i = 0; i < nB; i++)
      parts.push(
        `Q ${r2(x + w - sB * i - sB / 2)} ${r2(y + h + bump)} ${r2(x + w - sB * (i + 1))} ${r2(y + h)}`,
      );
    const nL = n(h);
    const sL = h / nL;
    for (let i = 0; i < nL; i++)
      parts.push(
        `Q ${r2(x - bump)} ${r2(y + h - sL * i - sL / 2)} ${r2(x)} ${r2(y + h - sL * (i + 1))}`,
      );
    parts.push("Z");
    return parts.join(" ");
  }
  // roundRect (default) — clamp the corner radius so a small box can't invert (H/V run backwards).
  const rr = Math.min(16, w / 2, h / 2);
  return [
    `M ${r2(x + rr)} ${r2(y)}`,
    `H ${r2(x + w - rr)} A ${rr} ${rr} 0 0 1 ${r2(x + w)} ${r2(y + rr)}`,
    `V ${r2(y + h - rr)} A ${rr} ${rr} 0 0 1 ${r2(x + w - rr)} ${r2(y + h)}`,
    `H ${r2(x + rr)} A ${rr} ${rr} 0 0 1 ${r2(x)} ${r2(y + h - rr)}`,
    `V ${r2(y + rr)} A ${rr} ${rr} 0 0 1 ${r2(x + rr)} ${r2(y)} Z`,
  ].join(" ");
}

/** The colour token from a CSS border shorthand ("2px solid #e23" -> "#e23"), or null if none.
 *  Shared by the live node's geometric-shape stroke (TopicNode) + the SVG exporter's parseBorder, so
 *  the same border colour resolves identically on canvas and in export. */
export function matchBorderColor(border: string | undefined): string | null {
  return border?.match(/#[0-9a-f]{3,8}|rgba?\([^)]+\)/i)?.[0] ?? null;
}

/** Dash array for a boundary/line dash style ("" = solid). */
export function dashArray(dash: "solid" | "dashed" | "dotted" | undefined): string {
  return dash === "dashed" ? "6 5" : dash === "dotted" ? "2 4" : "";
}
