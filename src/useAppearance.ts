import { useEffect, useState } from "react";

// App-wide chrome appearance (Phase 8 / S1) — independent of the canvas theme. "system" follows the
// OS via prefers-color-scheme; "light"/"dark" force it. Persisted like the canvas theme (best-effort
// localStorage). The resolved light/dark drives the --ed-* / --st-* chrome tokens; the canvas theme
// still colours the nodes. App combines `prefersDark` with the chosen appearance (and, under "system",
// a dark *canvas* theme also darkens the chrome so the two never clash).

export type Appearance = "system" | "light" | "dark";
const KEY = "mindmap-appearance";

function prefersDarkNow(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function useAppearance(): {
  appearance: Appearance;
  setAppearance: (a: Appearance) => void;
  /** Live OS preference (re-renders when the user flips their system theme). */
  prefersDark: boolean;
} {
  const [appearance, setAppearanceState] = useState<Appearance>(() => {
    try {
      const v = localStorage.getItem(KEY);
      return v === "light" || v === "dark" || v === "system" ? v : "system";
    } catch {
      return "system";
    }
  });
  const [prefersDark, setPrefersDark] = useState(prefersDarkNow);

  // Track OS preference so "system" updates live when the user toggles their desktop theme.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setPrefersDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setAppearance = (a: Appearance) => {
    setAppearanceState(a);
    try {
      localStorage.setItem(KEY, a);
    } catch {
      // preference is best-effort
    }
  };

  return { appearance, setAppearance, prefersDark };
}

/** Resolve the final chrome darkness from the chosen appearance, the OS preference, and whether the
 *  active canvas theme is itself dark. Under "system" a dark canvas also darkens the chrome, so you
 *  never get the old dark-canvas / light-chrome clash. */
export function resolveChromeDark(
  appearance: Appearance,
  prefersDark: boolean,
  canvasIsDark: boolean,
): boolean {
  if (appearance === "dark") return true;
  if (appearance === "light") return false;
  return prefersDark || canvasIsDark;
}
