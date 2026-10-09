import { t } from "../i18n";
import type { SelectedEdge } from "../mindmap";

// One-click relationship looks for the EdgeInspector. Each preset is a full style patch applied via
// the single `setLinkStyle` op (which now also takes `arrow`), so a preset sets the whole look —
// dash, width, curve, arrowhead — in one undo step. Pure data so it's trivially unit-tested.

export interface EdgePreset {
  /** Stable identity — the React key. Never the label, which follows the locale. */
  id: string;
  name: string;
  title: string;
  patch: {
    color?: string;
    width?: number;
    dash?: SelectedEdge["dash"];
    curve?: number;
    arrow?: SelectedEdge["arrow"];
  };
}

export const EDGE_PRESETS: EdgePreset[] = [
  {
    id: "arrow",
    get name() {
      return t("panel.preset.arrow");
    },
    get title() {
      return t("panel.preset.arrowTitle");
    },
    patch: { dash: "solid", width: 1.5, curve: 0, arrow: "to" },
  },
  {
    id: "dashed",
    get name() {
      return t("panel.dashed");
    },
    get title() {
      return t("panel.preset.dashedTitle");
    },
    patch: { dash: "dashed", width: 1.5, curve: undefined, arrow: "to" },
  },
  {
    id: "dotted",
    get name() {
      return t("panel.dotted");
    },
    get title() {
      return t("panel.preset.dottedTitle");
    },
    patch: { dash: "dotted", width: 1.5, curve: undefined, arrow: "to" },
  },
  {
    id: "thick",
    get name() {
      return t("panel.thick");
    },
    get title() {
      return t("panel.preset.thickTitle");
    },
    patch: { dash: "solid", width: 3, curve: 0, arrow: "to" },
  },
  {
    id: "curved",
    get name() {
      return t("panel.curved");
    },
    get title() {
      return t("panel.preset.curvedTitle");
    },
    patch: { dash: "solid", width: 1.5, curve: 30, arrow: "to" },
  },
  {
    id: "double",
    get name() {
      return t("panel.preset.double");
    },
    get title() {
      return t("panel.preset.doubleTitle");
    },
    patch: { dash: "solid", width: 1.5, curve: 0, arrow: "both" },
  },
];
