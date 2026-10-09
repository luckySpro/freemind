// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useReducedMotion } from "../src/useReducedMotion";

// Drive the OS preference through a controllable matchMedia stub.
let osReduced = false;
beforeEach(() => {
  osReduced = false;
  localStorage.clear();
  document.body.className = "";
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: q.includes("reduce") ? osReduced : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("useReducedMotion", () => {
  it("defaults to following the OS preference", () => {
    osReduced = true;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current.motionPref).toBe("system");
    expect(result.current.reducedMotion).toBe(true);
    expect(document.body.classList.contains("reduce-motion")).toBe(true);
  });

  it("forces reduced / full regardless of the OS, and persists the choice", () => {
    const { result } = renderHook(() => useReducedMotion()); // OS = full motion
    expect(result.current.reducedMotion).toBe(false);

    act(() => result.current.setMotionPref("reduced"));
    expect(result.current.reducedMotion).toBe(true);
    expect(document.body.classList.contains("reduce-motion")).toBe(true);
    expect(localStorage.getItem("mindmap-reduce-motion")).toBe("reduced");

    act(() => result.current.setMotionPref("full"));
    expect(result.current.reducedMotion).toBe(false);
    expect(document.body.classList.contains("reduce-motion")).toBe(false);
  });

  it("'full' wins even when the OS asks for reduced motion", () => {
    osReduced = true;
    localStorage.setItem("mindmap-reduce-motion", "full");
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current.reducedMotion).toBe(false);
  });
});
