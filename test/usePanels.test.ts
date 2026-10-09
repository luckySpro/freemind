// Hook test (renderHook) for usePanels — the panel/filter/saved-filter state extracted from App.tsx.
// Asserts the behaviours App used to own inline: panels restore from "mindmap-panels", toggling the
// durable panels persists, closing the Filter panel clears the active filter, and saved-filter
// presets round-trip through "mindmap-saved-filters" (add / apply / delete).
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { usePanels } from "../src/hooks/usePanels";

afterEach(() => {
  localStorage.clear();
});

describe("usePanels — panel toggles + persistence", () => {
  it("defaults every panel closed (and numbering off) from an empty localStorage", () => {
    const { result } = renderHook(() => usePanels());
    const p = result.current.panels;
    expect(p.outlineOpen).toBe(false);
    expect(p.indexOpen).toBe(false);
    expect(p.infoOpen).toBe(false);
    expect(p.filterOpen).toBe(false);
    expect(p.stylesOpen).toBe(false);
    expect(p.historyOpen).toBe(false);
    expect(p.boardOpen).toBe(false);
    expect(p.statsOpen).toBe(false);
    expect(p.noteEditorOpen).toBe(false);
    expect(p.numbered).toBe(false);
    expect(p.spellcheck).toBe(false);
  });

  it("restores the durable panels (outline/index/info/numbered) from seeded localStorage", () => {
    localStorage.setItem(
      "mindmap-panels",
      JSON.stringify({
        outlineOpen: true,
        indexOpen: true,
        infoOpen: true,
        infoAutoOpen: false,
        numbered: true,
        spellcheck: true,
      }),
    );
    const { result } = renderHook(() => usePanels());
    const p = result.current.panels;
    expect(p.outlineOpen).toBe(true);
    expect(p.indexOpen).toBe(true);
    expect(p.infoOpen).toBe(true);
    expect(p.numbered).toBe(true);
    expect(p.spellcheck).toBe(true);
  });

  it("starts the inspector closed once for a layout saved before infoAutoOpen existed", () => {
    // Auto-open used to leave infoOpen:true in almost every saved layout; without this the new
    // open-on-request default would never be seen by an existing user.
    localStorage.setItem("mindmap-panels", JSON.stringify({ infoOpen: true }));
    const legacy = renderHook(() => usePanels());
    expect(legacy.result.current.panels.infoOpen).toBe(false);
    expect(legacy.result.current.panels.infoAutoOpen).toBe(false);
    act(() => legacy.result.current.panels.setInfoOpen(true));
    legacy.unmount();
    // Saved again with infoAutoOpen present → an open inspector now survives a reload.
    const next = renderHook(() => usePanels());
    expect(next.result.current.panels.infoOpen).toBe(true);
  });

  it("persists the open-on-select opt-in", () => {
    const a = renderHook(() => usePanels());
    expect(a.result.current.panels.infoAutoOpen).toBe(false);
    act(() => a.result.current.panels.setInfoAutoOpen(true));
    a.unmount();
    expect(renderHook(() => usePanels()).result.current.panels.infoAutoOpen).toBe(true);
  });

  it("defaults + persists + restores the dock width and active dock tab", () => {
    const fresh = renderHook(() => usePanels());
    expect(fresh.result.current.panels.dockWidth).toBe(280); // DOCK_DEFAULT
    expect(fresh.result.current.panels.dockActive).toBeNull();
    fresh.unmount();

    const a = renderHook(() => usePanels());
    act(() => a.result.current.panels.setDockWidth(420));
    act(() => a.result.current.panels.setDockActive("stats"));
    a.unmount();

    const b = renderHook(() => usePanels());
    expect(b.result.current.panels.dockWidth).toBe(420);
    expect(b.result.current.panels.dockActive).toBe("stats");
  });

  it("clamps a junk persisted dock width into range", () => {
    localStorage.setItem("mindmap-panels", JSON.stringify({ dockWidth: 99999 }));
    const { result } = renderHook(() => usePanels());
    expect(result.current.panels.dockWidth).toBe(600); // clamped to DOCK_MAX
  });

  it("does NOT persist the session-only panels (styles/history/board/filter) across a remount", () => {
    const first = renderHook(() => usePanels());
    act(() => first.result.current.panels.setStylesOpen(true));
    act(() => first.result.current.panels.setHistoryOpen(true));
    act(() => first.result.current.panels.setBoardOpen(true));
    // A fresh mount reads only "mindmap-panels", which never holds these → all closed again.
    const second = renderHook(() => usePanels());
    expect(second.result.current.panels.stylesOpen).toBe(false);
    expect(second.result.current.panels.historyOpen).toBe(false);
    expect(second.result.current.panels.boardOpen).toBe(false);
  });

  it("persists a durable-panel toggle to localStorage, so a remount restores it", () => {
    const first = renderHook(() => usePanels());
    act(() => first.result.current.panels.setOutlineOpen(true));
    act(() => first.result.current.panels.setNumbered(true));
    // The persisted blob reflects the toggles.
    const stored = JSON.parse(localStorage.getItem("mindmap-panels") ?? "{}");
    expect(stored.outlineOpen).toBe(true);
    expect(stored.numbered).toBe(true);
    // And a fresh mount picks them up.
    const second = renderHook(() => usePanels());
    expect(second.result.current.panels.outlineOpen).toBe(true);
    expect(second.result.current.panels.numbered).toBe(true);
  });

  it("persists the sticky infoMinimized flag (defaults false, survives a remount)", () => {
    const first = renderHook(() => usePanels());
    expect(first.result.current.panels.infoMinimized).toBe(false);
    act(() => first.result.current.panels.setInfoMinimized(true));
    expect(JSON.parse(localStorage.getItem("mindmap-panels") ?? "{}").infoMinimized).toBe(true);
    const second = renderHook(() => usePanels());
    expect(second.result.current.panels.infoMinimized).toBe(true);
  });

  it("seeds + persists the inspector width (default 300, clamped, round-trips)", () => {
    const first = renderHook(() => usePanels());
    expect(first.result.current.panels.inspectorWidth).toBe(300);
    act(() => first.result.current.panels.setInspectorWidth(420));
    expect(JSON.parse(localStorage.getItem("mindmap-panels") ?? "{}").inspectorWidth).toBe(420);
    expect(renderHook(() => usePanels()).result.current.panels.inspectorWidth).toBe(420);
  });

  it("clamps an out-of-range / junk persisted inspector width", () => {
    localStorage.setItem("mindmap-panels", JSON.stringify({ inspectorWidth: 99999 }));
    expect(renderHook(() => usePanels()).result.current.panels.inspectorWidth).toBe(560);
    localStorage.setItem("mindmap-panels", JSON.stringify({ inspectorWidth: "wide" }));
    expect(renderHook(() => usePanels()).result.current.panels.inspectorWidth).toBe(300);
  });
});

describe("usePanels — Power Filter", () => {
  it("toggleFilter opens, then closing it clears every filter field", () => {
    const { result } = renderHook(() => usePanels());
    // Open the filter and set every field.
    act(() => result.current.panels.toggleFilter());
    expect(result.current.panels.filterOpen).toBe(true);
    act(() => {
      result.current.filter.setText("roadmap");
      result.current.filter.toggleMarker("⭐");
      result.current.filter.toggleTag("risk");
      result.current.filter.setDue("overdue");
      result.current.filter.setPriority(1);
    });
    expect(result.current.filter.text).toBe("roadmap");
    expect(result.current.filter.markers).toEqual(["⭐"]);
    expect(result.current.filter.criteria.priority).toBe(1);
    // Closing the panel wipes the filter (so dimming can't outlive a hidden control).
    act(() => result.current.panels.toggleFilter());
    expect(result.current.panels.filterOpen).toBe(false);
    expect(result.current.filter.text).toBe("");
    expect(result.current.filter.markers).toEqual([]);
    expect(result.current.filter.tags).toEqual([]);
    expect(result.current.filter.due).toBe("");
    expect(result.current.filter.priority).toBe(0);
  });

  it("toggleMarker / toggleTag add then remove a value", () => {
    const { result } = renderHook(() => usePanels());
    act(() => result.current.filter.toggleMarker("🚩"));
    expect(result.current.filter.markers).toEqual(["🚩"]);
    act(() => result.current.filter.toggleMarker("🚩"));
    expect(result.current.filter.markers).toEqual([]);
    act(() => result.current.filter.toggleTag("now"));
    expect(result.current.filter.tags).toEqual(["now"]);
    act(() => result.current.filter.toggleTag("now"));
    expect(result.current.filter.tags).toEqual([]);
  });

  it("criteria maps priority 0 to undefined (the 'any' sentinel)", () => {
    const { result } = renderHook(() => usePanels());
    expect(result.current.filter.criteria.priority).toBeUndefined();
    act(() => result.current.filter.setPriority(2));
    expect(result.current.filter.criteria.priority).toBe(2);
  });

  it("clear() resets the fields without closing the panel", () => {
    const { result } = renderHook(() => usePanels());
    act(() => result.current.panels.toggleFilter());
    act(() => {
      result.current.filter.setText("x");
      result.current.filter.setPriority(3);
    });
    act(() => result.current.filter.clear());
    expect(result.current.panels.filterOpen).toBe(true); // still open
    expect(result.current.filter.text).toBe("");
    expect(result.current.filter.priority).toBe(0);
  });
});

describe("usePanels — saved-filter presets", () => {
  it("save → persists a named preset and exposes it in the list", () => {
    const { result } = renderHook(() => usePanels());
    act(() => {
      result.current.filter.setText("blocked");
      result.current.filter.toggleMarker("🚩");
    });
    act(() => result.current.savedFilters.save("Blockers"));
    const list = result.current.savedFilters.list;
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Blockers");
    expect(list[0].criteria.text).toBe("blocked");
    expect(list[0].criteria.markers).toEqual(["🚩"]);
    // Persisted to localStorage under the saved-filters key.
    const stored = JSON.parse(localStorage.getItem("mindmap-saved-filters") ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("Blockers");
  });

  it("save is a no-op for a blank name or an inactive (empty) filter", () => {
    const { result } = renderHook(() => usePanels());
    act(() => result.current.savedFilters.save("")); // blank name
    act(() => result.current.savedFilters.save("Nothing")); // active filter not set
    expect(result.current.savedFilters.list).toHaveLength(0);
  });

  it("save replaces a same-named preset rather than duplicating it", () => {
    const { result } = renderHook(() => usePanels());
    act(() => result.current.filter.setText("v1"));
    act(() => result.current.savedFilters.save("Dupe"));
    act(() => result.current.filter.setText("v2"));
    act(() => result.current.savedFilters.save("Dupe"));
    expect(result.current.savedFilters.list).toHaveLength(1);
    expect(result.current.savedFilters.list[0].criteria.text).toBe("v2");
  });

  it("apply loads a preset's criteria into the live filter fields", () => {
    const { result } = renderHook(() => usePanels());
    act(() =>
      result.current.savedFilters.apply({
        text: "due",
        markers: ["⭐"],
        tags: ["q3"],
        due: "soon",
        priority: 2,
      }),
    );
    expect(result.current.filter.text).toBe("due");
    expect(result.current.filter.markers).toEqual(["⭐"]);
    expect(result.current.filter.tags).toEqual(["q3"]);
    expect(result.current.filter.due).toBe("soon");
    expect(result.current.filter.priority).toBe(2);
  });

  it("remove deletes the preset by id (and the deletion persists)", () => {
    const { result } = renderHook(() => usePanels());
    act(() => result.current.filter.setText("a"));
    act(() => result.current.savedFilters.save("A"));
    act(() => result.current.filter.setText("b"));
    act(() => result.current.savedFilters.save("B"));
    expect(result.current.savedFilters.list).toHaveLength(2);
    const idA = result.current.savedFilters.list.find((f) => f.name === "A")?.id ?? "";
    act(() => result.current.savedFilters.remove(idA));
    expect(result.current.savedFilters.list).toHaveLength(1);
    expect(result.current.savedFilters.list[0].name).toBe("B");
    const stored = JSON.parse(localStorage.getItem("mindmap-saved-filters") ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("B");
  });

  it("restores saved presets from seeded localStorage on mount", () => {
    localStorage.setItem(
      "mindmap-saved-filters",
      JSON.stringify([
        { id: "s1", name: "Seeded", criteria: { text: "x", markers: [], tags: [] } },
      ]),
    );
    const { result } = renderHook(() => usePanels());
    expect(result.current.savedFilters.list).toHaveLength(1);
    expect(result.current.savedFilters.list[0].name).toBe("Seeded");
  });
});
