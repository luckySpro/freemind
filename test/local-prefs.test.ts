// @vitest-environment jsdom
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LOCAL_PREF_KEYS, clearAllLocalPreferences } from "../src/store/localPrefs";

afterEach(() => localStorage.clear());

describe("clearAllLocalPreferences", () => {
  it("removes every known app preference key, leaving others untouched", () => {
    for (const k of LOCAL_PREF_KEYS) localStorage.setItem(k, "x");
    localStorage.setItem("unrelated-key", "keep");
    clearAllLocalPreferences();
    for (const k of LOCAL_PREF_KEYS) expect(localStorage.getItem(k)).toBeNull();
    expect(localStorage.getItem("unrelated-key")).toBe("keep");
  });

  it("is a no-op when nothing is stored (never throws)", () => {
    expect(() => clearAllLocalPreferences()).not.toThrow();
  });
});

describe("LOCAL_PREF_KEYS is complete", () => {
  // THE GUARD THAT WAS MISSING. The test above passes against ANY list, including a wrong one: it
  // writes the keys the list names and checks those get cleared. It cannot notice a key the app writes
  // and the list forgot — and seven had accumulated, so "clear all local data" left them behind and
  // they never travelled in a settings file.
  //
  // The list is the thing under test, so this derives the truth from the SOURCE instead: every
  // `"mindmap-…"` string literal in src/ must be either a declared preference key or an explicitly
  // documented non-preference. A new key then cannot be added without a deliberate decision about
  // which it is.
  const NOT_A_PREFERENCE = new Map<string, string>([
    ["mindmap-studio", "the IndexedDB database name (mapStore.clearAllData wipes it separately)"],
    ["mindmap-studio-settings", "the `kind` marker inside an exported settings FILE"],
    ["mindmap-library", "the `kind` marker inside an exported library FILE"],
    ["mindmap-tab-presence", "a BroadcastChannel name, not storage"],
  ]);

  it("every mindmap-* literal in src is a declared preference or a documented non-preference", () => {
    const found = new Set<string>();
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.tsx?$/.test(entry.name)) {
          for (const m of readFileSync(path, "utf8").matchAll(/"(mindmap-[a-z0-9-]+)"/g)) {
            found.add(m[1]);
          }
        }
      }
    };
    walk(join(process.cwd(), "src"));

    const declared = new Set<string>(LOCAL_PREF_KEYS);
    const unaccounted = [...found]
      .filter((k) => !declared.has(k) && !NOT_A_PREFERENCE.has(k))
      .sort();

    expect(
      unaccounted,
      "These `mindmap-*` keys appear in src/ but are in neither LOCAL_PREF_KEYS nor the documented\n" +
        "non-preference list. If a key is a stored preference, add it to LOCAL_PREF_KEYS so\n" +
        '"clear all local data" reaches it — and decide in settingsFile.ts whether it travels.\n' +
        "If it is not storage at all, add it to NOT_A_PREFERENCE here with the reason.",
    ).toEqual([]);
  });

  it("does not claim a key the app never writes", () => {
    // The other direction: a stale entry is harmless at runtime but makes the list lie about scope.
    const src: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.tsx?$/.test(entry.name)) src.push(readFileSync(path, "utf8"));
      }
    };
    walk(join(process.cwd(), "src"));
    const all = src.join("\n");
    expect(LOCAL_PREF_KEYS.filter((k) => !all.includes(`"${k}"`))).toEqual([]);
  });
});
