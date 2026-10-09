import { useCallback, useEffect, useRef, useState } from "react";

// Drag-to-resize for the mobile bottom sheets (the panel host + the inspector, mobile.css). The handle
// was a decorative ::before; this hook makes it real: a pointer (or keyboard) drag sets a live height
// published as the `--mm-sheet-h` custom property, snapping to two detents on release and dismissing the
// sheet when dragged down past a threshold. Heights are in dvh so they track the live visible viewport,
// matching the CSS default. The snap/dismiss decision is a pure function so it's unit-testable without a
// pointer; the wiring (window listeners) is the thin, device-verified shell.

const DEFAULT_VH = 62; // the resting detent (matches mobile.css `height: 62dvh`)
const TALL_VH = 90; // the expanded detent
const MIN_VH = 30;
const MAX_VH = 92;
const DISMISS_VH = 42; // release at/below this → the sheet closes instead of snapping
const KEY_STEP_VH = 8; // ArrowUp/Down nudge

/** Pure release rule: snap to the nearest detent, or dismiss when dragged below the threshold. */
export function snapOrDismiss(vh: number): { vh: number; dismiss: boolean } {
  if (vh <= DISMISS_VH) return { vh: DEFAULT_VH, dismiss: true };
  const detents = [DEFAULT_VH, TALL_VH];
  let best = detents[0];
  for (const d of detents) if (Math.abs(d - vh) < Math.abs(best - vh)) best = d;
  return { vh: best, dismiss: false };
}

export interface SheetDrag {
  /** Current sheet height in dvh, or null to use the CSS default (62dvh). Publish as `--mm-sheet-h`. */
  heightVh: number | null;
  /** True while a pointer drag is in progress (so the height transition can be suppressed). */
  dragging: boolean;
  /** Spread onto the grab-handle element. */
  handleProps: {
    onPointerDown: (e: React.PointerEvent) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
  };
}

/**
 * @param onDismiss  called when a drag (or Escape) dismisses the sheet.
 * @param viewportH  injectable for tests; defaults to the live window height.
 */
export function useSheetDrag(
  onDismiss: () => void,
  viewportH: () => number = () => window.innerHeight,
): SheetDrag {
  const [heightVh, setHeightVh] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ y: number; vh: number } | null>(null);
  const heightRef = useRef<number | null>(null);
  heightRef.current = heightVh;
  // Latest callbacks via refs so the window listeners (one stable reference) always see current values.
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const viewportHRef = useRef(viewportH);
  viewportHRef.current = viewportH;

  // Stable handlers — bound to / removed from window by the SAME reference, so nothing leaks.
  const handleMove = useCallback((e: PointerEvent) => {
    if (!start.current) return;
    const dy = start.current.y - e.clientY; // dragging up grows the sheet
    const dvh = (dy / Math.max(1, viewportHRef.current())) * 100;
    setHeightVh(Math.min(MAX_VH, Math.max(MIN_VH, start.current.vh + dvh)));
  }, []);

  const handleEnd = useCallback(() => {
    start.current = null;
    setDragging(false);
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", handleEnd);
    setHeightVh((cur) => {
      if (cur == null) return null;
      const { vh, dismiss } = snapOrDismiss(cur);
      if (dismiss) {
        onDismissRef.current();
        return null;
      }
      return vh;
    });
  }, [handleMove]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      start.current = { y: e.clientY, vh: heightRef.current ?? DEFAULT_VH };
      setDragging(true);
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleEnd);
    },
    [handleMove, handleEnd],
  );

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHeightVh((c) => Math.min(MAX_VH, (c ?? DEFAULT_VH) + KEY_STEP_VH));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHeightVh((c) => Math.max(MIN_VH, (c ?? DEFAULT_VH) - KEY_STEP_VH));
    } else if (e.key === "Escape") {
      onDismissRef.current();
    }
  }, []);

  // Belt-and-braces: drop any in-flight listeners if the hook unmounts mid-drag.
  useEffect(
    () => () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
    },
    [handleMove, handleEnd],
  );

  return { heightVh, dragging, handleProps: { onPointerDown, onKeyDown } };
}
