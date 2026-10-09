import { afterEach, describe, expect, it, vi } from "vitest";
import { isStandalonePwa } from "../src/pwa/standalone";

describe("isStandalonePwa", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is true when the display-mode:standalone media query matches", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("standalone") }));
    expect(isStandalonePwa()).toBe(true);
  });

  it("is true on iOS Safari via navigator.standalone", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    vi.stubGlobal("navigator", { standalone: true });
    expect(isStandalonePwa()).toBe(true);
  });

  it("is false in a normal browser tab (no standalone signal)", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    vi.stubGlobal("navigator", {});
    expect(isStandalonePwa()).toBe(false);
  });
});
