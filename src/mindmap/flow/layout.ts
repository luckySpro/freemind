import { hierarchy, tree } from "d3-hierarchy";
import type { LayoutKind } from "../contract";
import { levelFontSize } from "./style";
import { widthUnits, wrapText } from "./text";
import type { FlowEdge, TopicNode } from "./types";

// Position the projected nodes for a given layout. Tree-based kinds (side/left/right/
// org-down/org-up/radial) are tidy trees from d3-hierarchy, oriented differently; timeline
// and fishbone are hand-written. Pure + deterministic given node sizes (unit-tested). This
// is the heart of the alternate-layout feature the engine migration unlocks.

export interface LayoutSize {
  width: number;
  height: number;
}
export type SizeOf = (id: string) => LayoutSize;

export interface Point {
  x: number;
  y: number;
}

const COL_GAP = 64; // horizontal gap between depth columns
const ROW_GAP = 18; // vertical gap between sibling slots (horizontal layouts)
const VROW_GAP = 56; // vertical gap between depth rows (vertical layouts)
const VCOL_GAP = 26; // horizontal gap between siblings (vertical layouts)
const GRID_GAP = 90; // gap between grid/matrix cells
const FLOAT_GAP = 48;
const DEFAULT_SIZE: LayoutSize = { width: 120, height: 36 };

/** Estimate a node's rendered size from its content (used before React Flow measures it). */
export function estimateSizeOf(nodes: TopicNode[]): SizeOf {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  // Memoise per id: the returned size is a pure function of the node's data, but sizeOf is invoked many
  // times per layout pass (and for every unmeasured node on first render), so without this each call
  // re-ran wrapText. Same values, just computed once.
  const cache = new Map<string, LayoutSize>();
  return (id) => {
    const cached = cache.get(id);
    if (cached) return cached;
    const d = byId.get(id)?.data;
    if (!d) return DEFAULT_SIZE;
    // Size scales with the per-depth font (root largest → deep leaves smallest) AND the map-wide
    // typography scale, so the layout reserves the right slot before React Flow measures the node.
    const fs = levelFontSize(d.depth) * (d.fontScale ?? 1);
    const rawLines = d.topic.split("\n");
    const longest = Math.max(1, ...rawLines.map((l) => widthUnits(l)));
    // Markers now sit in their own fixed-height row above the title (~16px tiles).
    const markerRow = d.icons?.length ? 18 : 0;
    // Per-topic wrap width caps the estimate (and re-wraps for height) so a constrained topic reserves
    // the right slot before React Flow measures it.
    const cap = d.style?.maxWidth ? Number.parseFloat(d.style.maxWidth) : undefined;
    let width = Math.min(
      320,
      Math.max(64, longest * fs * 0.46 + 30, (d.icons?.length ?? 0) * 16 + 12),
    );
    if (cap && Number.isFinite(cap)) width = Math.min(width, Math.max(64, cap));
    // Reserve height for the WRAPPED line count (the box wraps at ~width), not just the explicit
    // newlines — so a long single-line topic that wraps on screen doesn't overflow its reserved box.
    const wrapped = wrapText(d.topic, Math.max(16, width - 30), fs);
    const height =
      (d.image ? 130 : 0) +
      markerRow +
      wrapped.length * (fs * 1.25) +
      16 +
      (d.tags?.length ? 22 : 0);
    const size = { width, height };
    cache.set(id, size);
    return size;
  };
}

interface Ctx {
  nodes: TopicNode[];
  byId: Map<string, TopicNode>;
  branchChildren: Map<string, string[]>;
  root: TopicNode;
  size: SizeOf;
  positions: Map<string, Point>;
}

/** Lay out the nodes for `kind`. A node carrying a `data.layout` override lays its OWN subtree out
 *  with that kind (sized as a single blob in the main pass) — the per-branch-layout feature. With
 *  no overrides this is exactly computeLayoutPlain, so the common path can't regress. */
export function computeLayout(
  nodes: TopicNode[],
  edges: FlowEdge[],
  sizeOf: SizeOf = () => DEFAULT_SIZE,
  kind: LayoutKind = "side",
): Map<string, Point> {
  const overrideRoots =
    kind === "freeform"
      ? []
      : nodes.filter((n) => n.data.layout && !n.data.isRoot && n.data.layout !== kind);
  return overrideRoots.length === 0
    ? computeLayoutPlain(nodes, edges, sizeOf, kind)
    : computeLayoutComposite(nodes, edges, sizeOf, kind, overrideRoots);
}

// Per-branch layout: each override root lays its subtree out with its own kind; the main pass
// reserves a single blob sized to that sub-layout's bounding box, then the subtree is translated
// onto the blob. Naturally recursive (a nested override is resolved by the sub-call) and additive
// (zero effect when nothing carries an override).
function computeLayoutComposite(
  nodes: TopicNode[],
  edges: FlowEdge[],
  sizeOf: SizeOf,
  kind: LayoutKind,
  overrideRoots: TopicNode[],
): Map<string, Point> {
  const sizeFn: SizeOf = (id) => {
    const s = sizeOf(id);
    return { width: s.width || DEFAULT_SIZE.width, height: s.height || DEFAULT_SIZE.height };
  };
  const childrenOf = new Map<string, string[]>();
  for (const e of edges) {
    if (e.data?.crosslink) continue;
    const arr = childrenOf.get(e.source);
    if (arr) arr.push(e.target);
    else childrenOf.set(e.source, [e.target]);
  }
  const subtreeIds = (rootId: string): Set<string> => {
    const out = new Set<string>();
    const walk = (id: string): void => {
      out.add(id);
      for (const c of childrenOf.get(id) ?? []) walk(c);
    };
    walk(rootId);
    return out;
  };

  const excluded = new Set<string>(); // override-subtree descendants (the roots stay in the main pass)
  const subs = new Map<
    string,
    { pos: Map<string, Point>; minX: number; minY: number; w: number; h: number }
  >();
  for (const orNode of overrideRoots) {
    const ids = subtreeIds(orNode.id);
    for (const id of ids) if (id !== orNode.id) excluded.add(id);
    // Sub-layout the subtree as its own little map: rebase depth so the override root is depth 0
    // (the layouts index by depth from 0), flag it isRoot, and consume its override.
    const baseDepth = orNode.data.depth;
    const subNodes = nodes
      .filter((n) => ids.has(n.id))
      .map((n) => ({
        ...n,
        data: {
          ...n.data,
          depth: n.data.depth - baseDepth,
          ...(n.id === orNode.id ? { isRoot: true, layout: undefined } : {}),
        },
      }));
    const subEdges = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    const pos = computeLayout(subNodes, subEdges, sizeOf, orNode.data.layout as LayoutKind);
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const [id, p] of pos) {
      const s = sizeFn(id);
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + s.width);
      maxY = Math.max(maxY, p.y + s.height);
    }
    if (!Number.isFinite(minX)) {
      minX = 0;
      minY = 0;
      maxX = 0;
      maxY = 0;
    }
    subs.set(orNode.id, { pos, minX, minY, w: maxX - minX, h: maxY - minY });
  }

  // Main pass: drop the override descendants; size each override root as its blob; lay out normally.
  const mainNodes = nodes
    .filter((n) => !excluded.has(n.id))
    .map((n) => (subs.has(n.id) ? { ...n, data: { ...n.data, layout: undefined } } : n));
  const mainEdges = edges.filter((e) => !excluded.has(e.source) && !excluded.has(e.target));
  const mainSizeOf: SizeOf = (id) => {
    const sub = subs.get(id);
    return sub ? { width: sub.w, height: sub.h } : sizeOf(id);
  };
  const mainPos = computeLayout(mainNodes, mainEdges, mainSizeOf, kind);

  // Translate each sub-layout so its bbox top-left lands on the blob the main pass reserved.
  const out = new Map<string, Point>(mainPos);
  for (const [rootId, sub] of subs) {
    const anchor = mainPos.get(rootId);
    if (!anchor) continue;
    const tx = anchor.x - sub.minX;
    const ty = anchor.y - sub.minY;
    for (const [id, p] of sub.pos) out.set(id, { x: p.x + tx, y: p.y + ty });
  }
  return out;
}

function computeLayoutPlain(
  nodes: TopicNode[],
  edges: FlowEdge[],
  sizeOf: SizeOf = () => DEFAULT_SIZE,
  kind: LayoutKind = "side",
): Map<string, Point> {
  const size: SizeOf = (id) => {
    const s = sizeOf(id);
    return { width: s.width || DEFAULT_SIZE.width, height: s.height || DEFAULT_SIZE.height };
  };
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const branchChildren = new Map<string, string[]>();
  for (const e of edges) {
    if (e.data?.crosslink) continue;
    const list = branchChildren.get(e.source) ?? [];
    list.push(e.target);
    branchChildren.set(e.source, list);
  }
  const root = nodes.find((n) => n.data.isRoot);
  const positions = new Map<string, Point>();
  if (!root) return positions;
  const ctx: Ctx = { nodes, byId, branchChildren, root, size, positions };

  // Free-canvas mode owns positions outright (each node's `pos`), so it bypasses the auto-layouts
  // and the floating placement entirely.
  if (kind === "freeform") {
    layoutFreeform(ctx);
    return positions;
  }

  switch (kind) {
    case "left":
      layoutHorizontal(ctx, -1, root.data.collapsed ? [] : (branchChildren.get(root.id) ?? []));
      break;
    case "right":
      layoutHorizontal(ctx, 1, root.data.collapsed ? [] : (branchChildren.get(root.id) ?? []));
      break;
    case "org-down":
      layoutVertical(ctx, 1);
      break;
    case "org-up":
      layoutVertical(ctx, -1);
      break;
    case "radial":
      layoutRadial(ctx);
      break;
    case "timeline":
      layoutTimeline(ctx);
      break;
    case "fishbone":
      layoutFishbone(ctx);
      break;
    case "grid":
      layoutGrid(ctx);
      break;
    case "swimlane":
      // Each top branch becomes a labelled vertical lane (its level-1 topic is the lane header),
      // all lanes in a single row — a comparison / kanban-style arrangement.
      layoutGrid(ctx, { singleRow: true });
      break;
    case "brace":
      // A brace map is a left-to-right tidy tree; the "{" fork connectors replace the ribbons.
      layoutHorizontal(ctx, 1, root.data.collapsed ? [] : (branchChildren.get(root.id) ?? []));
      break;
    default:
      layoutSide(ctx);
  }

  placeFloating(ctx, edges);
  return positions;
}

/** A tidy tree's breadth (centre, normalised so the root is 0) + depth per node. */
function tidy(
  rootId: string,
  childrenOf: (id: string) => string[],
  breadthSlot: number,
): Map<string, { breadth: number; depth: number }> {
  const h = hierarchy<string>(rootId, childrenOf);
  tree<string>().nodeSize([breadthSlot, 1])(h);
  const rootBreadth = h.x ?? 0;
  const out = new Map<string, { breadth: number; depth: number }>();
  for (const d of h.descendants())
    out.set(d.data, { breadth: (d.x ?? 0) - rootBreadth, depth: d.depth });
  return out;
}

/** Lay out a tidy tree from `rootId`. Two MindManager-isms vs a plain grid:
 *  • breadth (cross-axis) spacing is PROPORTIONAL to each node's size — a tall image topic reserves
 *    more room while one-line siblings pack tight, instead of every sibling slot being as tall as the
 *    single biggest node in the map; and
 *  • the major axis (depth) is accumulated PER SUBTREE — each child hangs just past its OWN parent's
 *    edge, so a short-label branch stays tight and a long label only pushes its own descendants out
 *    (not one global column per depth across unrelated branches).
 *
 *  Breadth is assigned by reserving each subtree a DISJOINT band sized to its own extent (post-order
 *  measure, pre-order placement), rather than d3's tidy contour packing. Contour packing assumes one
 *  uniform major column per depth; once the major axis is accumulated per-subtree (with wildly varying
 *  node widths), a short subtree that d3 nestles into a tall neighbour's concavity can land at a major
 *  position that OVERLAPS it. A full band per subtree keeps the two MindManager-isms above AND
 *  guarantees no two boxes overlap at any depth: non-ancestor nodes are always in disjoint bands, and
 *  ancestor/descendant pairs are always separated on the major axis.
 *
 *  `orientation` picks which axis is breadth vs major; `sign` flips direction (left / up). Pure. */
function layoutTidyTree(
  ctx: Ctx,
  rootId: string,
  childrenOf: (id: string) => string[],
  orientation: "horizontal" | "vertical",
  sign: 1 | -1,
): void {
  const { size } = ctx;
  const horizontal = orientation === "horizontal";
  const breadthGap = horizontal ? ROW_GAP : VCOL_GAP;
  const majorGap = horizontal ? COL_GAP : VROW_GAP;
  const breadthOf = (id: string) => (horizontal ? size(id).height : size(id).width);
  const majorOf = (id: string) => (horizontal ? size(id).width : size(id).height);

  // Post-order: each subtree's breadth extent is the greater of the node's own breadth and its
  // children's stacked breadth (heights + gaps). Memoised so the pre-order pass reuses it.
  const extent = new Map<string, number>();
  const measure = (id: string): number => {
    let stacked = 0;
    const kids = childrenOf(id);
    kids.forEach((k, i) => {
      stacked += measure(k);
      if (i > 0) stacked += breadthGap;
    });
    const e = Math.max(breadthOf(id), stacked);
    extent.set(id, e);
    return e;
  };
  measure(rootId);

  // Pre-order: centre each node in its band; stack its children's (disjoint) bands within it. The
  // root's band is centred on 0 so the tree grows symmetrically around the hub.
  const breadth = new Map<string, number>();
  const assignBreadth = (id: string, centre: number): void => {
    breadth.set(id, centre);
    const kids = childrenOf(id);
    if (kids.length === 0) return;
    let span = 0;
    kids.forEach((k, i) => {
      span += extent.get(k) ?? 0;
      if (i > 0) span += breadthGap;
    });
    let cursor = centre - span / 2;
    for (const k of kids) {
      const e = extent.get(k) ?? 0;
      assignBreadth(k, cursor + e / 2);
      cursor += e + breadthGap;
    }
  };
  assignBreadth(rootId, 0);

  // Per-subtree major offset: each node sits one (half-parent + gap + half-self) past its parent.
  const major = new Map<string, number>();
  const assignMajor = (id: string, m: number): void => {
    major.set(id, m);
    for (const k of childrenOf(id))
      assignMajor(k, m + sign * (majorOf(id) / 2 + majorGap + majorOf(k) / 2));
  };
  assignMajor(rootId, 0);

  for (const [id, b] of breadth) {
    const m = major.get(id) ?? 0;
    if (horizontal) place(ctx, id, m, b);
    else place(ctx, id, b, m);
  }
}

/** Cumulative centre offset per depth, sized to the widest extent at each depth. */
function depthCenters(maxExtent: number[], gap: number): number[] {
  const centers: number[] = [0];
  for (let d = 1; d < maxExtent.length; d++) {
    centers[d] = centers[d - 1] + (maxExtent[d - 1] ?? 0) / 2 + gap + (maxExtent[d] ?? 0) / 2;
  }
  return centers;
}

function maxExtentAtDepth(ctx: Ctx, axis: "w" | "h"): number[] {
  const out: number[] = [];
  for (const n of ctx.nodes) {
    if (n.data.floating) continue;
    const s = ctx.size(n.id);
    const v = axis === "w" ? s.width : s.height;
    out[n.data.depth] = Math.max(out[n.data.depth] ?? 0, v);
  }
  return out;
}

function place(ctx: Ctx, id: string, cx: number, cy: number): void {
  const s = ctx.size(id);
  ctx.positions.set(id, { x: cx - s.width / 2, y: cy - s.height / 2 });
}

// --- side (two-sided radial, the default) ----------------------------------
function layoutSide(ctx: Ctx): void {
  const { root, branchChildren, byId } = ctx;
  const kids = root.data.collapsed ? [] : (branchChildren.get(root.id) ?? []);
  const right = kids.filter((id) => byId.get(id)?.data.side !== "left");
  const left = kids.filter((id) => byId.get(id)?.data.side === "left");
  for (const [kidsOnSide, sign] of [
    [right, 1],
    [left, -1],
  ] as const) {
    layoutTidyTree(
      ctx,
      root.id,
      (id) => (id === root.id ? kidsOnSide : (branchChildren.get(id) ?? [])),
      "horizontal",
      sign,
    );
  }
  // The root is shared by both side-passes; pin it at the origin (it's also where the breadth-0
  // root lands, so this only makes the intent explicit and covers the no-children case).
  place(ctx, root.id, 0, 0);
}

// --- left / right (single-sided horizontal tidy tree) ----------------------
function layoutHorizontal(ctx: Ctx, sign: 1 | -1, rootKids: string[]): void {
  const { root, branchChildren } = ctx;
  layoutTidyTree(
    ctx,
    root.id,
    (id) => (id === root.id ? rootKids : (branchChildren.get(id) ?? [])),
    "horizontal",
    sign,
  );
}

// --- org-down / org-up (vertical tidy tree) --------------------------------
function layoutVertical(ctx: Ctx, sign: 1 | -1): void {
  const { root, branchChildren } = ctx;
  const kids = root.data.collapsed ? [] : (branchChildren.get(root.id) ?? []);
  layoutTidyTree(
    ctx,
    root.id,
    (id) => (id === root.id ? kids : (branchChildren.get(id) ?? [])),
    "vertical",
    sign,
  );
}

// --- grid / matrix (root's branches tiled in a grid; SWOT / 2x2 / Eisenhower) ----------
// Each first-level branch is laid out as its own small downward tidy tree (a "cell"); the cells
// are tiled into a grid (4 branches → 2×2), with the root as a title centred above. Recognisable
// for SWOT, Eisenhower, and other matrix frames built as a 4-branch map.
function layoutGrid(ctx: Ctx, opts?: { singleRow?: boolean }): void {
  const { root, branchChildren } = ctx;
  const kids = root.data.collapsed ? [] : (branchChildren.get(root.id) ?? []);
  if (kids.length === 0) {
    place(ctx, root.id, 0, 0);
    return;
  }
  const cellMaxW = Math.max(DEFAULT_SIZE.width, ...maxExtentAtDepth(ctx, "w"));
  const cellMaxH = Math.max(DEFAULT_SIZE.height, ...maxExtentAtDepth(ctx, "h"));
  const rowGap = cellMaxH + VROW_GAP;
  const slot = cellMaxW + VCOL_GAP;

  // One downward tidy tree per branch (breadth normalised so the branch root is at 0).
  const cells = kids.map((kidId) => {
    const local = tidy(kidId, (id) => branchChildren.get(id) ?? [], slot);
    let halfBreadth = 0;
    let depth = 0;
    for (const [, b] of local) {
      halfBreadth = Math.max(halfBreadth, Math.abs(b.breadth));
      depth = Math.max(depth, b.depth);
    }
    return { local, halfW: halfBreadth + cellMaxW / 2, depth };
  });
  const cellW = 2 * Math.max(...cells.map((c) => c.halfW));
  const cellH = Math.max(...cells.map((c) => c.depth)) * rowGap + cellMaxH;
  // Swimlane = one row of lanes (each top branch its own column); grid/matrix = a √N square tiling.
  const cols = opts?.singleRow ? cells.length : Math.ceil(Math.sqrt(cells.length));

  cells.forEach((cell, i) => {
    const colCenterX = (i % cols) * (cellW + GRID_GAP) + cellW / 2;
    const rowTopY = Math.floor(i / cols) * (cellH + GRID_GAP);
    for (const [id, b] of cell.local) {
      place(ctx, id, colCenterX + b.breadth, rowTopY + b.depth * rowGap);
    }
  });

  // Title (root) centred above the whole grid.
  const gridW = cols * cellW + (cols - 1) * GRID_GAP;
  place(ctx, root.id, gridW / 2, -rowGap);
}

// --- freeform / whiteboard (each node at its own `pos`; the user owns positions) -------
// `pos` is top-left (matching React Flow's node.position), so it's stored verbatim — no centre
// conversion. A node added after entering freeform has no `pos` yet: fall back to an offset beside
// its parent (siblings stacked down), or a cascade for a parentless (floating) root. Nodes are in
// tree order (parents before children), so a parent is always positioned before its children.
function layoutFreeform(ctx: Ctx): void {
  const { nodes, branchChildren, size, positions } = ctx;
  const parentOf = new Map<string, string>();
  for (const [p, kids] of branchChildren) for (const k of kids) parentOf.set(k, p);
  const placedKids = new Map<string, number>();
  let cascade = 0;
  for (const n of nodes) {
    const p = n.data.pos;
    if (p) {
      positions.set(n.id, { x: p.x, y: p.y });
      continue;
    }
    const parent = parentOf.get(n.id);
    const pp = parent ? positions.get(parent) : undefined;
    if (parent && pp) {
      const k = placedKids.get(parent) ?? 0;
      placedKids.set(parent, k + 1);
      positions.set(n.id, { x: pp.x + size(parent).width + 48, y: pp.y + k * 56 });
    } else {
      positions.set(n.id, { x: cascade * 60, y: cascade * 60 });
      cascade += 1;
    }
  }
}

// --- radial (hub: root centred, descendants on rings by depth) -------------
function layoutRadial(ctx: Ctx): void {
  const { root, branchChildren, size } = ctx;
  const kids = root.data.collapsed ? [] : (branchChildren.get(root.id) ?? []);
  const h = hierarchy<string>(root.id, (id) =>
    id === root.id ? kids : (branchChildren.get(id) ?? []),
  );
  tree<string>()
    .nodeSize([1, 1])
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.5))(h);
  const xs = h.descendants().map((d) => d.x ?? 0);
  const minX = Math.min(...xs);
  const span = Math.max(...xs) - minX || 1;
  let maxNode = DEFAULT_SIZE.width;
  for (const n of ctx.nodes) maxNode = Math.max(maxNode, size(n.id).width, size(n.id).height);
  const ring = maxNode + 90;
  for (const d of h.descendants()) {
    if (d.depth === 0) {
      place(ctx, d.data, 0, 0);
      continue;
    }
    // Leave a small angular gap so the first and last branches don't touch.
    const angle = (((d.x ?? 0) - minX) / span) * 2 * Math.PI * 0.92 - Math.PI / 2;
    const radius = d.depth * ring;
    place(ctx, d.data, radius * Math.cos(angle), radius * Math.sin(angle));
  }
}

// --- timeline (level-1 branches along an axis, subtrees hanging below) ------
function layoutTimeline(ctx: Ctx): void {
  const { root, branchChildren, size } = ctx;
  const kids = root.data.collapsed ? [] : (branchChildren.get(root.id) ?? []);
  const maxW = Math.max(DEFAULT_SIZE.width, ...maxExtentAtDepth(ctx, "w"));
  const rowY = depthCenters(maxExtentAtDepth(ctx, "h"), VROW_GAP);
  let cursorX = 0;
  for (const kid of kids) {
    // Lay this branch out as a vertical (org-down) subtree, then pack it left→right.
    const breadth = tidy(kid, (id) => branchChildren.get(id) ?? [], maxW + VCOL_GAP);
    let minB = Number.POSITIVE_INFINITY;
    let maxB = Number.NEGATIVE_INFINITY;
    for (const b of breadth.values()) {
      minB = Math.min(minB, b.breadth);
      maxB = Math.max(maxB, b.breadth);
    }
    const subWidth = maxB - minB + maxW;
    const offsetX = cursorX - minB + maxW / 2;
    for (const [id, b] of breadth) {
      // depth here is relative to the branch root (kid). Shift down one row (below root).
      place(ctx, id, b.breadth + offsetX, rowY[(b.depth ?? 0) + 1] ?? (b.depth + 1) * 80);
    }
    cursorX += subWidth + COL_GAP;
  }
  // Root sits to the left, vertically centred on the timeline row.
  place(ctx, root.id, -(size(root.id).width / 2 + COL_GAP), rowY[1] ?? 80);
}

// --- fishbone (Ishikawa: spine with diagonal bones) ------------------------
function layoutFishbone(ctx: Ctx): void {
  const { root, branchChildren } = ctx;
  const kids = root.data.collapsed ? [] : (branchChildren.get(root.id) ?? []);
  place(ctx, root.id, 0, 0); // head at the right end of the spine
  const maxW = Math.max(DEFAULT_SIZE.width, ...maxExtentAtDepth(ctx, "w"));
  const maxH = Math.max(DEFAULT_SIZE.height, ...maxExtentAtDepth(ctx, "h"));
  const spineStep = maxW + COL_GAP * 1.5;
  // Bones run as true diagonals off the horizontal spine (~60°); sub-causes step OUTWARD along the
  // bone (parallel to it), not straight down — the recognisable Ishikawa shape.
  const ux = -Math.cos(Math.PI / 3); // leftward component along the bone
  const uy = Math.sin(Math.PI / 3); // vertical component (× up/down)
  const step = maxH + 26; // box spacing along the bone
  kids.forEach((kid, i) => {
    const spineX = -((Math.floor(i / 2) + 1) * spineStep);
    const up = i % 2 === 0 ? -1 : 1;
    // Main cause near the spine attachment; its descendants (sub-causes at ANY depth) continue
    // outward along the same diagonal in DFS order — each one box-step further than the last, so
    // nothing collapses onto the spine head (depth ≥3 used to get no position at all).
    place(ctx, kid, spineX + ux * step, up * uy * step);
    let slot = 2;
    const walk = (id: string): void => {
      for (const c of branchChildren.get(id) ?? []) {
        const d = slot * step;
        slot += 1;
        place(ctx, c, spineX + ux * d, up * uy * d);
        walk(c);
      }
    };
    walk(kid);
  });
}

// --- floating subtrees: stacked below whatever the main layout produced -----
function placeFloating(ctx: Ctx, edges: FlowEdge[]): void {
  const { branchChildren, size, positions, nodes } = ctx;
  const floatingRoots = nodes.filter(
    (n) => n.data.floating && !edges.some((e) => !e.data?.crosslink && e.target === n.id),
  );
  if (floatingRoots.length === 0) return;
  const maxW = Math.max(DEFAULT_SIZE.width, ...nodes.map((n) => size(n.id).width));
  const slot = Math.max(DEFAULT_SIZE.height, ...nodes.map((n) => size(n.id).height)) + ROW_GAP;
  let bottom = Math.max(0, ...[...positions.values()].map((p) => p.y));
  for (const fRoot of floatingRoots) {
    const breadth = tidy(fRoot.id, (id) => branchChildren.get(id) ?? [], slot);
    let minB = Number.POSITIVE_INFINITY;
    let maxB = Number.NEGATIVE_INFINITY;
    for (const b of breadth.values()) {
      minB = Math.min(minB, b.breadth);
      maxB = Math.max(maxB, b.breadth);
    }
    const offset = bottom + slot + FLOAT_GAP - minB;
    for (const [id, b] of breadth) place(ctx, id, b.depth * (maxW + COL_GAP), b.breadth + offset);
    bottom += maxB - minB + slot + FLOAT_GAP;
  }
}
