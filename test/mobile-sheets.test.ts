import { describe, expect, it, vi } from "vitest";
import { type MobileSheetPanels, anyMobileSheetOpen, closeMobileSheets } from "../src/mobileSheets";

function panels(over: Partial<MobileSheetPanels> = {}): MobileSheetPanels {
  return {
    outlineOpen: false,
    setOutlineOpen: vi.fn(),
    indexOpen: false,
    setIndexOpen: vi.fn(),
    relationshipsOpen: false,
    setRelationshipsOpen: vi.fn(),
    statsOpen: false,
    setStatsOpen: vi.fn(),
    agendaOpen: false,
    setAgendaOpen: vi.fn(),
    mapsOpen: false,
    setMapsOpen: vi.fn(),
    inboxOpen: false,
    setInboxOpen: vi.fn(),
    deckEditorOpen: false,
    setDeckEditorOpen: vi.fn(),
    noteEditorOpen: false,
    setNoteEditorOpen: vi.fn(),
    filterOpen: false,
    toggleFilter: vi.fn(),
    stylesOpen: false,
    setStylesOpen: vi.fn(),
    historyOpen: false,
    setHistoryOpen: vi.fn(),
    infoOpen: false,
    setInfoOpen: vi.fn(),
    infoMinimized: false,
    setInfoMinimized: vi.fn(),
    ...over,
  } as MobileSheetPanels;
}

describe("anyMobileSheetOpen", () => {
  it("is false when nothing is open", () => {
    expect(anyMobileSheetOpen(panels())).toBe(false);
  });

  it("is true when any left-dock panel is open", () => {
    expect(anyMobileSheetOpen(panels({ outlineOpen: true }))).toBe(true);
    expect(anyMobileSheetOpen(panels({ historyOpen: true }))).toBe(true);
    expect(anyMobileSheetOpen(panels({ filterOpen: true }))).toBe(true);
    expect(anyMobileSheetOpen(panels({ agendaOpen: true }))).toBe(true);
    expect(anyMobileSheetOpen(panels({ relationshipsOpen: true }))).toBe(true);
    expect(anyMobileSheetOpen(panels({ inboxOpen: true }))).toBe(true);
  });

  it("is true for the open inspector but false once it's minimized", () => {
    expect(anyMobileSheetOpen(panels({ infoOpen: true }))).toBe(true);
    expect(anyMobileSheetOpen(panels({ infoOpen: true, infoMinimized: true }))).toBe(false);
  });
});

describe("closeMobileSheets", () => {
  it("closes every left-dock panel and minimizes the inspector", () => {
    const p = panels({ filterOpen: true });
    closeMobileSheets(p);
    expect(p.setOutlineOpen).toHaveBeenCalled();
    expect(p.setHistoryOpen).toHaveBeenCalled();
    expect(p.setStylesOpen).toHaveBeenCalled();
    expect(p.setRelationshipsOpen).toHaveBeenCalled();
    expect(p.setInboxOpen).toHaveBeenCalled();
    expect(p.toggleFilter).toHaveBeenCalledTimes(1); // open filter → toggled off (also clears it)
    expect(p.setInfoMinimized).toHaveBeenCalled();
    expect(p.setInfoOpen).toHaveBeenCalled();
    // the close setters receive a function that returns false
    const updater = (p.setOutlineOpen as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][0] as () => boolean;
    expect(updater()).toBe(false);
  });

  it("doesn't toggle the filter when it's already closed", () => {
    const p = panels({ filterOpen: false });
    closeMobileSheets(p);
    expect(p.toggleFilter).not.toHaveBeenCalled();
  });
});
