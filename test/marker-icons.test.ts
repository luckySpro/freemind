import { describe, expect, it } from "vitest";
import {
  MARKER_CATALOG,
  MARKER_GROUPS,
  MARKER_PALETTE,
  markerGroupOf,
  markerImage,
  searchMarkers,
  toggleMarkerInList,
} from "../src/icons";

// The flat vector marker set replaces OS colour emoji — every palette marker must resolve to a
// platform-consistent data: URL (rendered as an <img>/<image> on canvas + export); an unknown marker
// falls back to its literal character.
describe("marker vector icons", () => {
  it("returns an SVG data: URL for every palette marker", () => {
    for (const m of MARKER_PALETTE) {
      expect(markerImage(m), m).toMatch(/^data:image\/svg\+xml,/);
    }
  });

  it("returns null for an unknown marker (→ render the literal character)", () => {
    expect(markerImage("🦄")).toBeNull();
    expect(markerImage("anything")).toBeNull();
  });

  it("is deterministic", () => {
    expect(markerImage("⭐")).toBe(markerImage("⭐"));
  });
});

// The searchable marker library is a superset of the curated palette; searchMarkers matches by name,
// keyword or glyph so the inspector can find a marker by meaning.
describe("searchMarkers", () => {
  it("returns the whole catalog for an empty query", () => {
    expect(searchMarkers("")).toEqual(MARKER_CATALOG.map((m) => m.icon));
    expect(searchMarkers("   ")).toHaveLength(MARKER_CATALOG.length);
  });

  it("is a superset of the curated palette", () => {
    const all = new Set(searchMarkers(""));
    for (const m of MARKER_PALETTE) expect(all.has(m), m).toBe(true);
  });

  it("matches by keyword and by name, case-insensitively", () => {
    expect(searchMarkers("done")).toContain("✅");
    expect(searchMarkers("warning")).toContain("⚠️");
    expect(searchMarkers("STAR")).toContain("⭐");
    expect(searchMarkers("budget")).toContain("💰");
  });

  it("matches by the glyph itself", () => {
    expect(searchMarkers("🎯")).toEqual(["🎯"]);
  });

  it("requires every token to hit (AND semantics)", () => {
    expect(searchMarkers("status dot")).toContain("🔵");
    expect(searchMarkers("status zzz")).toEqual([]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(searchMarkers("nonexistentxyz")).toEqual([]);
  });
});

// Marker groups are single-select sets — a topic carries at most one per group, so picking another in
// the group replaces it; free markers (not in a group) multi-toggle as before.
describe("marker groups", () => {
  it("maps grouped markers to their group, free markers to null", () => {
    expect(markerGroupOf("🔴")).toBe("status");
    expect(markerGroupOf("🟢")).toBe("status");
    expect(markerGroupOf("1️⃣")).toBe("priority");
    expect(markerGroupOf("⭐")).toBeNull();
  });

  it("every group member resolves back to its group", () => {
    for (const g of MARKER_GROUPS) for (const m of g.members) expect(markerGroupOf(m)).toBe(g.id);
  });

  it("toggleMarkerInList replaces a sibling in the same group when adding", () => {
    expect(toggleMarkerInList(["🔴"], "🟢")).toEqual(["🟢"]); // status: 🔴 → 🟢
    expect(toggleMarkerInList(["⭐", "🔴"], "🟡")).toEqual(["⭐", "🟡"]); // free marker kept
  });

  it("toggleMarkerInList removes a present marker (toggle off) and multi-toggles free markers", () => {
    expect(toggleMarkerInList(["🟢"], "🟢")).toEqual([]);
    expect(toggleMarkerInList(["⭐"], "❗")).toEqual(["⭐", "❗"]); // both free → coexist
  });
});
