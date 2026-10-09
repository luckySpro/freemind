import { tNodes } from "../../i18n/nodes";
import { t } from "../../i18n/registry";
import "./messages";
import { MiniMap, NodeToolbar, Panel, Position, useStore } from "@xyflow/react";
import { type CSSProperties, useLayoutEffect } from "react";
import { Menu, MenuCheckboxItem, MenuItem, MenuSeparator } from "../../design/primitives";
import { colors } from "../../design/tokens";
import { markerImage } from "../../icons";
import { buildLegend } from "../../legend";
import type { MindMapDoc } from "../../model/types";
import { affordanceScale } from "./nodeChrome";
import { findAnyNode } from "./ops";
import type { TopicNode } from "./types";

// Small canvas-only presentational overlays carved out of FlowMindMap's render. None are authored into
// the SVG export, so exports stay unchanged. All take plain props (doc passed in, not via docRef).

/** Empty-map coachmark — anchored under the root via NodeToolbar so it tracks pan/zoom. The keyboard
 *  gestures (Tab / Enter / Shift-drag) don't exist on a phone, so `touch` swaps in the tap equivalents. */
export function CoachMark({
  show,
  rootId,
  touch = false,
}: {
  show: boolean;
  rootId: string;
  touch?: boolean;
}) {
  if (!show) return null;
  return (
    <NodeToolbar nodeId={rootId} isVisible position={Position.Bottom} offset={18}>
      <div className="mm-coachmark nodrag nopan">
        <strong>{t("canvas.startYourMap")}</strong>
        {touch ? (
          <>
            <span>{tNodes("canvas.coach.touchKeys", { add: <kbd>＋</kbd> })}</span>
            <span>{t("app.dragTheBackgroundToPan")}</span>
          </>
        ) : (
          <>
            <span>
              {tNodes("canvas.coach.editKeys", {
                child: <kbd>Tab</kbd>,
                sibling: <kbd>Enter</kbd>,
              })}
            </span>
            <span>{tNodes("canvas.coach.multiSelect", { shift: <kbd>Shift</kbd> })}</span>
          </>
        )}
      </div>
    </NodeToolbar>
  );
}

/** Publishes `--mm-aff-scale` (affordanceScale of the live zoom) on the React Flow root, where every
 *  node's affordance CSS reads it. A var write, not a prop: nodes don't re-render on zoom. */
export function AffordanceScale() {
  const zoom = useStore((s) => s.transform[2]);
  const dom = useStore((s) => s.domNode);
  useLayoutEffect(() => {
    dom?.style.setProperty("--mm-aff-scale", String(affordanceScale(zoom)));
  }, [dom, zoom]);
  return null;
}

/** Drag-to-reparent label (#11): names the topic the dragged node will become a child of, anchored on
 *  the highlighted drop target. */
export function DropLabel({ dropTargetId, doc }: { dropTargetId: string | null; doc: MindMapDoc }) {
  if (!dropTargetId) return null;
  // Named `target`, not `t` — `t` is the message lookup imported at the top of this file, and shadowing
  // it here made the label below unmigratable without a silent runtime error.
  const target = findAnyNode(doc, dropTargetId);
  return (
    <NodeToolbar nodeId={dropTargetId} isVisible position={Position.Top} offset={8}>
      <div className="mm-drop-label nodrag nopan">
        {t("canvas.makeChildOf", { topic: target?.topic?.trim() || t("common.topic") })}
      </div>
    </NodeToolbar>
  );
}

/** A slim bottom status bar — visible topic count, current selection size, live zoom % (read from the
 *  React Flow store, so it tracks pan/zoom), and the Map/Outline/Board view switcher. Canvas-only,
 *  like the minimap. */

// `label` is a getter: a plain `label: t("…")` here resolves ONCE at import and never follows a later
// `setLocale`. `id` (the React key / active-view state) stays a plain literal.
const VIEWS: { id: "map" | "outline" | "board"; label: string }[] = [
  {
    id: "map",
    get label() {
      return t("toolbar.map");
    },
  },
  {
    id: "outline",
    get label() {
      return t("panel.outline");
    },
  },
  {
    id: "board",
    get label() {
      return t("panel.board");
    },
  },
];

/** The Map/Outline/Board segmented control — MindManager's status-bar view buttons make these three
 *  shipped projections one-click peers instead of leaving Board buried in the Panels menu. */
function ViewSwitcher({
  active,
  onSet,
}: {
  active: "map" | "outline" | "board";
  onSet: (view: "map" | "outline" | "board") => void;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a toolbar-style button group, not a form <fieldset>.
    <div
      role="group"
      aria-label={t("canvas.switchView")}
      style={{
        display: "flex",
        gap: 2,
        border: `1px solid ${colors.menu.border}`,
        borderRadius: 4,
      }}
    >
      {VIEWS.map((v) => {
        const isActive = active === v.id;
        return (
          <button
            key={v.id}
            type="button"
            aria-pressed={isActive}
            title={t("canvas.switchToView", { view: v.label })}
            onClick={() => onSet(v.id)}
            style={{
              border: "none",
              borderRadius: 3,
              cursor: "pointer",
              font: "inherit",
              fontWeight: isActive ? 600 : 400,
              padding: "1px 6px",
              background: isActive ? "var(--mm-color, #23211c)" : "transparent",
              color: isActive ? "var(--mm-node-bg, #fff)" : "inherit",
            }}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}

export function StatusBar({
  topics,
  selected,
  activeView,
  onSetView,
  compact = false,
  zoom: zoomActions,
}: {
  topics: number;
  selected: number;
  /** The active Map/Outline/Board projection; the switcher renders only when both this and
   *  `onSetView` are given (a caller can opt out of the switcher entirely). */
  activeView?: "map" | "outline" | "board";
  onSetView?: (view: "map" | "outline" | "board") => void;
  /** Phone: keep just the view switcher + zoom menu (counts are in the Info panel's statistics). */
  compact?: boolean;
  /** The zoom % becomes a menu of these (replacing the old +/−/fit stack and the minimap button). */
  zoom?: ZoomMenuActions;
}) {
  const zoom = useStore((s) => s.transform[2]);
  const pct = `${Math.round(zoom * 100)}%`;
  return (
    // Full-width, untransformed panel (centred by flex) rather than RF's "bottom-center", which
    // centres with translateX(-50%): a transformed ancestor would re-anchor the zoom menu's
    // position:fixed popup to the panel instead of the viewport.
    <Panel position="bottom-left" style={STATUS_PANEL}>
      <div
        className="nodrag nopan"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          font: "11px system-ui, sans-serif",
          padding: "2px 10px",
          borderRadius: 6,
          border: `1px solid ${colors.menu.border}`,
          background: `var(--mm-node-bg, ${colors.menu.fallbackBg})`,
          color: `var(--mm-color, ${colors.menu.fallbackColor})`,
          opacity: 0.9,
          boxShadow: "0 1px 3px #0002",
          pointerEvents: "auto",
        }}
      >
        {onSetView && activeView ? <ViewSwitcher active={activeView} onSet={onSetView} /> : null}
        {compact ? null : <span>{t("canvas.topicCount", { n: topics })}</span>}
        {compact || selected === 0 ? null : (
          <span>{t("canvas.selectedCount", { n: selected })}</span>
        )}
        {zoomActions ? (
          <ZoomMenu pct={pct} selected={selected} sheet={compact} actions={zoomActions} />
        ) : (
          <span>{pct}</span>
        )}
      </div>
    </Panel>
  );
}

const STATUS_PANEL: CSSProperties = {
  left: 0,
  right: 0,
  display: "flex",
  justifyContent: "center",
  pointerEvents: "none",
};

export interface ZoomMenuActions {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  fitMap: () => void;
  fitSelection: () => void;
  minimapOpen: boolean;
  toggleMinimap: () => void;
}

/** The status bar's zoom % as a menu — zoom in/out, 100%, fit map / selection and the minimap toggle,
 *  so the canvas needs no separate +/−/fit stack or minimap button. */
// Keyboard hints on the zoom-menu rows — physical key names, not prose (like FlowMindMap's
// MENU_SHORTCUT); kept in step with keyIntent (Ctrl/⌘ +/−/0) and the Shift+1/2 fit handler.
const ZOOM_KEYS = {
  in: "Ctrl/⌘ +",
  out: "Ctrl/⌘ −",
  reset: "Ctrl/⌘ 0",
  fit: "Shift+1",
  fitSelection: "Shift+2",
};

/** The zoom menu; `sheet` (phone) drops the keyboard hints, which a phone can't use. */
function ZoomMenu({
  pct,
  selected,
  sheet,
  actions,
}: {
  pct: string;
  selected: number;
  sheet: boolean;
  actions: ZoomMenuActions;
}) {
  return (
    <Menu
      trigger={pct}
      triggerClassName="mm-stat-btn"
      triggerTitle={t("canvas.zoomMenu")}
      triggerAriaLabel={t("canvas.zoomMenuAt", { pct })}
      menuAriaLabel={t("canvas.zoomMenu")}
      align="right"
      sheet={sheet}
    >
      <MenuItem
        label={t("canvas.zoomIn")}
        shortcut={sheet ? undefined : ZOOM_KEYS.in}
        closeOnSelect={false}
        onSelect={actions.zoomIn}
      />
      <MenuItem
        label={t("canvas.zoomOut")}
        shortcut={sheet ? undefined : ZOOM_KEYS.out}
        closeOnSelect={false}
        onSelect={actions.zoomOut}
      />
      <MenuItem
        label={t("canvas.pane.resetZoom")}
        shortcut={sheet ? undefined : ZOOM_KEYS.reset}
        onSelect={actions.reset}
      />
      <MenuSeparator />
      <MenuItem
        label={t("cmd.fit")}
        shortcut={sheet ? undefined : ZOOM_KEYS.fit}
        onSelect={actions.fitMap}
      />
      {selected > 0 ? (
        <MenuItem
          label={t("canvas.zoomToFitTheSelection")}
          shortcut={sheet ? undefined : ZOOM_KEYS.fitSelection}
          onSelect={actions.fitSelection}
        />
      ) : null}
      <MenuSeparator />
      <MenuCheckboxItem
        label={t("canvas.showMinimap")}
        checked={actions.minimapOpen}
        trailing=" ✓"
        onSelect={actions.toggleMinimap}
      />
    </Menu>
  );
}

/** The map legend (top-left) — every marker / tag / conditional rule in use with its meaning. Shown
 *  when meta.legend is on; the SVG export draws the same rows (from the shared buildLegend). */
export function LegendPanel({ doc }: { doc: MindMapDoc }) {
  const entries = buildLegend(doc);
  if (entries.length === 0) return null;
  return (
    <Panel position="top-left">
      <div
        className="nodrag nopan"
        style={{
          font: "11px system-ui, sans-serif",
          padding: "6px 9px",
          borderRadius: 6,
          border: `1px solid ${colors.menu.border}`,
          background: `var(--mm-node-bg, ${colors.menu.fallbackBg})`,
          color: `var(--mm-color, ${colors.menu.fallbackColor})`,
          maxWidth: 220,
          boxShadow: "0 1px 3px #0002",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4, opacity: 0.7 }}>{t("toolbar.legend")}</div>
        {entries.map((e, i) => (
          <div
            key={`${e.kind}:${e.label}:${i}`}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "1px 0" }}
          >
            {e.kind === "marker" && e.icon ? (
              markerImage(e.icon) ? (
                <img src={markerImage(e.icon) as string} alt="" width={13} height={13} />
              ) : (
                <span style={{ width: 13, textAlign: "center" }}>{e.icon}</span>
              )
            ) : (
              <span
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: e.kind === "tag" ? 6 : 2,
                  background: e.color ?? colors.accent,
                  flexShrink: 0,
                }}
              />
            )}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {e.label}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** The minimap, when open. Its show/hide toggle lives in the status bar's zoom menu. */
export function MinimapPanel({ open }: { open: boolean }) {
  if (!open) return null;
  return (
    <MiniMap
      pannable
      zoomable
      nodeColor={(node) => (node.data as TopicNode["data"])?.branchColor ?? "#bbb"}
      nodeStrokeWidth={3}
      // Clear the status bar, which spans the bottom edge.
      style={{ marginBottom: 34 }}
    />
  );
}
