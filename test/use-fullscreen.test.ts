// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFullscreen } from "../src/hooks/useFullscreen";

describe("useFullscreen", () => {
  it("toggles the mode and asks the browser for real full screen", () => {
    const request = vi.fn(() => Promise.resolve());
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: request,
    });
    const { result } = renderHook(() => useFullscreen(true));
    expect(result.current.on).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.on).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    act(() => result.current.exit());
    expect(result.current.on).toBe(false);
  });

  it("leaves the mode when the browser leaves full screen (Esc / Back)", () => {
    const { result } = renderHook(() => useFullscreen(true));
    act(() => result.current.toggle());
    act(() => {
      document.dispatchEvent(new Event("fullscreenchange")); // fullscreenElement is null in jsdom
    });
    expect(result.current.on).toBe(false);
  });

  it("always exits when leaving the editor", () => {
    const { result, rerender } = renderHook(({ active }) => useFullscreen(active), {
      initialProps: { active: true },
    });
    act(() => result.current.toggle());
    rerender({ active: false });
    expect(result.current.on).toBe(false);
  });
});
