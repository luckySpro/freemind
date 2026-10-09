import type { ReactNode } from "react";
import { t } from "../../i18n/registry";
import "./messages";
import { NodeToolbar, Position, useStore } from "@xyflow/react";
import { EditorIcon, type EditorIconName } from "../../components/EditorIcons";
import { colors } from "../../design/tokens";
import type { MindMapDoc } from "../../model/types";
import { popoverAlign } from "./nodeChrome";
import { findAnyNode } from "./ops";

// Upper bound on the bar's width (touch: 8 buttons × 41px + padding) — only used to decide whether a
// centred bar would overflow the pane, so erring wide just anchors a little earlier.
const BAR_W_MAX = 340;

/** The NodeToolbar alignment that keeps the bar inside the pane (see popoverAlign). A stable string,
 *  so pan/zoom only re-renders the popover when the answer actually flips. */
function useBarAlign(nodeId: string) {
  return useStore((s) => {
    const n = s.nodeLookup.get(nodeId);
    if (!n) return "center";
    const [tx, , zoom] = s.transform;
    const left = n.internals.positionAbsolute.x * zoom + tx;
    const right = left + (n.measured?.width ?? 0) * zoom;
    return popoverAlign(left, right, s.width, BAR_W_MAX);
  });
}

/** One button in the inline node popover (the on-selection quick-action toolbar). Renders an
 *  EditorIcon, or a text `glyph` (emoji) for actions with no icon in the set (e.g. priority ⚑). */
function PopBtn({
  icon,
  glyph,
  label,
  active,
  danger,
  touchOnly,
  onClick,
}: {
  icon?: EditorIconName;
  glyph?: string;
  label: string;
  active?: boolean;
  danger?: boolean;
  /** Shown only on a coarse pointer (CSS) — for actions a mouse already has on the node itself. */
  touchOnly?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`mm-pop-btn${touchOnly ? " mm-pop-touch" : ""} nodrag nopan`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      style={{
        width: 30,
        height: 30,
        borderRadius: 7,
        border: "none",
        background: active ? colors.accentTint : "transparent",
        cursor: "pointer",
        color: danger ? "#b23b3a" : active ? colors.accent : colors.muted,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: glyph ? 15 : undefined,
        lineHeight: 1,
      }}
    >
      {glyph ?? (icon ? <EditorIcon name={icon} size={16} /> : null)}
    </button>
  );
}

/** Inline contextual popover — quick actions above the selected node: Collapse / expand (when the node
 *  has children) and "More…", which opens the full right-click menu at the node so Rename / Delete / Add
 *  callout / roll-up etc. are all one click away without right-clicking (C6 — friendlier on trackpad +
 *  touch). Node-tracked via React Flow's NodeToolbar so it stays put through pan/zoom; hidden while the
 *  node is being inline-edited. Canvas-only (never exported). */
export function NodePopover({
  selectedId,
  editingId,
  doc,
  onToggleCollapse,
  onOpenNote,
  onCyclePriority,
  onStartLink,
  onMore,
  onAddChild,
  onAddSibling,
  onOpenInfo,
}: {
  selectedId: string | null;
  editingId: string | null;
  doc: MindMapDoc;
  onAddChild: (id: string) => void;
  onAddSibling: (id: string) => void;
  /** Open the inspector for the selection (it no longer opens on every click). */
  onOpenInfo: () => void;
  onToggleCollapse: (id: string) => void;
  onOpenNote: (id: string) => void;
  onCyclePriority: (id: string) => void;
  onStartLink: (id: string) => void;
  onMore: (id: string) => void;
}) {
  if (!selectedId || editingId === selectedId) return null;
  const sid = selectedId;
  const sel = findAnyNode(doc, sid);
  const hasKids = (sel?.children?.length ?? 0) > 0;
  const hasNote = !!sel?.note?.trim();
  const hasPriority = !!sel?.task?.priority;
  const isRoot = sid === doc.root.id;
  return (
    <AlignedToolbar nodeId={sid}>
      {/* The transient contextual action bar (UI-3): the high-value per-node edits surface here on
          selection — note / priority / link — replacing the hover pill that used to pop in over the
          node. Add child/sibling are the on-node ＋ affordances for a mouse; on touch those would cover
          the label, so the bar carries them instead (touch-only, CSS-gated). Rename / Delete / markers
          etc. live behind "More…". Node-tracked via NodeToolbar so it stays put through pan/zoom. */}
      <div
        className="nodrag nopan"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          background: colors.white,
          border: `1px solid ${colors.border}`,
          borderRadius: 11,
          padding: 4,
          // Themed elevation so the action bar's shadow follows light/dark (was a fixed light shadow).
          boxShadow: "var(--ed-shadow-pop, 0 10px 30px rgba(40,30,16,0.18))",
        }}
      >
        <PopBtn
          icon="plus"
          label={t("canvas.menu.addChild")}
          touchOnly
          onClick={() => onAddChild(sid)}
        />
        {isRoot ? null : (
          <PopBtn
            glyph="↵"
            label={t("canvas.menu.addSibling")}
            touchOnly
            onClick={() => onAddSibling(sid)}
          />
        )}
        <PopBtn
          icon="note"
          label={hasNote ? t("canvas.openNote") : t("canvas.menu.addNote")}
          active={hasNote}
          onClick={() => onOpenNote(sid)}
        />
        <PopBtn
          glyph="⚑"
          label={hasPriority ? t("canvas.cyclePriority") : t("canvas.addPriority")}
          active={hasPriority}
          onClick={() => onCyclePriority(sid)}
        />
        <PopBtn icon="link" label={t("canvas.menu.linkTo")} onClick={() => onStartLink(sid)} />
        {hasKids ? (
          <PopBtn
            icon="minus"
            label={t("canvas.menu.collapseExpand")}
            onClick={() => onToggleCollapse(sid)}
          />
        ) : null}
        <PopBtn glyph="ⓘ" label={t("panel.topicInfo")} onClick={onOpenInfo} />
        <PopBtn icon="dots" label={t("canvas.moreActions")} onClick={() => onMore(sid)} />
      </div>
    </AlignedToolbar>
  );
}

function AlignedToolbar({ nodeId, children }: { nodeId: string; children: ReactNode }) {
  const align = useBarAlign(nodeId);
  return (
    <NodeToolbar nodeId={nodeId} isVisible position={Position.Top} offset={10} align={align}>
      {children}
    </NodeToolbar>
  );
}
