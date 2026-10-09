// @vitest-environment jsdom
//
// (jsdom for localStorage — these functions read and write it directly.)
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LOCALE_PREF_KEY } from "../src/i18n";
import { LOCAL_PREF_KEYS } from "../src/store/localPrefs";
import {
  PORTABLE_PREF_KEYS,
  SETTINGS_FILE_VERSION,
  applySettings,
  collectSettings,
  parseSettingsFile,
  serializeSettings,
  settingsKeysIn,
} from "../src/store/settingsFile";

// Settings export / import — the way app-wide preferences (saved filter presets, custom themes, named
// styles) reach a second machine, since they deliberately don't live on any document.

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("collectSettings", () => {
  it("exports the preferences that are set, and omits the ones that aren't", () => {
    localStorage.setItem("mindmap-theme", '"dark"');
    localStorage.setItem("mindmap-saved-filters", "[]");
    const file = collectSettings("2026-07-26T00:00:00.000Z");
    expect(file.kind).toBe("mindmap-studio-settings");
    expect(file.version).toBe(SETTINGS_FILE_VERSION);
    expect(file.prefs["mindmap-theme"]).toBe('"dark"');
    expect(file.prefs["mindmap-saved-filters"]).toBe("[]");
    // Absent, not exported as empty — so importing can't clear a preference the source never had.
    expect("mindmap-named-styles" in file.prefs).toBe(false);
  });

  it("leaves the branch clipboard and ⌘K recents out of the file", () => {
    localStorage.setItem("mindmap-branch-clipboard", '[{"big":"subtree"}]');
    localStorage.setItem("mindmap-cmdk-recent", '["export"]');
    localStorage.setItem("mindmap-theme", '"light"');
    const prefs = collectSettings("t").prefs;
    expect("mindmap-branch-clipboard" in prefs).toBe(false); // a clipboard, not a setting
    expect("mindmap-cmdk-recent" in prefs).toBe(false); // this machine's usage history
    expect("mindmap-theme" in prefs).toBe(true);
  });

  it("only ever offers keys the app actually owns", () => {
    for (const k of PORTABLE_PREF_KEYS) expect(LOCAL_PREF_KEYS).toContain(k);
  });

  it("carries the language choice between machines", () => {
    // PORTABLE_PREF_KEYS is derived from LOCAL_PREF_KEYS, so a new preference travels automatically —
    // but that's exactly the kind of thing that quietly stops being true, and a language that doesn't
    // follow you to a second machine is the whole point of this file.
    expect(PORTABLE_PREF_KEYS).toContain(LOCALE_PREF_KEY);
    localStorage.setItem(LOCALE_PREF_KEY, "en");
    const text = serializeSettings(collectSettings("t"));
    localStorage.clear();
    applySettings(parseSettingsFile(text));
    expect(localStorage.getItem(LOCALE_PREF_KEY)).toBe("en");
  });
});

describe("parseSettingsFile", () => {
  const good = () => {
    localStorage.setItem("mindmap-theme", '"dark"');
    return serializeSettings(collectSettings("2026-07-26T00:00:00.000Z"));
  };

  it("round-trips an exported file", () => {
    const text = good();
    localStorage.clear();
    const parsed = parseSettingsFile(text);
    expect(parsed.prefs["mindmap-theme"]).toBe('"dark"');
    expect(settingsKeysIn(parsed)).toEqual(["mindmap-theme"]);
  });

  it("rejects non-JSON, foreign JSON, and a missing prefs map", () => {
    expect(() => parseSettingsFile("{nope")).toThrow(/valid JSON/);
    expect(() => parseSettingsFile("[1,2,3]")).toThrow(/settings file/);
    expect(() => parseSettingsFile(JSON.stringify({ kind: "something-else" }))).toThrow(
      /settings file/,
    );
    expect(() =>
      parseSettingsFile(JSON.stringify({ kind: "mindmap-studio-settings", version: 1 })),
    ).toThrow(/no preferences/);
  });

  it("refuses a file from a newer version", () => {
    const text = JSON.stringify({
      kind: "mindmap-studio-settings",
      version: SETTINGS_FILE_VERSION + 1,
      prefs: {},
    });
    expect(() => parseSettingsFile(text)).toThrow(/newer version/);
  });

  it("drops keys outside the allowlist instead of trusting them", () => {
    // A settings file is untrusted input; without the allowlist it could write ANY key in this origin.
    const text = JSON.stringify({
      kind: "mindmap-studio-settings",
      version: 1,
      prefs: {
        "mindmap-theme": '"dark"',
        "evil-token": "stolen",
        "mindmap-branch-clipboard": "[]", // excluded from portability too
      },
    });
    const parsed = parseSettingsFile(text);
    expect(Object.keys(parsed.prefs)).toEqual(["mindmap-theme"]);
  });

  it("drops non-string values", () => {
    const text = JSON.stringify({
      kind: "mindmap-studio-settings",
      version: 1,
      prefs: { "mindmap-theme": { not: "a string" }, "mindmap-appearance": '"dark"' },
    });
    expect(Object.keys(parseSettingsFile(text).prefs)).toEqual(["mindmap-appearance"]);
  });
});

describe("applySettings", () => {
  it("writes only the keys the file carries, leaving others untouched", () => {
    localStorage.setItem("mindmap-theme", '"light"');
    localStorage.setItem("mindmap-named-styles", '["mine"]');
    const file = parseSettingsFile(
      JSON.stringify({
        kind: "mindmap-studio-settings",
        version: 1,
        prefs: { "mindmap-theme": '"dark"' },
      }),
    );
    expect(applySettings(file)).toEqual(["mindmap-theme"]);
    expect(localStorage.getItem("mindmap-theme")).toBe('"dark"');
    // Not mentioned in the file → kept, not cleared.
    expect(localStorage.getItem("mindmap-named-styles")).toBe('["mine"]');
  });

  it("never writes a key outside the allowlist", () => {
    const file = parseSettingsFile(
      JSON.stringify({
        kind: "mindmap-studio-settings",
        version: 1,
        prefs: { "mindmap-theme": '"dark"', "evil-token": "stolen" },
      }),
    );
    applySettings(file);
    expect(localStorage.getItem("evil-token")).toBeNull();
  });

  it("survives a full export → clear → import cycle", () => {
    localStorage.setItem("mindmap-saved-filters", '[{"id":"f1","name":"Overdue"}]');
    localStorage.setItem("mindmap-custom-themes", '[{"id":"t1"}]');
    const text = serializeSettings(collectSettings("t"));
    localStorage.clear();
    applySettings(parseSettingsFile(text));
    expect(localStorage.getItem("mindmap-saved-filters")).toBe('[{"id":"f1","name":"Overdue"}]');
    expect(localStorage.getItem("mindmap-custom-themes")).toBe('[{"id":"t1"}]');
  });
});
