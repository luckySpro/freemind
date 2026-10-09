import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCommandPaletteHotkey } from "../src/hooks/useCommandPaletteHotkey";

// ⌘/Ctrl-K opens the in-editor command palette — only while enabled.

const ctrlK = () =>
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));

describe("useCommandPaletteHotkey", () => {
  it("opens on Ctrl/⌘-K when enabled, and the setter closes it", () => {
    const { result } = renderHook(() => useCommandPaletteHotkey(true));
    expect(result.current[0]).toBe(false);
    act(() => ctrlK());
    expect(result.current[0]).toBe(true);
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
  });

  it("ignores the hotkey when disabled (no listener attached)", () => {
    const { result } = renderHook(() => useCommandPaletteHotkey(false));
    act(() => ctrlK());
    expect(result.current[0]).toBe(false);
  });

  it("also opens on the ⌘ (meta) variant", () => {
    const { result } = renderHook(() => useCommandPaletteHotkey(true));
    act(() =>
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "K", metaKey: true, bubbles: true }),
      ),
    );
    expect(result.current[0]).toBe(true);
  });
});
