import type { MapNode, MindMapDoc } from "../../model/types";
import { type Rect, r2 } from "./geometry";
import { BRACE_GAP } from "./style";

// Brace-map connectors: a "{" fork joining a parent to its children, the Thinking-Maps brace.
// Pure geometry shared by the on-canvas overlay (BraceConnectors) and the SVG exporter, so the
// screen and the export stay identical. A fork is a vertical spine spanning the children's
// centres, a horizontal stub from the spine to each child, and a tee from the parent to the spine.

/** One brace group: a parent and the children it forks to (visible children only). */
export interface BraceGroup {
  parentId: string;
  childIds: string[];
}

export interface BraceGeometry {
  spineX: number;
  spineTop: number;
  spineBottom: number;
  parentRightX: number;
  parentTeeY: number;
  stubs: { y: number; fromX: number; toX: number }[];
}

/** Resolve a parent + its children rects into the fork's line coordinates (flow space). */
export function braceGeometry(parent: Rect, children: Rect[]): BraceGeometry {
  const centerY = (c: Rect) => c.y + c.h / 2;
  const ys = children.map(centerY);
  const spineTop = Math.min(...ys);
  const spineBottom = Math.max(...ys);
  const childrenLeft = Math.min(...children.map((c) => c.x));
  const spineX = childrenLeft - BRACE_GAP;
  // The parent tee joins the spine at the parent's centre, clamped into the spine's span.
  const parentTeeY = Math.min(spineBottom, Math.max(spineTop, parent.y + parent.h / 2));
  return {
    spineX,
    spineTop,
    spineBottom,
    parentRightX: parent.x + parent.w,
    parentTeeY,
    stubs: children.map((c) => ({ y: centerY(c), fromX: spineX, toX: c.x })),
  };
}

/** The fork as an SVG path `d` (spine + child stubs + parent tee), absolute coords — for export. */
export function bracePath(g: BraceGeometry): string {
  const segs = [
    `M ${r2(g.parentRightX)} ${r2(g.parentTeeY)} L ${r2(g.spineX)} ${r2(g.parentTeeY)}`,
    `M ${r2(g.spineX)} ${r2(g.spineTop)} L ${r2(g.spineX)} ${r2(g.spineBottom)}`,
  ];
  for (const s of g.stubs) segs.push(`M ${r2(s.fromX)} ${r2(s.y)} L ${r2(s.toX)} ${r2(s.y)}`);
  return segs.join(" ");
}

/** Walk the doc for every visible parent→children grouping (the brace-map forks). */
export function computeBraces(doc: MindMapDoc): BraceGroup[] {
  const out: BraceGroup[] = [];
  const walk = (n: MapNode): void => {
    if (!n.collapsed && n.children.length > 0) {
      out.push({ parentId: n.id, childIds: n.children.map((c) => c.id) });
      for (const c of n.children) walk(c);
    }
  };
  walk(doc.root);
  for (const f of doc.floatingTopics ?? []) walk(f);
  return out;
}
