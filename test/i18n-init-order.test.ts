// @vitest-environment jsdom
//
// WHEN the locale is resolved, relative to the eager import graph.
//
// This is the invariant that decides whether ~99 module-scope `t()` calls are correct or frozen against
// the wrong locale. `t()` reads the active locale at call time; a call at module scope runs once, while
// its module is being imported. So the locale must already be resolved by then — and it was not.
//
// `main.tsx` called `initLocale()` in its body, below `import { App }`. ES imports are hoisted and
// evaluated depth-first, so the entire eager graph — `App` -> `panelLabels` and the rest — had already
// run its module-scope `t()` calls against DEFAULT_LOCALE before that line was reached.
//
// Nothing showed it, because `LOCALES` holds one entry and `resolveLocale()` could only return "en".
// The bug arms when a second locale is ADDED, not when a picker ships: `resolveLocale()` consults
// `navigator.languages`, so a Danish browser would get a half-English first paint with no user action.
//
// The fix is in the barrel body (src/i18n/index.ts), deliberately not an import ordering in main.tsx —
// biome sorts imports, so an ordering fix there would be undone by the formatter.
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("locale resolution happens before the eager graph evaluates", () => {
  beforeEach(() => {
    vi.resetModules();
    // jsdom's default is "", and index.html ships lang="en" — clearing it means a passing assertion
    // can only come from initLocale() having run, not from the fixture.
    document.documentElement.lang = "";
    document.documentElement.removeAttribute("dir");
  });

  it("importing the i18n barrel resolves the locale as a side effect", async () => {
    expect(document.documentElement.lang).toBe("");
    await import("../src/i18n");
    // Set by applyDocumentLocale, which only initLocale() calls at import time.
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("a module with module-scope t() sees a resolved locale when it evaluates", async () => {
    // panelLabels.ts is the canonical case: 26 module-scope calls, imported statically by App.tsx.
    // Importing it must not be what triggers resolution — the barrel it depends on must already have.
    const { getLocale } = await import("../src/i18n");
    const localeAtImport = getLocale();
    const { PANEL_LABELS } = await import("../src/panelLabels");

    expect(localeAtImport).toBe("en");
    expect(PANEL_LABELS.outline.tab).toBe("Outline");
    // The document was stamped before panelLabels evaluated, not after.
    expect(document.documentElement.lang).toBe("en");
  });

  it("initLocale is idempotent, so main.tsx's belt-and-braces call is safe", async () => {
    const { initLocale, getLocale } = await import("../src/i18n");
    const before = getLocale();
    expect(initLocale()).toBe(before);
    expect(getLocale()).toBe(before);
  });
});
