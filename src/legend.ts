import { markerName } from "./icons";
import type { MindMapDoc } from "./model/types";
import { markerTagIndex } from "./outline";
import { describeRule } from "./rules";

// The map's legend — every marker, tag, and conditional-format rule actually in use, each with a
// readable meaning. Pure + deterministic; the on-canvas legend overlay and the SVG export both render
// these rows, so the legend reads identically on screen and in exports.

export interface LegendEntry {
  kind: "marker" | "tag" | "rule";
  /** Marker glyph (marker rows only). */
  icon?: string;
  /** The label shown beside the swatch. */
  label: string;
  /** A swatch colour (rule rows: the rule's fill/border colour). */
  color?: string;
}

/** Pull a `#rrggbb` (or `#rgb`) colour out of a CSS border shorthand, or null. */
function borderColor(border: string | undefined): string | null {
  const m = border?.match(/#[0-9a-f]{3,8}/i);
  return m ? m[0] : null;
}

/** Build the legend rows for a map: markers (named where known) → tags → conditional rules. Empty
 *  when the map uses none of them. Pure. */
export function buildLegend(doc: MindMapDoc): LegendEntry[] {
  const { markers, tags } = markerTagIndex(doc.root, doc.floatingTopics);
  const entries: LegendEntry[] = [];
  for (const m of markers)
    entries.push({ kind: "marker", icon: m.key, label: markerName(m.key) ?? m.key });
  for (const t of tags) entries.push({ kind: "tag", label: t.key });
  for (const r of doc.rules ?? [])
    entries.push({
      kind: "rule",
      label: describeRule(r),
      color:
        r.style.background ||
        borderColor(r.style.border) ||
        r.style.color ||
        r.branchColor ||
        undefined,
    });
  return entries;
}
