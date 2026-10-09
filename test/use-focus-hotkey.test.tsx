import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFocusHotkey } from "../src/hooks/useFocusHotkey";

// Focus mode (#9): Ctrl/⌘+. drills into the selected topic / exits if already drilled; Esc exits.

const press = (key: string, opts: Partial<KeyboardEvent> = {}) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, ...opts }));
  });

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useFocusHotkey", () => {
  it("Ctrl/⌘+. focuses the selected topic when not drilled", () => {
    const setDrillId = vi.fn();
    renderHook(() =>
      useFocusHotkey({ enabled: true, drillId: null, selectedId: "n1", setDrillId }),
    );
    press(".", { ctrlKey: true });
    expect(setDrillId).toHaveBeenCalledWith("n1");
  });

  it("Ctrl/⌘+. exits when already drilled, and so does Esc", () => {
    const setDrillId = vi.fn();
    renderHook(() =>
      useFocusHotkey({ enabled: true, drillId: "n1", selectedId: "n2", setDrillId }),
    );
    press(".", { metaKey: true });
    expect(setDrillId).toHaveBeenLastCalledWith(null);
    press("Escape");
    expect(setDrillId).toHaveBeenLastCalledWith(null);
  });

  it("Esc does nothing when not drilled", () => {
    const setDrillId = vi.fn();
    renderHook(() =>
      useFocusHotkey({ enabled: true, drillId: null, selectedId: "n1", setDrillId }),
    );
    press("Escape");
    expect(setDrillId).not.toHaveBeenCalled();
  });

  it("is inert when disabled, and ignores the key while typing in a field", () => {
    const setDrillId = vi.fn();
    const { rerender } = renderHook(
      (props: { enabled: boolean }) =>
        useFocusHotkey({ ...props, drillId: null, selectedId: "n1", setDrillId }),
      { initialProps: { enabled: false } },
    );
    press(".", { ctrlKey: true });
    expect(setDrillId).not.toHaveBeenCalled();

    rerender({ enabled: true });
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    press(".", { ctrlKey: true });
    expect(setDrillId).not.toHaveBeenCalled();
  });
});
