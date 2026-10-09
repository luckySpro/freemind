import { t } from "./i18n";
// One source of truth for every dockable panel's name (item 20). The left-dock TAB shows the terse
// base name; the Panels MENU shows a more descriptive form (the base plus a parenthetical/qualifier).
// Both the dock (App.tsx) and the menu (Toolbar.tsx) read from here, so the two vocabularies can't
// silently drift ("Index" vs "Markers & tags index", "Deck" vs "Slide deck (custom)"). A test locks
// that every dock key has an entry.

export interface PanelLabel {
  /** Terse label for the dock tab. */
  tab: string;
  /** Descriptive label for the Panels menu. */
  menu: string;
}

/** Panel key → its dock-tab + menu labels. Keys match the dock entry keys in App.tsx.
 *  Every label is a getter, not a plain field: a plain `tab: t("…")` here would resolve ONCE at
 *  import and never follow a later `setLocale` (see test/i18n-frozen-constants.test.ts). Getters
 *  re-run `t()` on every read, so the dock tab / Panels menu track the active locale like everything
 *  else — while the object's own keys (outline/index/relationships/…), which App.tsx and Toolbar.tsx
 *  both look up by, stay plain string literals and never move. */
export const PANEL_LABELS: Record<string, PanelLabel> = {
  outline: {
    get tab() {
      return t("panel.outline");
    },
    get menu() {
      return t("panel.outline");
    },
  },
  index: {
    get tab() {
      return t("panel.markersTags");
    },
    get menu() {
      return t("app.markersTagsIndex");
    },
  },
  relationships: {
    get tab() {
      return t("app.relationships");
    },
    get menu() {
      return t("app.relationships");
    },
  },
  stats: {
    get tab() {
      return t("app.stats");
    },
    get menu() {
      return t("app.mapStatistics");
    },
  },
  agenda: {
    get tab() {
      return t("app.agenda");
    },
    get menu() {
      return t("app.agendaDueTasks");
    },
  },
  maps: {
    get tab() {
      return t("app.maps");
    },
    get menu() {
      return t("app.mapsAllMaps");
    },
  },
  inbox: {
    get tab() {
      return t("app.inbox");
    },
    get menu() {
      return t("app.inboxQuickCapture");
    },
  },
  deck: {
    get tab() {
      return t("app.deck");
    },
    get menu() {
      return t("app.slideDeckCustom");
    },
  },
  note: {
    get tab() {
      return t("app.note");
    },
    get menu() {
      return t("app.noteEditorDockable");
    },
  },
  filter: {
    get tab() {
      return t("app.filter");
    },
    get menu() {
      return t("app.powerFilter");
    },
  },
  styles: {
    get tab() {
      return t("app.styles");
    },
    get menu() {
      return t("app.conditionalStyles");
    },
  },
  history: {
    get tab() {
      return t("app.history");
    },
    get menu() {
      return t("app.versionHistory");
    },
  },
  info: {
    get tab() {
      return t("panel.topicInfo");
    },
    get menu() {
      return t("app.topicInfoInspector");
    },
  },
};
