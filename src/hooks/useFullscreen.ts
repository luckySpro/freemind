import { useCallback, useEffect, useState } from "react";

// Full-screen editing (SimpleMind's phone "full screen" button): hides the editor chrome — rail, both
// toolbar rows, tabs, breadcrumb — so the canvas gets the whole window, and asks the browser for real
// full screen where it's allowed (Android Chrome, desktop; iOS Safari has no element full screen, so
// there it's chrome-hiding only). Leaving the browser's full screen (Esc / Back) leaves the mode too,
// and leaving the editor (Start screen) always exits. Session-only — never persisted.
export function useFullscreen(active: boolean) {
  const [on, setOn] = useState(false);
  const toggle = useCallback(() => setOn((v) => !v), []);
  const exit = useCallback(() => setOn(false), []);

  // Mirror the mode into the browser's full screen. Runs right after the click, still inside the
  // gesture's transient activation, so requestFullscreen is permitted; a refusal is harmless.
  useEffect(() => {
    const el = document.documentElement;
    if (on && !document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    if (!on && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }, [on]);

  // Esc / Back ends the browser's full screen → end the mode with it.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setOn(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!active) setOn(false);
  }, [active]);

  return { on, toggle, exit };
}
