import { type PointerEvent as ReactPointerEvent, useCallback, useRef } from "react";

// Long-press → context menu on touch/pen, where there's no right-click. Fires `onLongPress` after
// `delay` ms of a stationary press; a mouse press is ignored (it has a real contextmenu), and moving
// past a small threshold (a pan/scroll/drag) cancels. Returns pointer handlers to spread onto an
// element alongside its existing onContextMenu. Framework-light; the timer logic is unit-tested.
const MOVE_CANCEL_PX = 10;

export function useLongPress(
  onLongPress: (e: ReactPointerEvent) => void,
  delay = 500,
): {
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
} {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    start.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (e.pointerType === "mouse") return; // mouse has a native right-click context menu
      clear();
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => onLongPress(e), delay);
    },
    [onLongPress, delay, clear],
  );

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const s = start.current;
    if (!s || !timer.current) return;
    if (Math.abs(e.clientX - s.x) > MOVE_CANCEL_PX || Math.abs(e.clientY - s.y) > MOVE_CANCEL_PX) {
      clearTimeout(timer.current);
      timer.current = null;
      start.current = null;
    }
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
  };
}
