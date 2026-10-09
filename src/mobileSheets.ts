import type { PanelsState } from "./hooks/usePanels";

// On a phone the side panels + the inspector dock as bottom sheets (mobile.css). These two helpers
// drive the tap-out scrim App renders over them: `anyMobileSheetOpen` decides whether the scrim shows,
// and `closeMobileSheets` dismisses whatever is open. Extracted from App so the (otherwise mobile-only,
// hard-to-integration-test) logic is unit-testable against a plain panels object.

/** The panels-state subset the mobile-sheet helpers touch — every left-dock panel toggle plus the
 *  inspector's open/minimized flags. A structural type so a test can pass a plain mock. */
export type MobileSheetPanels = Pick<
  PanelsState,
  | "outlineOpen"
  | "setOutlineOpen"
  | "indexOpen"
  | "setIndexOpen"
  | "relationshipsOpen"
  | "setRelationshipsOpen"
  | "statsOpen"
  | "setStatsOpen"
  | "agendaOpen"
  | "setAgendaOpen"
  | "mapsOpen"
  | "setMapsOpen"
  | "inboxOpen"
  | "setInboxOpen"
  | "deckEditorOpen"
  | "setDeckEditorOpen"
  | "noteEditorOpen"
  | "setNoteEditorOpen"
  | "filterOpen"
  | "toggleFilter"
  | "stylesOpen"
  | "setStylesOpen"
  | "historyOpen"
  | "setHistoryOpen"
  | "infoOpen"
  | "setInfoOpen"
  | "infoMinimized"
  | "setInfoMinimized"
>;

/** True when any left-dock panel OR the (non-minimized) inspector is open — i.e. a bottom sheet is up. */
export function anyMobileSheetOpen(p: MobileSheetPanels): boolean {
  return (
    p.outlineOpen ||
    p.indexOpen ||
    p.relationshipsOpen ||
    p.statsOpen ||
    p.agendaOpen ||
    p.mapsOpen ||
    p.inboxOpen ||
    p.deckEditorOpen ||
    p.noteEditorOpen ||
    p.filterOpen ||
    p.stylesOpen ||
    p.historyOpen ||
    (p.infoOpen && !p.infoMinimized)
  );
}

/** Dismiss every open sheet — close the left-dock panels and minimize the inspector. */
export function closeMobileSheets(p: MobileSheetPanels): void {
  p.setOutlineOpen(() => false);
  p.setIndexOpen(() => false);
  p.setRelationshipsOpen(() => false);
  p.setStatsOpen(() => false);
  p.setAgendaOpen(() => false);
  p.setMapsOpen(() => false);
  p.setInboxOpen(() => false);
  p.setDeckEditorOpen(() => false);
  p.setNoteEditorOpen(() => false);
  p.setStylesOpen(() => false);
  p.setHistoryOpen(() => false);
  if (p.filterOpen) p.toggleFilter();
  p.setInfoMinimized(() => true);
  p.setInfoOpen(() => false);
}
