import { t } from "../../i18n/registry";
import "./messages";
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  useEdges,
  useInternalNode,
  useNodes,
  useReactFlow,
} from "@xyflow/react";
import { memo, useMemo, useRef, useState } from "react";
import { arrowHeadPath } from "./arrowhead";
import {
  type Box,
  crosslinkBezier,
  curveFromHandle,
  floatingPoints,
  getFloatingPoints,
} from "./floating";
import { type HopSegment, hopPath } from "./lineJumps";
import { useLinkEdit } from "./linkEdit";
import { resolveLinkStyle } from "./style";
import type { EdgeData, FlowEdge } from "./types";

/** A live React Flow node's on-screen box (top-left + size → centre + size). This app has no
 *  sub-flow parenting, so `position` is already absolute — matching the exporter's rects. */
function boxOfNode(n: {
  position: { x: number; y: number };
  measured?: { width?: number; height?: number };
}): Box {
  const w = n.measured?.width ?? 0;
  const h = n.measured?.height ?? 0;
  return { cx: n.position.x + w / 2, cy: n.position.y + h / 2, w, h };
}

/**
 * Build the chord segments for EVERY relationship on the canvas, from the live node positions —
 * the same endpoint geometry (floatingPoints over node rects) the SVG exporter uses, so the hop
 * crossings match on screen and in exports. `order` is the edge's array index, so the hopper choice
 * (higher order hops) is stable + identical to the exporter, which walks edges in the same order.
 */
function collectSegments(
  crosslinks: { id: string; source: string; target: string }[],
  nodeBox: Map<string, Box>,
): HopSegment[] {
  const segs: HopSegment[] = [];
  crosslinks.forEach((e, i) => {
    const s = nodeBox.get(e.source);
    const tgt = nodeBox.get(e.target);
    if (!s || !tgt) return;
    const { sx, sy, tx, ty } = floatingPoints(s, tgt);
    segs.push({ id: e.id, order: i, sx, sy, tx, ty, fromId: e.source, toId: e.target });
  });
  return segs;
}

// Cross-link / relationship: a dashed floating bezier with a directional arrowhead and an optional
// label chip. Floating (border-to-border) so it routes sensibly in any layout, unlike a fixed-handle
// edge. Rendered via BaseEdge so it carries a wide invisible hit-area — the thin dashed line is easy
// to double-click (rename) or right-click (delete).
//
// LINE-JUMPS: when meta.lineJumps is on (carried as data.lineJumps), the visible line is drawn as
// the straight CHORD with a semicircular hop cut in wherever it crosses another relationship — from
// the shared pure helper (lineJumps.ts) that the SVG exporter also uses, so canvas == export. The
// wide bezier hit-area + arrowhead + label are unchanged (the gentle curve keeps the hit-area within
// reach of the chord), so rename/delete still work.

function CrosslinkEdgeImpl({ id, source, target, label, data, selected }: EdgeProps<FlowEdge>) {
  const linkEdit = useLinkEdit();
  const { screenToFlowPosition } = useReactFlow();
  // While the midpoint handle is dragged, preview the new bow locally (re-bend the line live) and
  // only commit to the doc on pointer-up — one undo step instead of one per pointermove.
  const [previewCurve, setPreviewCurve] = useState<number | null>(null);
  const dragging = useRef(false);
  const s = useInternalNode(source);
  // `tgt`, not `t` — a local named `t` shadows the imported translation function, which makes
  // t("…") uncallable in this component. tsc catches it as "not callable"; the rename avoids it.
  const tgt = useInternalNode(target);
  // Subscribe to all nodes + edges so the hops re-compute live as ANY node moves or a relationship
  // is added/removed (not just when THIS edge's own endpoints move).
  const nodes = useNodes();
  const edges = useEdges<FlowEdge>();
  const lineJumps = data?.lineJumps;
  // Line-jumps are O(nodes) to build the box map + O(crosslinks²) to scan crossings — far too much
  // to redo on every render (every parent re-render, hover, selection change). React Flow hands us a
  // fresh `nodes` array reference whenever any node moves (drag) or is added/removed, and a fresh
  // `edges` array when relationships change, so keying the memo on (nodes, edges, id, lineJumps)
  // recomputes exactly when the geometry that feeds the hops actually changes — and caches every
  // other render. Identical output to the previous per-render compute; just not repeated needlessly.
  const hopPathStr = useMemo(() => {
    if (!lineJumps) return null;
    const nodeBox = new Map<string, Box>();
    for (const n of nodes) nodeBox.set(n.id, boxOfNode(n));
    const crosslinks = edges.filter((e) => (e.data as EdgeData | undefined)?.crosslink);
    const segs = collectSegments(crosslinks, nodeBox);
    const self = segs.find((seg) => seg.id === id);
    return self ? hopPath(self, segs) : null;
  }, [nodes, edges, id, lineJumps]);
  if (!s || !tgt) return null;
  const { sx, sy, tx, ty } = getFloatingPoints(s, tgt);
  // The bezier carries the wide invisible hit-area (and is the visible line when line-jumps is off).
  // Built from the SHARED helper the exporter uses, so the curve bows along the same (horizontal) axis
  // on screen and in exports — canvas == export.
  const {
    path: bezier,
    labelX,
    labelY,
  } = crosslinkBezier(sx, sy, tx, ty, previewCurve ?? data?.curve);
  const { color, width, dasharray, arrowAtTarget, arrowAtSource } = resolveLinkStyle(
    data ?? {},
    data?.accent,
  );
  const dimOpacity = data?.dimmed ? 0.12 : 1;

  const visiblePath = hopPathStr ?? bezier;

  return (
    <>
      {selected ? (
        // A wider translucent halo under the line marks the selected relationship (no hit-area, solid).
        <BaseEdge
          path={visiblePath}
          interactionWidth={0}
          style={{ stroke: color, strokeWidth: width + 6, opacity: 0.25 }}
        />
      ) : null}
      <BaseEdge
        path={visiblePath}
        interactionWidth={20}
        style={{
          stroke: color,
          strokeWidth: width,
          strokeDasharray: dasharray || undefined,
          opacity: dimOpacity,
        }}
      />
      {arrowAtTarget ? (
        <path
          d={arrowHeadPath(tx, ty, sx, sy, 6 + width * 2)}
          fill={color}
          style={{ opacity: dimOpacity }}
        />
      ) : null}
      {arrowAtSource ? (
        <path
          d={arrowHeadPath(sx, sy, tx, ty, 6 + width * 2)}
          fill={color}
          style={{ opacity: dimOpacity }}
        />
      ) : null}
      {selected && linkEdit?.editingId !== id ? (
        // Draggable midpoint handle (#1): drag perpendicular to the chord to bow the relationship.
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            title={t("canvas.dragToReshapeTheRelationship")}
            aria-label={t("canvas.reshapeRelationship")}
            onPointerDown={(e) => {
              e.stopPropagation();
              (e.target as Element).setPointerCapture?.(e.pointerId);
              dragging.current = true;
            }}
            onPointerMove={(e) => {
              if (!dragging.current) return;
              const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
              setPreviewCurve(curveFromHandle(sx, sy, tx, ty, p.x, p.y));
            }}
            onPointerUp={(e) => {
              if (!dragging.current) return;
              dragging.current = false;
              (e.target as Element).releasePointerCapture?.(e.pointerId);
              if (previewCurve != null) linkEdit?.setCurve(id, previewCurve);
              setPreviewCurve(null);
            }}
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "var(--mm-node-bg, #ffffff)",
              border: `2px solid ${color}`,
              cursor: "grab",
              pointerEvents: "all",
              zIndex: 6,
            }}
          />
        </EdgeLabelRenderer>
      ) : null}
      {linkEdit?.editingId === id ? (
        <EdgeLabelRenderer>
          <input
            // biome-ignore lint/a11y/noAutofocus: inline editor opened by an explicit double-click.
            autoFocus
            defaultValue={typeof label === "string" ? label : ""}
            aria-label={t("panel.relationshipLabel")}
            className="nodrag nopan"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") linkEdit.commit(id, (e.target as HTMLInputElement).value);
              else if (e.key === "Escape") linkEdit.cancel();
            }}
            onBlur={(e) => linkEdit.commit(id, e.target.value)}
            placeholder={t("canvas.label")}
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              fontSize: 12,
              width: 120,
              padding: "1px 4px",
              border: `1px solid ${color}`,
              borderRadius: 4,
              pointerEvents: "all",
            }}
          />
        </EdgeLabelRenderer>
      ) : label ? (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              fontSize: 12,
              color,
              background: "var(--mm-node-bg, #ffffff)",
              padding: "0 4px",
              borderRadius: 4,
              pointerEvents: "none",
              opacity: dimOpacity,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
      {data?.showLinkTypes && data?.linkType && data.linkType !== "relates-to" ? (
        // Type pill (B3): the semantic category as a small solid pill near the arrowhead, distinct from
        // the user's free label chip at the midpoint. Only for a non-default type, only when the map has
        // meta.showLinkTypes on. Sits 72% along the chord so it clears the midpoint label/handle.
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${sx + (tx - sx) * 0.72}px, ${sy + (ty - sy) * 0.72}px)`,
              fontSize: 10,
              fontWeight: 600,
              color: "#fff",
              background: color,
              padding: "0 5px",
              borderRadius: 8,
              pointerEvents: "none",
              opacity: dimOpacity,
              whiteSpace: "nowrap",
            }}
          >
            {data.linkType}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

// Memoised: like the other flow components, the props shallow-compare equal across unrelated parent
// re-renders, while the live geometry (node movement, relationship add/remove, line-jump recompute)
// flows through the store-subscribing hooks + the useMemo above — neither of which memo blocks.
export const CrosslinkEdge = memo(CrosslinkEdgeImpl);
