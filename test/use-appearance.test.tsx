import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveChromeDark, useAppearance } from "../src/useAppearance";

function stubMatchMedia(dark: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: q.includes("prefers-color-scheme: dark") ? dark : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => {
  localStorage.clear();
  stubMatchMedia(false);
});
afterEach(() => vi.unstubAllGlobals());

describe("resolveChromeDark", () => {
  it("honours explicit Light / Dark regardless of OS or canvas", () => {
    expect(resolveChromeDark("dark", false, false)).toBe(true);
    expect(resolveChromeDark("light", true, true)).toBe(false);
  });

  it("under System, follows the OS preference", () => {
    expect(resolveChromeDark("system", true, false)).toBe(true);
    expect(resolveChromeDark("system", false, false)).toBe(false);
  });

  it("under System, a dark canvas also darkens the chrome (no light-chrome/dark-canvas clash)", () => {
    expect(resolveChromeDark("system", false, true)).toBe(true);
  });
});

describe("useAppearance", () => {
  it("defaults to system and persists an explicit choice", () => {
    const { result } = renderHook(() => useAppearance());
    expect(result.current.appearance).toBe("system");
    act(() => result.current.setAppearance("dark"));
    expect(result.current.appearance).toBe("dark");
    expect(localStorage.getItem("mindmap-appearance")).toBe("dark");
  });

  it("reads a persisted appearance on mount", () => {
    localStorage.setItem("mindmap-appearance", "light");
    const { result } = renderHook(() => useAppearance());
    expect(result.current.appearance).toBe("light");
  });

  it("reflects the OS prefers-color-scheme", () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useAppearance());
    expect(result.current.prefersDark).toBe(true);
  });
});
