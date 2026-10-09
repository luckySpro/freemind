// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLatestRef } from "../src/mindmap/flow/useLatestRef";

describe("useLatestRef", () => {
  it("always exposes the latest value behind a stable ref object", () => {
    const { result, rerender } = renderHook(({ v }) => useLatestRef(v), {
      initialProps: { v: 1 },
    });
    const ref = result.current;
    expect(ref.current).toBe(1);
    rerender({ v: 2 });
    expect(result.current).toBe(ref); // identity is stable across renders
    expect(result.current.current).toBe(2); // value tracks the latest prop
    rerender({ v: 3 });
    expect(result.current.current).toBe(3);
  });

  it("preserves an imperative write until the next render re-mirrors", () => {
    const { result, rerender } = renderHook(({ v }) => useLatestRef(v), {
      initialProps: { v: "a" },
    });
    result.current.current = "imperative"; // a caller (e.g. sync) overwrites between renders
    expect(result.current.current).toBe("imperative");
    rerender({ v: "b" }); // the next render mirrors the latest value again
    expect(result.current.current).toBe("b");
  });
});
