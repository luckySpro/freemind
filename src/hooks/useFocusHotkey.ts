import { useEffect } from "react";

// Focus mode (#9): Ctrl/⌘+. drills the canvas into the selected topic (re-roots the view at it, with
// the existing "Drilled into…" breadcrumb to step back out); pressing it again, or Esc, exits. Drill
// already provides the breadcrumb + exit affordance — this just adds the one-key entry/exit. Ignored
// while typing in a field / topic / note so it never fights text entry.

export function useFocusHotkey(opts: {
  /** Only bind in the editor view. */
  enabled: boolean;
  /** The topic the view is currently drilled into (null = not drilled). */
  drillId: string | null;
  /** The selected topic to focus when not drilled (null = nothing to focus). */
  selectedId: string | null;
  setDrillId: (id: string | null) => void;
}): void {
  const { enabled, drillId, selectedId, setDrillId } = opts;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable))
        return;
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key === ".") {
        e.preventDefault();
        setDrillId(drillId ? null : selectedId); // toggle: exit if drilled, else focus the selection
      } else if (e.key === "Escape" && drillId) {
        setDrillId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, drillId, selectedId, setDrillId]);
}
