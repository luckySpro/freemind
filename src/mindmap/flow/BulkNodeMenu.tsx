import { t } from "../../i18n/registry";
import "./messages";
import { MenuItem, MenuLabel, MenuSeparator } from "../../design/primitives";
import { MARKER_PALETTE, markerImage } from "../../icons";
import type { MindMapDoc } from "../../model/types";
import { PRIORITY_LEVELS, priorityLabel } from "../../priority";
import {
  type OpResult,
  applyAcrossIds,
  bulkToggleIcon,
  groupNodes,
  setBranchColor,
  setPriority,
} from "./ops";

// The right-click menu shown when several topics are selected (the bulk path) — previously impossible
// because right-click collapsed the selection to one node. It does the op-wiring itself (given the live
// `ids`, a doc getter, and `apply`) so the whole bulk surface is exercised by its own test rather than
// needing a driven React-Flow multi-selection (which jsdom can't reproduce). Must render inside a
// <ContextMenu> (the MenuItem rows read its context).

const BRANCH_COLOURS = ["#c2701a", "#3f6fb0", "#1b8a5e", "#b23b6a", "#8a6d2f", "#6a5acd"];

export interface BulkNodeMenuProps {
  /** The selected node ids (≥2). */
  ids: string[];
  /** Read the live doc at click time. */
  getDoc: () => MindMapDoc;
  /** Commit an op result (records one undo step). */
  apply: (result: OpResult) => void;
  /** Delete the whole selection (kept as a callback — it's the canvas's undo-toast path, not a pure op). */
  onDelete: () => void;
}

export function BulkNodeMenu({ ids, getDoc, apply, onDelete }: BulkNodeMenuProps) {
  const across = (op: (d: MindMapDoc, id: string) => OpResult) =>
    apply(applyAcrossIds(getDoc(), ids, op));
  return (
    <>
      <MenuLabel>{t("canvas.bulk.selectedCount", { n: ids.length })}</MenuLabel>
      <MenuItem
        label={t("canvas.bulk.deleteTopics", { n: ids.length })}
        danger
        onSelect={onDelete}
      />
      <MenuItem
        label={t("canvas.groupInABoundary")}
        onSelect={() => apply(groupNodes(getDoc(), ids))}
      />
      <MenuSeparator />
      <MenuLabel>{t("common.markers")}</MenuLabel>
      <div className="mm-menu-row">
        {MARKER_PALETTE.map((m) => (
          <button
            key={m}
            type="button"
            className="mm-menu-chip"
            aria-label={t("canvas.bulk.toggleMarker", { marker: m })}
            onClick={() => apply(bulkToggleIcon(getDoc(), ids, m))}
          >
            {markerImage(m) ? (
              <img src={markerImage(m) as string} alt={m} width={16} height={16} />
            ) : (
              m
            )}
          </button>
        ))}
      </div>
      <MenuLabel>{t("common.priority")}</MenuLabel>
      <div className="mm-menu-row">
        {PRIORITY_LEVELS.map((p) => (
          <button
            key={p}
            type="button"
            className="mm-menu-chip"
            aria-label={t("canvas.bulk.setPriority", { level: priorityLabel(p) })}
            onClick={() => across((d, i) => setPriority(d, i, p))}
          >
            {priorityLabel(p)}
          </button>
        ))}
        <button
          type="button"
          className="mm-menu-chip"
          aria-label={t("canvas.clearPriorityOnTheSelection")}
          onClick={() => across((d, i) => setPriority(d, i, undefined))}
        >
          {t("common.none")}
        </button>
      </div>
      <MenuLabel>{t("common.branchColour")}</MenuLabel>
      <div className="mm-menu-row">
        {BRANCH_COLOURS.map((c) => (
          <button
            key={c}
            type="button"
            className="mm-menu-chip"
            aria-label={t("canvas.bulk.branchColour", { colour: c })}
            onClick={() => across((d, i) => setBranchColor(d, i, c))}
            style={{ background: c, width: 18, height: 18, padding: 0 }}
          />
        ))}
        <button
          type="button"
          className="mm-menu-chip"
          aria-label={t("canvas.defaultBranchColourOnThe")}
          onClick={() => across((d, i) => setBranchColor(d, i, ""))}
        >
          {t("panel.default")}
        </button>
      </div>
    </>
  );
}
