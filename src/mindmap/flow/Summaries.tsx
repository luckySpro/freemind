import { ViewportPortal, useNodes } from "@xyflow/react";
import { type CSSProperties, memo, useMemo, useRef, useState } from "react";
import type { Summary } from "../../model/types";
import {
  type ResolvedSummaryStyle,
  SUMMARY_BRACKET_W,
  SUMMARY_GAP,
  SUMMARY_PAD,
  resolveSummaryStyle,
  summaryLabel,
} from "./style";

// Summary brackets: a labelled bracket drawn to one side of a node's subtree, in flow space via
// ViewportPortal (so it pans/zooms with the map). Side follows the range's position relative to the
// root — a right-side branch gets a "]" on its right; a left-side branch gets a "[" on its left.
// Double-click the label to rename it IN PLACE (like callouts and edge labels — no modal); an empty
// committed label removes the summary (unchanged semantics), Escape cancels. Geometry + colours come
// from ./style so the SVG export matches.

// Label-chip layout (colours come per-bracket from the resolved style → a recoloured summary
// re-tints its chip).
const labelChipBase: CSSProperties = {
  position: "absolute",
  padding: "1px 8px",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: "nowrap",
  cursor: "text",
  pointerEvents: "auto",
};

/** The in-place label editor: Enter commits, Escape cancels (blur without Escape also commits —
 *  the standard inline-edit contract shared with callouts). Reports via onDone(null = cancelled). */
function SummaryLabelEditor({
  initial,
  chipStyle,
  onDone,
}: {
  initial: string;
  chipStyle: CSSProperties;
  onDone: (label: string | null) => void;
}) {
  const cancelled = useRef(false);
  return (
    <input
      // biome-ignore lint/a11y/noAutofocus: an inline editor the user just double-clicked into.
      autoFocus
      defaultValue={initial}
      aria-label="Summary label"
      placeholder="Label (empty removes)"
      className="nodrag nopan"
      style={{ ...chipStyle, cursor: "text", width: 150 }}
      onKeyDown={(e) => {
        e.stopPropagation(); // keep the canvas keymap (Delete, arrows…) out of the edit
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        else if (e.key === "Escape") {
          cancelled.current = true;
          (e.target as HTMLInputElement).blur();
        }
      }}
      onBlur={(e) => onDone(cancelled.current ? null : e.target.value)}
    />
  );
}

/** A summary bracket resolved to its drawn geometry from the live node rects + its resolved colours. */
interface PlacedSummary {
  id: string;
  label: string;
  /** The raw (possibly empty) stored label — the inline editor's seed, before the display default. */
  rawLabel: string;
  onLeft: boolean;
  top: number;
  height: number;
  bracketLeft: number;
  style: ResolvedSummaryStyle;
}

function Summaries({
  summaries,
  onCommitLabel,
  selectedId,
  onSelect,
  onContextMenu,
}: {
  summaries: readonly Summary[];
  /** Commit an in-place label edit ("" removes the summary, matching the old prompt's semantics). */
  onCommitLabel: (id: string, label: string) => void;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Right-click a summary → open its context menu (recolour / delete). */
  onContextMenu?: (e: React.MouseEvent, id: string) => void;
}) {
  const nodes = useNodes();
  const [editingId, setEditingId] = useState<string | null>(null);
  // Resolve each bracket's geometry once per node/summary change rather than on every parent
  // re-render. `nodes` is a fresh reference whenever a member moves, so brackets still track drags
  // live — identical geometry, just not recomputed needlessly.
  const placed = useMemo<PlacedSummary[]>(() => {
    if (summaries.length === 0) return [];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const rootNode = nodes.find((n) => (n.data as { isRoot?: boolean })?.isRoot);
    const rootCenterX = rootNode ? rootNode.position.x + (rootNode.measured?.width ?? 0) / 2 : 0;
    const out: PlacedSummary[] = [];
    for (const s of summaries) {
      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      let found = 0;
      for (const id of s.nodeIds) {
        const n = byId.get(id);
        if (!n) continue;
        minX = Math.min(minX, n.position.x);
        minY = Math.min(minY, n.position.y);
        maxX = Math.max(maxX, n.position.x + (n.measured?.width ?? 0));
        maxY = Math.max(maxY, n.position.y + (n.measured?.height ?? 0));
        found += 1;
      }
      if (found === 0) continue;
      // Left-side branch → bracket opens right ("["); right-side → bracket opens left ("]").
      const onLeft = (minX + maxX) / 2 < rootCenterX;
      const top = minY - SUMMARY_PAD;
      const height = maxY - minY + 2 * SUMMARY_PAD;
      const bracketLeft = onLeft ? minX - SUMMARY_GAP - SUMMARY_BRACKET_W : maxX + SUMMARY_GAP;
      out.push({
        id: s.id,
        label: summaryLabel(s.label),
        rawLabel: s.label ?? "",
        onLeft,
        top,
        height,
        bracketLeft,
        style: resolveSummaryStyle(s.color),
      });
    }
    return out;
  }, [nodes, summaries]);

  if (placed.length === 0) return null;

  return (
    <ViewportPortal>
      {placed.map(({ id, label, rawLabel, onLeft, top, height, bracketLeft, style }) => {
        const selected = id === selectedId;
        const chipPlacement: CSSProperties = {
          ...labelChipBase,
          background: style.labelBg,
          color: style.labelColor,
          border: `1px solid ${style.labelBorder}`,
          top: top + height / 2 - 11,
          left: onLeft ? bracketLeft - 6 : bracketLeft + SUMMARY_BRACKET_W + 6,
          transform: onLeft ? "translateX(-100%)" : undefined,
        };
        return (
          <div key={id} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
            <div
              style={{
                position: "absolute",
                left: bracketLeft,
                top,
                width: SUMMARY_BRACKET_W,
                height,
                boxSizing: "border-box",
                borderTop: `2px solid ${style.stroke}`,
                borderBottom: `2px solid ${style.stroke}`,
                borderLeft: onLeft ? `2px solid ${style.stroke}` : undefined,
                borderRight: onLeft ? undefined : `2px solid ${style.stroke}`,
                pointerEvents: "none",
                // Selection halo (view-only, additive — not exported).
                filter: selected ? `drop-shadow(0 0 4px ${style.stroke})` : undefined,
              }}
            />
            {editingId === id ? (
              <SummaryLabelEditor
                initial={rawLabel}
                chipStyle={chipPlacement}
                onDone={(next) => {
                  setEditingId(null);
                  // Commit only a real change — so double-click + click-away on an unlabelled
                  // summary is a harmless no-op rather than an accidental empty-label delete.
                  if (next !== null && next.trim() !== rawLabel.trim()) onCommitLabel(id, next);
                }}
              />
            ) : (
              <button
                type="button"
                className="nodrag nopan"
                title="Click to select · double-click to rename this summary"
                onClick={() => onSelect?.(id)}
                onContextMenu={(e) => onContextMenu?.(e, id)}
                onDoubleClick={() => setEditingId(id)}
                style={{
                  ...chipPlacement,
                  cursor: "pointer",
                  boxShadow: selected ? `0 0 0 2px ${style.stroke}` : undefined,
                }}
              >
                {label}
              </button>
            )}
          </div>
        );
      })}
    </ViewportPortal>
  );
}

const MemoSummaries = memo(Summaries);
export { MemoSummaries as Summaries };
