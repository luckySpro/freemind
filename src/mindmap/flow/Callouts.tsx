import { ViewportPortal, useNodes } from "@xyflow/react";
import { type CSSProperties, memo, useEffect, useMemo, useRef, useState } from "react";
import type { Callout } from "../../model/types";
import { resolveCalloutStyle } from "./style";

// Anchored callout bubbles (MindManager-style sticky annotations), rendered in flow space via
// ViewportPortal so they pan/zoom with the map. Each bubble sits at its node's right edge plus
// the callout's (dx,dy) offset, joined by a short dashed connector. Text is inline-editable
// (double-click); a × removes it. Model-first: edits call back to FlowInner, which runs the
// pure callout ops — so the bubbles also travel into the SVG export and the .json. Colours come
// from ./style (per-callout override) so the export draws an identical bubble.

export interface CalloutAnchor {
  nodeId: string;
  callout: Callout;
}

// Bubble layout (colours come per-callout from the resolved style → a recoloured callout re-tints).
const BUBBLE_BASE: CSSProperties = {
  position: "absolute",
  maxWidth: 180,
  minWidth: 36,
  padding: "3px 8px",
  borderRadius: 8,
  fontSize: 12,
  lineHeight: 1.3,
  boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
  whiteSpace: "pre-wrap",
};

/** A callout resolved to its anchored position in flow space. */
interface PlacedCallout {
  nodeId: string;
  callout: Callout;
  left: number;
  top: number;
}

/** The inline editor for a callout bubble. Split out so a mount-time `useEffect` can focus the
 *  textarea (the bubble the user just opened) without an `autoFocus` attribute — same UX, no a11y
 *  lint suppression. It mounts only while that bubble is being edited. */
function CalloutEditor({
  initialText,
  onCommit,
  onCancel,
}: {
  initialText: string;
  onCommit: (text: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <textarea
      ref={ref}
      defaultValue={initialText}
      rows={2}
      style={{
        width: 150,
        border: "none",
        background: "transparent",
        outline: "none",
        resize: "none",
        font: "inherit",
        color: "inherit",
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onCommit((e.target as HTMLTextAreaElement).value);
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      onBlur={(e) => onCommit(e.target.value)}
    />
  );
}

function Callouts({
  items,
  onCommit,
  onDelete,
  selectedId,
  onSelect,
  onContextMenu,
}: {
  items: CalloutAnchor[];
  onCommit: (nodeId: string, calloutId: string, text: string) => void;
  onDelete: (nodeId: string, calloutId: string) => void;
  selectedId?: string | null;
  onSelect?: (nodeId: string, calloutId: string) => void;
  /** Right-click a callout → open its context menu (recolour / delete). */
  onContextMenu?: (e: React.MouseEvent, nodeId: string, calloutId: string) => void;
}) {
  const nodes = useNodes();
  const [editingId, setEditingId] = useState<string | null>(null);
  // Resolve each callout's anchor once per node/item change, not on every parent re-render (and not
  // when only `editingId` flips). `nodes` is a fresh reference whenever an anchor node moves, so the
  // bubbles still follow drags live — identical placement, just no redundant per-render math.
  const placed = useMemo<PlacedCallout[]>(() => {
    if (items.length === 0) return [];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const out: PlacedCallout[] = [];
    for (const { nodeId, callout } of items) {
      const n = byId.get(nodeId);
      if (!n) continue;
      const w = n.measured?.width ?? 0;
      const h = n.measured?.height ?? 0;
      out.push({
        nodeId,
        callout,
        left: n.position.x + w + callout.dx,
        top: n.position.y + h / 2 + callout.dy,
      });
    }
    return out;
  }, [nodes, items]);

  if (placed.length === 0) return null;

  return (
    <ViewportPortal>
      {placed.map(({ nodeId, callout, left, top }) => {
        const editing = editingId === callout.id;
        const selected = callout.id === selectedId;
        const style = resolveCalloutStyle(callout.color);
        return (
          <div
            key={callout.id}
            className="nodrag nopan"
            style={{ position: "absolute", left, top }}
          >
            {/* dashed connector from the node's right-centre to the bubble */}
            {/* biome-ignore lint/a11y/noSvgWithoutTitle: purely decorative connector (aria-hidden) */}
            <svg
              width="1"
              height="1"
              style={{ position: "absolute", overflow: "visible", pointerEvents: "none" }}
              aria-hidden
            >
              <line
                x1={-callout.dx}
                y1={-callout.dy}
                x2={0}
                y2={10}
                stroke={style.connector}
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
            </svg>
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: a click selects the bubble; keyboard
                access to overlays is out of scope (canvas affordance, mirrors node selection). */}
            <div
              style={{
                ...BUBBLE_BASE,
                background: style.bg,
                color: style.text,
                border: `1px solid ${style.stroke}`,
                boxShadow: selected
                  ? `0 0 0 2px ${style.stroke}, ${BUBBLE_BASE.boxShadow}`
                  : BUBBLE_BASE.boxShadow,
              }}
              onClick={() => onSelect?.(nodeId, callout.id)}
              onContextMenu={(e) => onContextMenu?.(e, nodeId, callout.id)}
            >
              {editing ? (
                <CalloutEditor
                  initialText={callout.text}
                  onCommit={(text) => {
                    onCommit(nodeId, callout.id, text);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <>
                  <button
                    type="button"
                    title="Delete callout"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(nodeId, callout.id);
                    }}
                    style={{
                      float: "right",
                      marginLeft: 6,
                      border: "none",
                      background: "transparent",
                      color: style.text,
                      cursor: "pointer",
                      lineHeight: 1,
                      padding: 0,
                      fontSize: 13,
                    }}
                  >
                    ×
                  </button>
                  <span onDoubleClick={() => setEditingId(callout.id)}>{callout.text || "…"}</span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </ViewportPortal>
  );
}

const MemoCallouts = memo(Callouts);
export { MemoCallouts as Callouts };
