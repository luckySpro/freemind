// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOpenDocuments } from "../src/hooks/useOpenDocuments";

// The registry persists via mapStore.setTabSession — mock it so the test asserts the calls without a
// real IndexedDB.
const setTabSession = vi.fn();
vi.mock("../src/store/mapStore", () => ({
  setTabSession: (s: unknown) => setTabSession(s),
}));

describe("useOpenDocuments", () => {
  beforeEach(() => setTabSession.mockClear());

  it("ensureOpen registers a tab + makes it active, and is idempotent", () => {
    const { result } = renderHook(() => useOpenDocuments());
    act(() => result.current.ensureOpen("a"));
    expect(result.current.openIds).toEqual(["a"]);
    act(() => result.current.ensureOpen("b"));
    expect(result.current.openIds).toEqual(["a", "b"]);
    act(() => result.current.ensureOpen("a")); // re-opening an open map doesn't duplicate it
    expect(result.current.openIds).toEqual(["a", "b"]);
  });

  it("closeTab removes the tab and returns the neighbour to activate", () => {
    const { result } = renderHook(() => useOpenDocuments());
    act(() => {
      result.current.ensureOpen("a");
      result.current.ensureOpen("b");
      result.current.ensureOpen("c");
    });
    let neighbour: string | null = "unset";
    act(() => {
      neighbour = result.current.closeTab("b");
    });
    expect(result.current.openIds).toEqual(["a", "c"]);
    expect(neighbour).toBe("c");
  });

  it("closeTab on the last tab returns null", () => {
    const { result } = renderHook(() => useOpenDocuments());
    act(() => result.current.ensureOpen("only"));
    let neighbour: string | null = "unset";
    act(() => {
      neighbour = result.current.closeTab("only");
    });
    expect(result.current.openIds).toEqual([]);
    expect(neighbour).toBeNull();
  });

  it("restoreSession seeds the open set + active id", () => {
    const { result } = renderHook(() => useOpenDocuments());
    act(() => result.current.restoreSession({ openTabIds: ["x", "y", "z"], activeTabId: "y" }));
    expect(result.current.openIds).toEqual(["x", "y", "z"]);
  });

  it("persists the session whenever there is an active tab", async () => {
    const { result } = renderHook(() => useOpenDocuments());
    act(() => result.current.ensureOpen("a"));
    await waitFor(() =>
      expect(setTabSession).toHaveBeenCalledWith({ openTabIds: ["a"], activeTabId: "a" }),
    );
  });

  it("does not persist before anything is open (no clobbering on mount)", () => {
    renderHook(() => useOpenDocuments());
    expect(setTabSession).not.toHaveBeenCalled();
  });

  it("persists an empty session when the last tab is closed (so it doesn't resurrect)", async () => {
    const { result } = renderHook(() => useOpenDocuments());
    act(() => result.current.ensureOpen("a"));
    await waitFor(() =>
      expect(setTabSession).toHaveBeenCalledWith({ openTabIds: ["a"], activeTabId: "a" }),
    );
    setTabSession.mockClear();
    act(() => {
      result.current.closeTab("a");
    });
    await waitFor(() =>
      expect(setTabSession).toHaveBeenCalledWith({ openTabIds: [], activeTabId: "" }),
    );
  });

  it("closing two tabs in the same tick removes both (batch-safe)", () => {
    const { result } = renderHook(() => useOpenDocuments());
    act(() => {
      result.current.ensureOpen("a");
      result.current.ensureOpen("b");
      result.current.ensureOpen("c");
    });
    act(() => {
      result.current.closeTab("a");
      result.current.closeTab("b");
    });
    expect(result.current.openIds).toEqual(["c"]);
  });

  it("reorder moves a tab to a new index", () => {
    const { result } = renderHook(() => useOpenDocuments());
    act(() => {
      result.current.ensureOpen("a");
      result.current.ensureOpen("b");
      result.current.ensureOpen("c");
    });
    act(() => result.current.reorder(0, 2)); // move "a" to the end
    expect(result.current.openIds).toEqual(["b", "c", "a"]);
    act(() => result.current.reorder(2, 0)); // and back to the front
    expect(result.current.openIds).toEqual(["a", "b", "c"]);
  });

  it("reorder ignores identical / out-of-range indices", () => {
    const { result } = renderHook(() => useOpenDocuments());
    act(() => {
      result.current.ensureOpen("a");
      result.current.ensureOpen("b");
    });
    act(() => result.current.reorder(1, 1)); // no-op
    act(() => result.current.reorder(0, 9)); // out of range → no-op
    expect(result.current.openIds).toEqual(["a", "b"]);
  });
});
