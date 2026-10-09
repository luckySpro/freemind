import { describe, expect, it } from "vitest";
import { SHORTCUT_BINDINGS, shortcutGroups } from "../src/shortcuts";

// SHORTCUT_BINDINGS (command id → display keys) feeds the menu + ⌘K shortcut chips. It must never
// claim a binding the cheat-sheet (shortcutGroups()) doesn't document — otherwise the two sources drift and
// a chip lies. This locks the map to the cheat-sheet so adding a binding forces a cheat-sheet entry.
describe("SHORTCUT_BINDINGS", () => {
  it("is non-empty", () => {
    expect(Object.keys(SHORTCUT_BINDINGS).length).toBeGreaterThan(0);
  });

  it("every binding's display keys appear verbatim in the shortcutGroups() cheat-sheet (no drift)", () => {
    const documented = new Set(shortcutGroups().flatMap((g) => g.items.map((s) => s.keys)));
    for (const [id, keys] of Object.entries(SHORTCUT_BINDINGS)) {
      expect(
        documented.has(keys),
        `${id} → "${keys}" is not a documented shortcutGroups() key`,
      ).toBe(true);
    }
  });
});
