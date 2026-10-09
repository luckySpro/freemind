import { describe, expect, it } from "vitest";
import { PANEL_LABELS } from "../src/panelLabels";

// Shared panel-name constants (item 20): the single source both the dock tabs (App.tsx) and the
// Panels menu (Toolbar.tsx) read from, so the two vocabularies can't drift. This locks the shape.

describe("PANEL_LABELS", () => {
  it("gives every panel a non-empty tab + menu label", () => {
    for (const [key, { tab, menu }] of Object.entries(PANEL_LABELS)) {
      expect(tab, `${key}.tab`).toBeTruthy();
      expect(menu, `${key}.menu`).toBeTruthy();
    }
  });

  it("keeps the dock tab as terse as, or terser than, the descriptive menu label", () => {
    // The menu label is the base plus an optional qualifier, so it's never shorter than the tab.
    for (const [key, { tab, menu }] of Object.entries(PANEL_LABELS)) {
      expect(menu.length, `${key}: menu should be ≥ tab`).toBeGreaterThanOrEqual(tab.length);
    }
  });

  it("covers every dockable panel key the app uses", () => {
    // If a new dock panel is added without a label entry, this fails loudly (the whole point).
    const required = [
      "outline",
      "index",
      "relationships",
      "stats",
      "agenda",
      "maps",
      "inbox",
      "deck",
      "note",
      "filter",
      "styles",
      "history",
    ];
    for (const k of required) expect(PANEL_LABELS).toHaveProperty(k);
  });
});
