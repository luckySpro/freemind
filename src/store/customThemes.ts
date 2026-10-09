import { type CanvasTheme, mindManagerTheme } from "../mindmap/theme";
import type { BranchGrowth } from "../model/types";

// Custom canvas themes (C3): user-defined "looks" saved locally, appearing in the Theme dropdown after
// the four built-ins. Each stores the human-editable knobs; `customToCanvasTheme` derives the full
// CanvasTheme (palette + the cssVar custom-property block) the canvas + exporter consume, so a custom
// theme renders exactly like a built-in. Kept in localStorage (separate from map data, so it survives a
// library clear until "clear all local data" wipes prefs).

export interface CustomTheme {
  id: string;
  name: string;
  /** Six branch colours cycled per main branch (like the built-in themes' palette). */
  palette: string[];
  /** Canvas background colour. */
  background: string;
  /** Default node fill colour. */
  nodeFill: string;
  /** Map-wide base font family (a CSS family list), or "" for the canvas default. */
  fontFamily: string;
  /** Branch line-weight applied with the theme. */
  branchGrowth: BranchGrowth;
}

export const CUSTOM_THEMES_KEY = "mindmap-custom-themes";
/** Custom theme ids are prefixed so they never collide with a built-in id (light/dark/ocean/sunset). */
export const CUSTOM_THEME_PREFIX = "custom-";

/** Relative luminance of a #rrggbb colour (0 dark … 1 light); used to pick readable text on a fill. */
function luminance(hex: string): number {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim());
  if (!m) return 1;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => Number.parseInt(h, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const INK_DARK = "#23211c";
const INK_LIGHT = "#f4f2ea";
/** Readable ink for a fill: dark text on a light fill, light text on a dark one. */
function inkFor(fill: string): string {
  return luminance(fill) < 0.5 ? INK_LIGHT : INK_DARK;
}

/** Derive the full CanvasTheme (palette + cssVar) a custom theme renders as. The Light theme's cssVar is
 *  the base; background / nodeFill / the first palette colour (the root accent) + readable inks override
 *  it. `type` follows the background luminance so React Flow's colour mode matches. Pure. */
export function customToCanvasTheme(ct: CustomTheme): CanvasTheme {
  const root = ct.palette[0] ?? mindManagerTheme.palette[0];
  const dark = luminance(ct.background) < 0.5;
  return {
    id: ct.id,
    name: ct.name,
    theme: {
      name: ct.name,
      type: dark ? "dark" : "light",
      palette: ct.palette.length ? ct.palette : mindManagerTheme.palette,
      cssVar: {
        ...mindManagerTheme.cssVar,
        "--main-bgcolor": ct.background,
        "--main-color": inkFor(ct.background),
        "--bgcolor": ct.nodeFill,
        "--color": inkFor(ct.nodeFill),
        "--root-bgcolor": root,
        "--root-color": inkFor(root),
        "--selected": root,
      },
    },
  };
}

/** The saved custom themes, tolerant of a missing/corrupt entry (returns []). */
export function getCustomThemes(): CustomTheme[] {
  try {
    const raw = localStorage.getItem(CUSTOM_THEMES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomTheme[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is CustomTheme =>
        !!t && typeof t.id === "string" && typeof t.name === "string" && Array.isArray(t.palette),
    );
  } catch {
    return [];
  }
}

/** Persist the whole custom-theme list (best-effort). */
export function saveCustomThemes(themes: CustomTheme[]): void {
  try {
    localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes));
  } catch {
    // storage is best-effort (quota / private mode)
  }
}

/** A fresh custom theme seeded from the built-in Light palette — the designer's starting point. */
export function newCustomTheme(name: string): CustomTheme {
  return {
    id: `${CUSTOM_THEME_PREFIX}${crypto.randomUUID()}`,
    name: name.trim() || "My theme",
    palette: [...mindManagerTheme.palette].slice(0, 6),
    background: "#faf9f5",
    nodeFill: "#ffffff",
    fontFamily: "",
    branchGrowth: "regular",
  };
}
