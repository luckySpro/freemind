// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLongPress } from "../src/hooks/useLongPress";

const evt = (over: Partial<React.PointerEvent> = {}) =>
  ({ pointerType: "touch", clientX: 0, clientY: 0, ...over }) as unknown as React.PointerEvent;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useLongPress", () => {
  it("fires after the delay for a stationary touch press", () => {
    const onLong = vi.fn();
    const { result } = renderHook(() => useLongPress(onLong, 500));
    act(() => result.current.onPointerDown(evt()));
    act(() => vi.advanceTimersByTime(499));
    expect(onLong).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onLong).toHaveBeenCalledTimes(1);
  });

  it("ignores a mouse press (it has a real right-click menu)", () => {
    const onLong = vi.fn();
    const { result } = renderHook(() => useLongPress(onLong, 500));
    act(() => result.current.onPointerDown(evt({ pointerType: "mouse" })));
    act(() => vi.advanceTimersByTime(1000));
    expect(onLong).not.toHaveBeenCalled();
  });

  it("cancels on pointer up before the delay", () => {
    const onLong = vi.fn();
    const { result } = renderHook(() => useLongPress(onLong, 500));
    act(() => result.current.onPointerDown(evt()));
    act(() => result.current.onPointerUp());
    act(() => vi.advanceTimersByTime(1000));
    expect(onLong).not.toHaveBeenCalled();
  });

  it("cancels when the finger moves past the threshold (a pan/scroll)", () => {
    const onLong = vi.fn();
    const { result } = renderHook(() => useLongPress(onLong, 500));
    act(() => result.current.onPointerDown(evt({ clientX: 0, clientY: 0 })));
    act(() => result.current.onPointerMove(evt({ clientX: 40, clientY: 0 })));
    act(() => vi.advanceTimersByTime(1000));
    expect(onLong).not.toHaveBeenCalled();
  });

  it("tolerates a tiny jitter within the threshold", () => {
    const onLong = vi.fn();
    const { result } = renderHook(() => useLongPress(onLong, 500));
    act(() => result.current.onPointerDown(evt({ clientX: 0, clientY: 0 })));
    act(() => result.current.onPointerMove(evt({ clientX: 3, clientY: 2 })));
    act(() => vi.advanceTimersByTime(500));
    expect(onLong).toHaveBeenCalledTimes(1);
  });
});
