import { useEffect, useState } from "react";

// App-wide high-contrast preference (accessibility). "system" follows the OS via
// `prefers-contrast: more` OR `forced-colors: active` (Windows High Contrast / forced-colors);
// "high"/"normal" force it. Persisted best-effort (localStorage), mirroring useAppearance /
// useReducedMotion. The resolved boolean is threaded into editorThemeVars() to push the chrome tokens
// to max contrast, and mirrored onto a `high-contrast` body class so CSS (focus rings, forced-colors
// tweaks) can react to the in-app toggle, not just the OS media query.

export type ContrastPref = "system" | "high" | "normal";
const KEY = "mindmap-contrast";

function prefersHighContrastNow(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return (
    window.matchMedia("(prefers-contrast: more)").matches ||
    window.matchMedia("(forced-colors: active)").matches
  );
}

export function useHighContrast(): {
  contrastPref: ContrastPref;
  setContrastPref: (p: ContrastPref) => void;
  /** Final resolved value: the user's forced choice, or the live OS preference under "system". */
  highContrast: boolean;
} {
  const [contrastPref, setContrastPrefState] = useState<ContrastPref>(() => {
    try {
      const v = localStorage.getItem(KEY);
      return v === "high" || v === "normal" || v === "system" ? v : "system";
    } catch {
      return "system";
    }
  });
  const [prefersHigh, setPrefersHigh] = useState(prefersHighContrastNow);

  // Track the OS preferences so "system" updates live when the user flips either one.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mqs = [
      window.matchMedia("(prefers-contrast: more)"),
      window.matchMedia("(forced-colors: active)"),
    ];
    const onChange = () => setPrefersHigh(prefersHighContrastNow());
    for (const mq of mqs) mq.addEventListener("change", onChange);
    return () => {
      for (const mq of mqs) mq.removeEventListener("change", onChange);
    };
  }, []);

  const highContrast = contrastPref === "high" || (contrastPref === "system" && prefersHigh);

  // Mirror the resolved value onto a body class so CSS can react to the in-app toggle (not only the OS
  // media query) — thicker focus rings, forced link underlines, forced-colors canvas preservation.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("high-contrast", highContrast);
  }, [highContrast]);

  const setContrastPref = (p: ContrastPref) => {
    setContrastPrefState(p);
    try {
      localStorage.setItem(KEY, p);
    } catch {
      // preference is best-effort
    }
  };

  return { contrastPref, setContrastPref, highContrast };
}
