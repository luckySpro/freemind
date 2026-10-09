import type { Design } from "./designs";
import { themeById } from "./mindmap/theme";

// Pure model for a design's gallery thumbnail (#5): a tiny mock map — themed background, a root dot,
// and three branches in the theme palette drawn with the design's connector style. Kept pure (no DOM)
// so it's unit-tested; the Toolbar renders an <svg> from it. Colours come from the theme constants,
// so they're trusted (no escaping needed).

export interface DesignPreviewBranch {
  /** SVG path `d` from the root to the branch tip. */
  d: string;
  color: string;
  tx: number;
  ty: number;
}

export interface DesignPreviewModel {
  w: number;
  h: number;
  bg: string;
  rootBg: string;
  root: { cx: number; cy: number; r: number };
  branches: DesignPreviewBranch[];
}

/** Build the thumbnail model for a design at size w×h (defaults sized for the menu icon slot). Pure. */
export function designPreviewModel(design: Design, w = 36, h = 24): DesignPreviewModel {
  const t = themeById(design.themeId).theme;
  const bg = t.cssVar["--bgcolor"] ?? "#ffffff";
  const rootBg = t.cssVar["--root-bgcolor"] ?? "#1b8a5e";
  const cx = 7;
  const cy = h / 2;
  const tipX = w - 5;
  const tipYs = [5, h / 2, h - 5];
  const branches = tipYs.map((ty, i) => {
    const color = t.palette[i % t.palette.length];
    const midX = (cx + tipX) / 2;
    let d: string;
    if (design.connectorStyle === "elbow") d = `M${cx} ${cy} H${midX} V${ty} H${tipX}`;
    else if (design.connectorStyle === "straight") d = `M${cx} ${cy} L${tipX} ${ty}`;
    else d = `M${cx} ${cy} Q${midX} ${cy} ${tipX} ${ty}`; // organic / curved
    return { d, color, tx: tipX, ty };
  });
  return { w, h, bg, rootBg, root: { cx, cy, r: 3.5 }, branches };
}
