// Visual constants shared by the live React Flow canvas and the SVG exporter, so the
// "canvas == export" invariant can't silently drift. The live components feed these into
// inline styles (with theme-var fallbacks for node fills); the exporter writes them as
// concrete SVG attributes. Anything a boundary box or a cross-link draws lives here once.

import type { FontScale } from "../../model/types";

// Cross-link / relationship edge (dashed floating bezier).
export const CROSSLINK_COLOR = "#8b87e0";
export const CROSSLINK_WIDTH = 1.5;
export const CROSSLINK_DASH = "6 4";
export const CROSSLINK_DOT = "2 4";

/** A relationship edge's resolved render values + arrowhead placement, defaults filled in. Computed
 *  once here so the live canvas edge (CrosslinkEdge) and the SVG exporter draw the byte-identical
 *  stroke + arrowheads — the canvas==export invariant. `dasharray` is "" for a solid line. */
export interface ResolvedLinkStyle {
  color: string;
  width: number;
  dasharray: string;
  arrowAtTarget: boolean;
  arrowAtSource: boolean;
}

/** Resolve a cross-link's optional style/arrow fields to concrete render values. Absent fields fall
 *  back to today's look (accent colour, 1.5px, dashed, a single arrowhead at the target). */
export function resolveLinkStyle(
  s: {
    color?: string;
    width?: number;
    dash?: "dashed" | "solid" | "dotted";
    arrow?: "to" | "from" | "both" | "none";
  },
  /** Map-wide accent (meta.accentColor): the default when this link has no explicit colour. */
  fallback?: string,
): ResolvedLinkStyle {
  const dash = s.dash ?? "dashed";
  const arrow = s.arrow ?? "to";
  return {
    color: s.color || fallback || CROSSLINK_COLOR,
    width: s.width || CROSSLINK_WIDTH,
    dasharray: dash === "solid" ? "" : dash === "dotted" ? CROSSLINK_DOT : CROSSLINK_DASH,
    arrowAtTarget: arrow === "to" || arrow === "both",
    arrowAtSource: arrow === "from" || arrow === "both",
  };
}

/** Level-based topic classification (MindManager reads hierarchy from shape alone): a depth-1 main is
 *  FILLED with the branch colour, depth-2 keeps the bordered card, and a depth-3+ leaf drops the box
 *  for a short branch-colour underline. A manual background/border always wins (the node reverts to a
 *  normal card). Single source for the live node (TopicNode) AND the SVG exporter so the two can never
 *  classify the same node differently — the canvas==export invariant; each maps these flags to its own
 *  CSS / SVG tokens. Pure. */
export function resolveLevelBox(p: {
  isRoot: boolean;
  geom: boolean;
  depth: number;
  style?: { background?: string; border?: string; fill?: string; fillImage?: string };
}): { filledMain: boolean; underlineLeaf: boolean } {
  const styled = !p.isRoot && !p.geom;
  // A branch-derived fill (tint/gradient) or an image fill renders the node as a normal card, like a
  // manual background.
  const filled = !!p.style?.background || !!p.style?.fill || !!p.style?.fillImage;
  return {
    filledMain: styled && p.depth === 1 && !filled,
    underlineLeaf: styled && p.depth >= 3 && !filled && !p.style?.border,
  };
}

// Optional raised-topic drop shadow (#4) — the same look on the live canvas (CSS box-shadow) and in
// the SVG export (a shared <filter> referenced by shadowed node fills), so canvas == export holds.
export const TOPIC_SHADOW_CSS = "0 2px 6px rgba(40,30,16,0.30)";
export const TOPIC_SHADOW_SVG_DEF =
  '<defs><filter id="mm-topic-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="#281e10" flood-opacity="0.3"/></filter></defs>';

// Boundary enclosure box.
export const BOUNDARY_PAD = 16;
export const BOUNDARY_STROKE = "#8b87e0";
export const BOUNDARY_FILL = "rgba(120,116,210,0.10)";

// Boundary label chip.
export const BOUNDARY_LABEL_BG = "#eceafb";
export const BOUNDARY_LABEL_BORDER = "#cecbf6";
export const BOUNDARY_LABEL_COLOR = "#26215c";

// Summary bracket (a labelled bracket beside a node's subtree). Green, to distinguish from the
// purple boundary box. Drawn to one side of the range, spanning its height + a small overhang.
export const SUMMARY_GAP = 22; // gap between the range edge and the bracket spine
export const SUMMARY_BRACKET_W = 10; // how far the bracket caps reach toward the nodes
export const SUMMARY_PAD = 10; // vertical overhang past the range's top/bottom
export const SUMMARY_STROKE = "#27852f";
export const SUMMARY_LABEL_BG = "#e2fbe8";
export const SUMMARY_LABEL_BORDER = "#9fd9ab";
export const SUMMARY_LABEL_COLOR = "#1e5a2a";

/** The label to draw for a summary (defaults to "Summary" when unset, since a summary IS a label). */
export function summaryLabel(label: string | undefined): string {
  return label?.trim() ? label : "Summary";
}

// Brace map connector — a "{" fork joining a parent to its children (the brace-map layout).
// Slate grey so it reads as structure, distinct from the green summary bracket.
export const BRACE_STROKE = "#6b7280";
export const BRACE_GAP = 22; // gap between the children's left edge and the brace spine

// Dedicated diagram backdrop (onion / funnel / Venn frame) drawn behind the topics.
export const BACKDROP_STROKE = "#9a93d6";
export const BACKDROP_FILL = "rgba(120,116,210,0.06)"; // faint tint (overlaps blend in Venn)

// Callout (anchored annotation bubble) — sticky-note yellow, readable on light + dark canvases.
export const CALLOUT_BG = "#fff8c5";
export const CALLOUT_STROKE = "#d4a72c";
export const CALLOUT_TEXT = "#3b2f00";

/**
 * The label to actually draw for a boundary. "summary" is the implicit default applied to
 * auto-created groupings, so it renders as no chip.
 */
export function boundaryLabel(label: string | undefined): string {
  return label && label !== "summary" ? label : "";
}

// ── Per-overlay colour resolvers ─────────────────────────────────────────────
// A picked overlay colour re-tints the whole object coherently. The same resolver feeds the live
// component (inline CSS) AND the SVG exporter, emitting identical strings (8-digit hex / 6-digit
// hex) so canvas == export holds. An absent colour returns the historical constants verbatim, so
// unstyled overlays are pixel-unchanged. Pure; non-hex inputs fall back gracefully.

const clampByte = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const parseHex = (hex: string): [number, number, number] | null => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((c) => clampByte(c).toString(16).padStart(2, "0")).join("")}`;

/** A #rrggbb colour at alpha `a` (0..1) as 8-digit #rrggbbaa; non-hex input returned verbatim. */
export function withAlpha(hex: string, a: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return `${toHex(...rgb)}${clampByte(a * 255)
    .toString(16)
    .padStart(2, "0")}`;
}
/** Mix `hex` toward `target` (#fff to lighten, #000 to darken) by `t` (0..1); non-hex → verbatim. */
export function mix(hex: string, target: string, t: number): string {
  const c = parseHex(hex);
  const tg = parseHex(target);
  if (!c || !tg) return hex;
  return toHex(c[0] + (tg[0] - c[0]) * t, c[1] + (tg[1] - c[1]) * t, c[2] + (tg[2] - c[2]) * t);
}
/** Default topic font size by depth — the central topic is largest, mains a step down, subtopics
 *  smaller — so the hierarchy reads from type size as well as shape (MindManager). A manual
 *  NodeStyle.fontSize always overrides this. Shared by the layout estimate, the canvas, and the
 *  exporter so all three agree. */
export function levelFontSize(depth: number): number {
  if (depth <= 0) return 20; // root
  if (depth === 1) return 16; // main topics
  if (depth === 2) return 14;
  return 13; // depth 3+
}

/** Multiplier for the map's font-size scale, applied on top of `levelFontSize`. "comfortable" (the
 *  default, including when unset) is 1×. Shared by the layout estimate, the canvas, and the exporter
 *  so all three reserve + render the same type size. */
export function fontScaleFactor(scale: FontScale | undefined): number {
  if (scale === "compact") return 0.85;
  if (scale === "large") return 1.2;
  return 1; // comfortable / unset
}

/** Black or white text that stays readable on a filled `hex` background (WCAG relative luminance).
 *  Used for the level-1 "main topic" pill, whose body is the branch colour rather than white. Non-hex
 *  input → dark text. Shared by the canvas node + the exporter so a filled topic reads the same. */
export function readableTextOn(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return "#1a1a1a";
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  return lum > 0.5 ? "#1a1a1a" : "#ffffff";
}

export type TopicFillMode = "tint" | "gradient";

export interface ResolvedTopicFill {
  /** CSS `background` value for the live rectangular card (a solid colour or a `linear-gradient`). */
  css: string;
  /** A single representative colour — used as the geometric-shape fill and the SVG solid fallback. */
  solid: string;
  /** Gradient stops when the mode is `gradient` (the exporter draws a per-node `<linearGradient>`),
   *  else null. */
  gradient: { top: string; bottom: string } | null;
  /** Black/white text that stays readable on this fill. */
  text: string;
}

/** Resolve a topic's branch-derived fill (tint / gradient) to concrete render values, or null when no
 *  fill mode is set (the caller then keeps today's flat-fill path). The base colour is the topic's
 *  explicit `background` when present, otherwise its `branchColor`. Pure + shared by the live canvas
 *  node and the SVG exporter so a filled topic looks identical in both (canvas == export). */
export function resolveTopicFill(p: {
  mode?: TopicFillMode;
  background?: string;
  branchColor: string;
}): ResolvedTopicFill | null {
  if (!p.mode) return null;
  const base = p.background || p.branchColor;
  if (p.mode === "tint") {
    const solid = mix(base, "#ffffff", 0.8);
    return { css: solid, solid, gradient: null, text: readableTextOn(solid) };
  }
  const top = mix(base, "#ffffff", 0.24);
  const bottom = mix(base, "#000000", 0.08);
  return {
    css: `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`,
    solid: base,
    gradient: { top, bottom },
    text: readableTextOn(base),
  };
}

export interface ResolvedBoundaryStyle {
  stroke: string;
  fill: string;
  /** Soft gradient stops (lighter top → slightly deeper bottom) for a panel-like fill. */
  fillTop: string;
  fillBottom: string;
  labelBg: string;
  labelBorder: string;
  labelColor: string;
}
/** Boundary stroke + fill tint (+ gradient stops) + label-chip colours from an optional override, or
 *  the map-wide accent `fallback` (meta.accentColor) when the boundary has no own colour. With neither,
 *  the historical purple constants are returned verbatim (unstyled maps are pixel-unchanged). */
export function resolveBoundaryStyle(color?: string, fallback?: string): ResolvedBoundaryStyle {
  const accent = color || fallback;
  const base = accent || BOUNDARY_STROKE;
  return {
    stroke: base,
    fill: accent ? withAlpha(accent, 0.1) : BOUNDARY_FILL,
    fillTop: withAlpha(base, 0.05),
    fillBottom: withAlpha(base, 0.16),
    labelBg: accent ? mix(accent, "#ffffff", 0.85) : BOUNDARY_LABEL_BG,
    labelBorder: accent ? mix(accent, "#ffffff", 0.55) : BOUNDARY_LABEL_BORDER,
    labelColor: accent ? mix(accent, "#000000", 0.55) : BOUNDARY_LABEL_COLOR,
  };
}

export interface ResolvedSummaryStyle {
  stroke: string;
  labelBg: string;
  labelBorder: string;
  labelColor: string;
}
/** Summary bracket stroke + label-chip colours from an optional override (no fill — open bracket). */
export function resolveSummaryStyle(color?: string): ResolvedSummaryStyle {
  if (!color)
    return {
      stroke: SUMMARY_STROKE,
      labelBg: SUMMARY_LABEL_BG,
      labelBorder: SUMMARY_LABEL_BORDER,
      labelColor: SUMMARY_LABEL_COLOR,
    };
  return {
    stroke: color,
    labelBg: mix(color, "#ffffff", 0.85),
    labelBorder: mix(color, "#ffffff", 0.55),
    labelColor: mix(color, "#000000", 0.55),
  };
}

export interface ResolvedCalloutStyle {
  bg: string;
  stroke: string;
  text: string;
  connector: string;
}
/** Callout bubble bg + stroke + text + connector from an optional override (the colour = accent). */
export function resolveCalloutStyle(color?: string): ResolvedCalloutStyle {
  if (!color)
    return {
      bg: CALLOUT_BG,
      stroke: CALLOUT_STROKE,
      text: CALLOUT_TEXT,
      connector: CALLOUT_STROKE,
    };
  return {
    bg: mix(color, "#ffffff", 0.82),
    stroke: color,
    text: mix(color, "#000000", 0.6),
    connector: color,
  };
}

export interface ResolvedBackdropStyle {
  stroke: string;
  fill: string;
}
/** Diagram-backdrop stroke + fill tint from an optional override. */
export function resolveBackdropStyle(color?: string): ResolvedBackdropStyle {
  if (!color) return { stroke: BACKDROP_STROKE, fill: BACKDROP_FILL };
  return { stroke: color, fill: withAlpha(color, 0.06) };
}
