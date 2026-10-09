import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNamedStyles } from "../src/hooks/useNamedStyles";
import type { MapNode } from "../src/model/types";

// useNamedStyles owns the app-wide "styles organizer": a localStorage-persisted list of saved looks,
// plus capture-from-selection and delete. Driven here in isolation (renderHook), no App needed.

const KEY = "mindmap-named-styles";
const node = (over: Partial<MapNode> = {}): MapNode => ({
  id: "a",
  topic: "A",
  children: [],
  ...over,
});

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("useNamedStyles", () => {
  it("starts from localStorage (empty → [], malformed → [])", () => {
    expect(
      renderHook(() => useNamedStyles({ selectedNode: null, showHint: vi.fn() })).result.current
        .namedStyles,
    ).toEqual([]);
    localStorage.setItem(KEY, "{not json");
    expect(
      renderHook(() => useNamedStyles({ selectedNode: null, showHint: vi.fn() })).result.current
        .namedStyles,
    ).toEqual([]);
    localStorage.setItem(
      KEY,
      JSON.stringify([{ id: "x", name: "Loud", style: { color: "#f00" } }]),
    );
    expect(
      renderHook(() => useNamedStyles({ selectedNode: null, showHint: vi.fn() })).result.current
        .namedStyles,
    ).toEqual([{ id: "x", name: "Loud", style: { color: "#f00" } }]);
  });

  it("saves the selected node's style under a name and persists it", () => {
    const styled = node({ style: { background: "#fff", color: "#000" } });
    const { result } = renderHook(() =>
      useNamedStyles({ selectedNode: styled, showHint: vi.fn() }),
    );
    act(() => result.current.saveNamedStyle("Card"));
    expect(result.current.namedStyles).toHaveLength(1);
    expect(result.current.namedStyles[0]).toMatchObject({
      name: "Card",
      style: { background: "#fff", color: "#000" },
    });
    // persisted to localStorage
    expect(JSON.parse(localStorage.getItem(KEY) ?? "[]")[0].name).toBe("Card");
  });

  it("replaces a same-named style rather than duplicating it", () => {
    const styled = node({ style: { color: "#111" } });
    const { result, rerender } = renderHook(
      (p: { selectedNode: MapNode | null }) =>
        useNamedStyles({ selectedNode: p.selectedNode, showHint: vi.fn() }),
      { initialProps: { selectedNode: styled } },
    );
    act(() => result.current.saveNamedStyle("Brand"));
    rerender({ selectedNode: node({ style: { color: "#222" } }) });
    act(() => result.current.saveNamedStyle("Brand"));
    expect(result.current.namedStyles).toHaveLength(1); // replaced, not appended
    expect(result.current.namedStyles[0].style).toEqual({ color: "#222" });
  });

  it("hints (and saves nothing) when there's no styled selection", () => {
    const showHint = vi.fn();
    const { result } = renderHook(() => useNamedStyles({ selectedNode: node(), showHint })); // no style
    act(() => result.current.saveNamedStyle("X"));
    expect(showHint).toHaveBeenCalledTimes(1);
    expect(result.current.namedStyles).toEqual([]);
    // also a null selection
    const r2 = renderHook(() => useNamedStyles({ selectedNode: null, showHint }));
    act(() => r2.result.current.saveNamedStyle("X"));
    expect(showHint).toHaveBeenCalledTimes(2);
  });

  it("deletes a style by id", () => {
    const styled = node({ style: { color: "#abc" } });
    const { result } = renderHook(() =>
      useNamedStyles({ selectedNode: styled, showHint: vi.fn() }),
    );
    act(() => result.current.saveNamedStyle("One"));
    const id = result.current.namedStyles[0].id;
    act(() => result.current.deleteNamedStyle(id));
    expect(result.current.namedStyles).toEqual([]);
    expect(JSON.parse(localStorage.getItem(KEY) ?? "[]")).toEqual([]);
  });
});
