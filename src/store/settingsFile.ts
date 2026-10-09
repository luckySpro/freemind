import { t } from "../i18n";
import { LOCAL_PREF_KEYS } from "./localPrefs";

// Settings export / import — carry your preferences to another machine.
//
// The app is local-first with no account, so preferences live in this origin's localStorage and stop
// at the browser. Saved Power-Filter presets are the motivating case: they're deliberately app-wide
// and reusable across maps (see NEXT_STEPS), so scoping them to a document would have removed that
// reuse — a settings file is the right way to move them instead. Custom themes and named styles are
// the same shape of thing.
//
// Two deliberate constraints:
//   • Only ALLOWLISTED keys are written on import. A settings file is untrusted input (it arrives from
//     a disk, a colleague, a download), and without the allowlist an arbitrary `prefs` map would let
//     one file write any localStorage key in this origin.
//   • Values are carried as OPAQUE strings. This module doesn't parse or validate the contents of each
//     preference — that's each consumer's job, and every reader already tolerates corrupt values
//     (they all `try/catch` + fall back). So a new preference needs no change here beyond the key list.

/** Bumped only on a breaking change to the envelope; readers reject an unknown major. */
export const SETTINGS_FILE_VERSION = 1;

const KIND = "mindmap-studio-settings";

/** Preference keys deliberately NOT carried between machines:
 *  - `mindmap-branch-clipboard` is a copied subtree, not a setting (and can be large);
 *  - `mindmap-cmdk-recent` is this machine's own usage history;
 *  - `mindmap-search-history` is the same category, and it is the user's own search TERMS — those
 *    should not leave the machine inside a file they may hand to someone else;
 *  - `mindmap-last-export` is usage history too. (It once stored the export menu's rendered LABEL as
 *    its identity key, which would not have matched on a machine running another locale; Toolbar.tsx
 *    persists a stable id as of `aeb7705`. The exclusion stands on the usage-history ground alone.)
 *  Everything else in LOCAL_PREF_KEYS is a genuine preference and travels. */
const EXCLUDED = new Set<string>([
  "mindmap-branch-clipboard",
  "mindmap-cmdk-recent",
  "mindmap-search-history",
  "mindmap-last-export",
]);

/** The keys a settings file may carry — the single allowlist used by both export and import. */
export const PORTABLE_PREF_KEYS: readonly string[] = LOCAL_PREF_KEYS.filter(
  (k) => !EXCLUDED.has(k),
);

export interface SettingsFile {
  kind: typeof KIND;
  version: number;
  /** ISO timestamp, for the reader's benefit only — never used in a decision. */
  exportedAt: string;
  /** Preference key → its raw localStorage string. */
  prefs: Record<string, string>;
}

/** Build a settings file from the live localStorage. Keys that aren't set are simply absent (rather
 *  than exported as empty), so importing never clears a preference the source machine didn't have. */
export function collectSettings(exportedAt: string): SettingsFile {
  const prefs: Record<string, string> = {};
  for (const key of PORTABLE_PREF_KEYS) {
    try {
      const v = localStorage.getItem(key);
      if (v !== null) prefs[key] = v;
    } catch {
      // storage unavailable — export what we can rather than failing outright
    }
  }
  return { kind: KIND, version: SETTINGS_FILE_VERSION, exportedAt, prefs };
}

/** Pretty JSON, so the file is readable and diffable by hand. */
export function serializeSettings(file: SettingsFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

/** Parse + validate a settings file. Throws a user-facing message on anything unusable — the caller
 *  surfaces it as a toast, so the wording matters. */
export function parseSettingsFile(text: string): SettingsFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(t("app.thatFileIsnTValid"));
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(t("app.thatFileIsnTA"));
  }
  const obj = raw as Record<string, unknown>;
  if (obj.kind !== KIND) {
    throw new Error(t("app.thatFileIsnTA"));
  }
  if (typeof obj.version !== "number" || obj.version > SETTINGS_FILE_VERSION) {
    throw new Error(t("app.thatSettingsFileWasWritten"));
  }
  const prefsRaw = obj.prefs;
  if (!prefsRaw || typeof prefsRaw !== "object" || Array.isArray(prefsRaw)) {
    throw new Error(t("app.thatSettingsFileHasNo"));
  }
  // Keep only allowlisted string values — anything else is dropped rather than trusted.
  const prefs: Record<string, string> = {};
  for (const [k, v] of Object.entries(prefsRaw as Record<string, unknown>)) {
    if (PORTABLE_PREF_KEYS.includes(k) && typeof v === "string") prefs[k] = v;
  }
  return {
    kind: KIND,
    version: obj.version,
    exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : "",
    prefs,
  };
}

/** Which allowlisted preferences a parsed file would write. Lets the UI say what's about to change
 *  before the user commits to it. Pure. */
export function settingsKeysIn(file: SettingsFile): string[] {
  return PORTABLE_PREF_KEYS.filter((k) => k in file.prefs);
}

/** Write a parsed file's preferences into localStorage, returning the keys actually written.
 *
 *  Only keys present in the file are touched — a preference the file doesn't mention keeps its current
 *  value rather than being cleared, so importing a partial file is safe. Best-effort per key. */
export function applySettings(file: SettingsFile): string[] {
  const written: string[] = [];
  for (const key of settingsKeysIn(file)) {
    try {
      localStorage.setItem(key, file.prefs[key]);
      written.push(key);
    } catch {
      // quota or storage failure on one key shouldn't abort the rest
    }
  }
  return written;
}
