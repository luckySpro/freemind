// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHighContrast } from "../src/useHighContrast";

// Drive both OS signals (prefers-contrast: more / forced-colors: active) through a controllable stub.
let osContrast = false;
let osForced = false;
beforeEach(() => {
  osContrast = false;
  osForced = false;
  localStorage.clear();
  document.body.className = "";
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: q.includes("forced-colors") ? osForced : q.includes("contrast") ? osContrast : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("useHighContrast", () => {
  it("defaults to following the OS prefers-contrast preference", () => {
    osContrast = true;
    const { result } = renderHook(() => useHighContrast());
    expect(result.current.contrastPref).toBe("system");
    expect(result.current.highContrast).toBe(true);
    expect(document.body.classList.contains("high-contrast")).toBe(true);
  });

  it("also follows forced-colors: active under system", () => {
    osForced = true;
    const { result } = renderHook(() => useHighContrast());
    expect(result.current.highContrast).toBe(true);
  });

  it("forces high / normal regardless of the OS, and persists the choice", () => {
    const { result } = renderHook(() => useHighContrast()); // OS = normal contrast
    expect(result.current.highContrast).toBe(false);

    act(() => result.current.setContrastPref("high"));
    expect(result.current.highContrast).toBe(true);
    expect(document.body.classList.contains("high-contrast")).toBe(true);
    expect(localStorage.getItem("mindmap-contrast")).toBe("high");

    act(() => result.current.setContrastPref("normal"));
    expect(result.current.highContrast).toBe(false);
    expect(document.body.classList.contains("high-contrast")).toBe(false);
  });

  it("'normal' wins even when the OS asks for high contrast", () => {
    osContrast = true;
    localStorage.setItem("mindmap-contrast", "normal");
    const { result } = renderHook(() => useHighContrast());
    expect(result.current.highContrast).toBe(false);
  });
});
