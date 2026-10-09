import { act, renderHook } from "@testing-library/react";
import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import { useFormatPainter } from "../src/hooks/useFormatPainter";
import type { MindMapHandle } from "../src/mindmap";
import type { NodeStyle } from "../src/model/types";

// useFormatPainter — copy a topic's style then paste it across a selection. Driven with a stub canvas
// handle so the copy/paste branches + the canPasteFormat gate are exercised without a DOM canvas.

function setup(handle: Partial<MindMapHandle> = {}) {
  const showHint = vi.fn();
  const mapRef = { current: handle as MindMapHandle } as RefObject<MindMapHandle | null>;
  const hook = renderHook(() => useFormatPainter(mapRef, showHint));
  return { hook, showHint };
}

describe("useFormatPainter", () => {
  it("copyFormat with no selection hints and stays un-pasteable", () => {
    const { hook, showHint } = setup({ copySelectedStyle: () => null });
    act(() => hook.result.current.copyFormat());
    expect(showHint).toHaveBeenCalledWith("Select a topic first, then Copy format.");
    expect(hook.result.current.canPasteFormat).toBe(false);
  });

  it("copyFormat with a real style enables paste", () => {
    const style: NodeStyle = { color: "#f00" };
    const { hook, showHint } = setup({ copySelectedStyle: () => style });
    act(() => hook.result.current.copyFormat());
    expect(hook.result.current.canPasteFormat).toBe(true);
    expect(showHint).toHaveBeenCalledWith("Format copied — select topic(s) and Paste format.");
  });

  it("copyFormat with an empty style says there's nothing to copy", () => {
    const { hook, showHint } = setup({ copySelectedStyle: () => ({}) });
    act(() => hook.result.current.copyFormat());
    expect(showHint).toHaveBeenCalledWith("That topic has no custom format to copy.");
    // an empty {} is still "copied" (non-null) so paste is enabled
    expect(hook.result.current.canPasteFormat).toBe(true);
  });

  it("pasteFormat is a no-op before anything is copied", () => {
    const setSelectedStyle = vi.fn(() => true);
    const { hook } = setup({ setSelectedStyle });
    act(() => hook.result.current.pasteFormat());
    expect(setSelectedStyle).not.toHaveBeenCalled();
  });

  it("pasteFormat applies the copied style, hinting when nothing is selected", () => {
    const setSelectedStyle = vi.fn(() => false); // nothing selected
    const { hook, showHint } = setup({
      copySelectedStyle: () => ({ color: "#0f0" }),
      setSelectedStyle,
    });
    act(() => hook.result.current.copyFormat());
    act(() => hook.result.current.pasteFormat());
    expect(setSelectedStyle).toHaveBeenCalledWith({ color: "#0f0" });
    expect(showHint).toHaveBeenCalledWith("Select a topic first.");
  });
});
