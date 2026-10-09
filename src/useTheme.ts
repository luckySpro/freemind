import { useState } from "react";
import { type CanvasTheme, canvasThemes, themeById } from "./mindmap/theme";
import { type CustomTheme, customToCanvasTheme, getCustomThemes } from "./store/customThemes";

// Canvas style/theme selection, persisted across sessions. Returns the resolved theme object plus a
// setter keyed by theme id — resolving custom themes (C3) as well as the four built-ins.
const KEY = "mindmap-theme";

export interface UseTheme {
  theme: CanvasTheme;
  setThemeId: (id: string) => void;
  /** The user's saved custom themes (C3), for the Theme dropdown + designer. */
  customThemes: CustomTheme[];
  /** Re-read the custom themes from storage (after the designer saves / deletes / imports). */
  reloadCustomThemes: () => void;
}

export function useTheme(): UseTheme {
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>(() => getCustomThemes());
  const [themeId, setId] = useState(() => {
    try {
      // A ?theme= query param wins (shareable themed links); else the persisted choice.
      const q = new URLSearchParams(window.location.search).get("theme");
      if (q && themeById(q).id === q) return q;
      return localStorage.getItem(KEY) ?? "light";
    } catch {
      return "light";
    }
  });

  const setThemeId = (id: string) => {
    setId(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      // preference is best-effort
    }
  };

  // Built-in first; else a custom theme; else fall back to Light (e.g. a since-deleted custom id).
  const builtin = canvasThemes.find((t) => t.id === themeId);
  const custom = !builtin ? customThemes.find((c) => c.id === themeId) : undefined;
  const theme = builtin ?? (custom ? customToCanvasTheme(custom) : canvasThemes[0]);

  return {
    theme,
    setThemeId,
    customThemes,
    reloadCustomThemes: () => setCustomThemes(getCustomThemes()),
  };
}
