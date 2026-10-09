// The frozen-`t()` RATCHET. A per-file budget of module-scope `t()` calls that may only shrink.
//
// test/i18n-frozen-constants.test.ts proves WHY these are a trap: a `t()` at module scope is evaluated
// once, at import, so its string cannot follow a later `setLocale`. This file makes sure the count
// cannot quietly grow while the rest of the migration continues — the shape is easy to reach for
// (a module-level `const LAYOUTS = [{ label: t("…") }]` reads perfectly naturally) and there are 194
// existing examples to copy from, so "don't do that" is not a strategy that survives contact.
//
// The budget doubles as the worklist. Fixing a file means giving it getters or making it a function,
// then lowering its number here; the entry disappears when it reaches zero. Adding a file is not
// possible without editing this list, which is the point — it forces the decision to be deliberate.
import { describe, expect, it } from "vitest";
import { frozenByFile } from "../scripts/lib/i18nFrozen.mjs";

// Measured 2026-07-26 on branch i18n/complete-migration, re-measured down to 0 on 2026-07-28 (every
// remaining file converted to getters — see below). Empty budget: the "no NEW file" and "no file
// exceeds its budget" checks below still guard against a regression re-introducing one.
const BUDGET: ReadonlyArray<readonly [string, number]> = [];
// Re-measured 2026-07-27: 194 → 145. Cleared then: stickers.ts (25), flow/slashCommands.ts (9),
// start/AppTips.tsx (8) and Recent.tsx (3). Recent's was a side effect of fixing a data-loss bug, not
// a freeze fix — it keyed date buckets on the rendered label, so a translated label stopped matching
// and whole sections of maps disappeared (test/start-library-sections.test.tsx).
//
// Re-measured 2026-07-28: 145 → 0. The remaining 17 files were all the same shape — a module-scope
// array/object literal with one identity field (id/kind/key/href/w/d/a/value, never a t() call) and
// one display field (label/name/title/body/menu/tab) that was the frozen `t(...)`. Every display field
// became a `get x() { return t("…"); }` accessor; every identity field was left untouched. Getters are
// a drop-in replacement for every READ site (`obj.label` behaves identically), so no consumer changed
// — except one real bug the sweep surfaced: CaptureCard.tsx's suggested-prompt buttons keyed on the
// translated text itself (`key={ex}`), the same "translated label used as identity" class already
// fixed for Toolbar's last-export id and Recent's date buckets. That array is now a function
// (`suggestedExamples()`) returning `{ id, text }` pairs, keyed on `id`.
//
// WHAT THIS NUMBER DOES NOT MEAN — still true, and the reason not to chase it to 0:
//   - The detector counts `t(` calls, so a module-scope DERIVATION that materialises its inputs is
//     invisible to it. Three such sites existed and are now FIXED — `MapPanel`'s `LAYOUT_NAME` and
//     `Kanban`'s `SOURCES` became functions, and `icons.ts`'s group names became getters — but the
//     class is not detectable, so the next one will be silent too. If you convert a table to getters,
//     check what reads it at module scope.
//   - Strings that are raw English LITERALS score 0 here and 0 in the scanner while rendering
//     untranslated. That was the layout names, marker-group names, sticker categories and priority
//     labels; all migrated 2026-07-27. `pnpm i18n:blindspot` is what finds the rest.
// A sweep that empties this table while the layout picker still reads "Radial / hub" in Danish is the
// "green tick that measured nothing" pattern this codebase keeps rediscovering.

const TOTAL = BUDGET.reduce((sum, [, n]) => sum + n, 0);

describe("frozen module-level t() budget", () => {
  const actual = frozenByFile("src");

  it("no file exceeds its budget", () => {
    const over = [...actual]
      .filter(([file, n]) => n > (BUDGET.find(([f]) => f === file)?.[1] ?? 0))
      .map(([file, n]) => `${file}: ${n} > ${BUDGET.find(([f]) => f === file)?.[1] ?? 0}`);

    expect(
      over,
      "A module-scope t() call is frozen at import and cannot follow setLocale.\n" +
        "Move it inside the render/function, or give the constant a getter.\n" +
        "See test/i18n-frozen-constants.test.ts for the proof.",
    ).toEqual([]);
  });

  it("no NEW file introduces frozen calls", () => {
    const budgeted = new Set(BUDGET.map(([f]) => f));
    expect([...actual.keys()].filter((f) => !budgeted.has(f))).toEqual([]);
  });

  it("the total only goes down — lower the budget when a file is fixed", () => {
    const total = [...actual.values()].reduce((sum, n) => sum + n, 0);
    expect(total).toBeLessThanOrEqual(TOTAL);
    // Not `toBe`: a fix that lands without updating BUDGET should pass, not fail. The stale entry is
    // then visible as slack rather than as a broken build.
  });
});
