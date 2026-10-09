import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useToast } from "../src/hooks/useToast";

// useToast — the transient toast/hint banner lifted out of App: show / auto-dismiss / manual dismiss,
// and the unmount cleanup that stops a pending timer firing setState after teardown.

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useToast", () => {
  it("showHint shows an info toast that auto-dismisses after the default 4s", () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toast).toBeNull();
    act(() => result.current.showHint("Saved"));
    expect(result.current.toast).toMatchObject({ kind: "info", message: "Saved" });
    act(() => vi.advanceTimersByTime(3999));
    expect(result.current.toast).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.toast).toBeNull();
  });

  it("showToast carries kind + action and honours a custom duration", () => {
    const run = vi.fn();
    const { result } = renderHook(() => useToast());
    act(() =>
      result.current.showToast("success", "Updated", {
        action: { label: "Go", run },
        durationMs: 100,
      }),
    );
    expect(result.current.toast).toMatchObject({ kind: "success", action: { label: "Go" } });
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.toast).toBeNull();
  });

  it("a new toast resets the pending auto-dismiss timer", () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showHint("first"));
    act(() => vi.advanceTimersByTime(3000));
    act(() => result.current.showHint("second")); // resets the 4s clock
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.toast).toMatchObject({ message: "second" }); // not dismissed yet
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.toast).toBeNull();
  });

  it("dismiss() clears the toast immediately", () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showHint("bye"));
    act(() => result.current.dismiss());
    expect(result.current.toast).toBeNull();
  });

  it("clears its timer on unmount (no setState after teardown)", () => {
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");
    const { result, unmount } = renderHook(() => useToast());
    act(() => result.current.showHint("pending"));
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });
});
