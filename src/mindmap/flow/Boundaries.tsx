import { ViewportPortal, useNodes } from "@xyflow/react";
import { type CSSProperties, memo, useMemo } from "react";
import type { Boundary } from "../../model/types";
import { type BoundaryShape, boundaryPath, dashArray } from "./geometry";
import {
  BOUNDARY_PAD,
  type ResolvedBoundaryStyle,
  boundaryLabel,
  resolveBoundaryStyle,
} from "./style";

// Filled boundary boxes, rendered in the flow coordinate space via ViewportPortal so they
// pan/zoom with the map. Each box is the padded bbox of its member nodes (read from their
// live measured rects), with a label chip — a MindManager-style enclosure. Geometry +
// colours come from ./style so the SVG export draws an identical box.

// Title-tab layout: a filled tab fused to the top edge of the outline (replacing the old floating
// pill). Colours come per-box from the resolved style, so a recoloured boundary re-tints its tab too.
const tabBase: CSSProperties = {
  position: "absolute",
  top: -19,
  left: 14,
  padding: "2px 9px",
  borderRadius: "7px 7px 0 0",
  fontSize: 11.5,
  fontWeight: 600,
  whiteSpace: "nowrap",
  color: "#fff",
};

/** One boundary box, resolved to its padded bbox in flow space + its shape / dash / colours. */
interface BoundaryBox {
  id: string;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
  shape: BoundaryShape | undefined;
  dash: "solid" | "dashed" | "dotted" | undefined;
  style: ResolvedBoundaryStyle;
}

// The clickable border rim (px). The box interior stays pointer-transparent (so enclosed nodes still
// drag + the marquee still works); only this thin frame + the label chip select the boundary.
const RIM = 6;
const RIM_SIDES = [
  { side: "top", style: { top: 0, left: 0, right: 0, height: RIM } },
  { side: "bottom", style: { bottom: 0, left: 0, right: 0, height: RIM } },
  { side: "left", style: { top: 0, bottom: 0, left: 0, width: RIM } },
  { side: "right", style: { top: 0, bottom: 0, right: 0, width: RIM } },
] as const;

function Boundaries({
  boundaries,
  selectedId,
  onSelect,
  onContextMenu,
  accent,
}: {
  boundaries: readonly Boundary[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Right-click a boundary → open its context menu (recolour / shape / delete). */
  onContextMenu?: (e: React.MouseEvent, id: string) => void;
  /** Map-wide accent (meta.accentColor): the default colour for boundaries with no own colour. */
  accent?: string;
}) {
  const nodes = useNodes();
  // Resolve each boundary's bbox once per node/boundary change instead of on every parent re-render
  // (panning, selection, menus, …). `nodes` gets a fresh reference whenever a member moves, so the
  // boxes still track drags live — same output, just not recomputed when nothing geometric changed.
  const boxes = useMemo<BoundaryBox[]>(() => {
    if (boundaries.length === 0) return [];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const out: BoundaryBox[] = [];
    for (const b of boundaries) {
      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      let found = 0;
      for (const id of b.nodeIds) {
        const n = byId.get(id);
        if (!n) continue;
        const w = n.measured?.width ?? 0;
        const h = n.measured?.height ?? 0;
        minX = Math.min(minX, n.position.x);
        minY = Math.min(minY, n.position.y);
        maxX = Math.max(maxX, n.position.x + w);
        maxY = Math.max(maxY, n.position.y + h);
        found += 1;
      }
      if (found === 0) continue;
      out.push({
        id: b.id,
        label: boundaryLabel(b.label),
        left: minX - BOUNDARY_PAD,
        top: minY - BOUNDARY_PAD,
        width: maxX - minX + 2 * BOUNDARY_PAD,
        height: maxY - minY + 2 * BOUNDARY_PAD,
        shape: b.shape,
        dash: b.dash,
        style: resolveBoundaryStyle(b.color, accent),
      });
    }
    return out;
  }, [nodes, boundaries, accent]);

  if (boxes.length === 0) return null;

  return (
    <ViewportPortal>
      {boxes.map((b) => {
        const selected = b.id === selectedId;
        const d = boundaryPath(b.shape, 0, 0, b.width, b.height);
        const gid = `bgrad-${b.id}`;
        const dash = dashArray(b.dash);
        const tab: CSSProperties = { ...tabBase, background: b.style.stroke };
        return (
          <div
            key={b.id}
            style={{
              position: "absolute",
              left: b.left,
              top: b.top,
              width: b.width,
              height: b.height,
              // The box itself never blocks pointer events — enclosed nodes keep dragging and the
              // marquee keeps working. The rim strips + tab below opt back in to catch selection.
              pointerEvents: "none",
            }}
          >
            {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative enclosure outline (aria-hidden) */}
            <svg
              width={b.width}
              height={b.height}
              style={{ position: "absolute", inset: 0, overflow: "visible" }}
              aria-hidden
            >
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={b.style.fillTop} />
                  <stop offset="1" stopColor={b.style.fillBottom} />
                </linearGradient>
              </defs>
              {/* Selection halo (view-only, additive — never exported, so canvas == export holds). */}
              {selected ? (
                <path d={d} fill="none" stroke={b.style.stroke} strokeWidth={5} opacity={0.35} />
              ) : null}
              <path
                d={d}
                fill={`url(#${gid})`}
                stroke={b.style.stroke}
                strokeWidth={1.5}
                strokeDasharray={dash || undefined}
              />
            </svg>
            {b.label ? (
              onSelect ? (
                <button
                  type="button"
                  className="nodrag nopan"
                  onClick={() => onSelect(b.id)}
                  onContextMenu={(e) => onContextMenu?.(e, b.id)}
                  title={`Select boundary "${b.label}"`}
                  style={{ ...tab, cursor: "pointer", pointerEvents: "auto", border: "none" }}
                >
                  {b.label}
                </button>
              ) : (
                <div style={tab}>{b.label}</div>
              )
            ) : null}
            {onSelect
              ? RIM_SIDES.map(({ side, style }) => (
                  <button
                    key={side}
                    type="button"
                    className="nodrag nopan"
                    aria-label={`Select boundary${b.label ? ` "${b.label}"` : ""}`}
                    onClick={() => onSelect(b.id)}
                    onContextMenu={(e) => onContextMenu?.(e, b.id)}
                    style={{
                      position: "absolute",
                      ...style,
                      padding: 0,
                      border: "none",
                      background: "transparent",
                      pointerEvents: "auto",
                      cursor: "pointer",
                    }}
                  />
                ))
              : null}
          </div>
        );
      })}
    </ViewportPortal>
  );
}

const MemoBoundaries = memo(Boundaries);
export { MemoBoundaries as Boundaries };
