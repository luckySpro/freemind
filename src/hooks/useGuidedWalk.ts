import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { MindMapHandle } from "../mindmap";
import { findAnyNode } from "../mindmap/flow/ops";
import type { MapNode, MindMapDoc } from "../model/types";
import { outlineRows } from "../outline";

// Guided walk (presentation tour): step through every topic in depth-first outline order with a
// spotlight + speaker notes. Lifted out of App; behaviour is verbatim. The hook owns the step index +
// the keyboard handling (Escape exits the overlay; ←/→ step while walking), and coordinates the
// spotlight by driving App's focus (and clearing its drill on Escape) via the passed setters.

type FocusTarget = { id: string; topic: string };

export interface UseGuidedWalk {
  /** Current step index (0-based), or null when the walk is off. */
  index: number | null;
  /** Total topics in the walk order. */
  total: number;
  /** The topic at the current step, or null. */
  node: MapNode | null;
  /** Start the walk at the first topic (no-op on an empty map). */
  start: () => void;
  /** Exit the walk and clear the spotlight. */
  exit: () => void;
  /** Move `delta` steps (clamped to the ends); no-op when not walking. */
  step: (delta: number) => void;
  /** Cinematic mode: frame each step's whole branch with an animated zoom (Prezi-style) instead of
   *  centring the single topic at 100%. Remembered across sessions. */
  cinematic: boolean;
  toggleCinematic: () => void;
}

const CINEMATIC_KEY = "mindmap-cinematic-walk";

export function useGuidedWalk(opts: {
  liveDoc: MindMapDoc;
  liveDocRef: RefObject<MindMapDoc>;
  mapRef: RefObject<MindMapHandle | null>;
  setFocus: Dispatch<SetStateAction<FocusTarget | null>>;
  setDrillId: Dispatch<SetStateAction<string | null>>;
}): UseGuidedWalk {
  const { liveDoc, liveDocRef, mapRef, setFocus, setDrillId } = opts;
  const [walk, setWalk] = useState<number | null>(null);
  const [cinematic, setCinematic] = useState<boolean>(() => {
    try {
      return localStorage.getItem(CINEMATIC_KEY) === "on";
    } catch {
      return false;
    }
  });
  const toggleCinematic = useCallback(() => {
    setCinematic((c) => {
      const next = !c;
      try {
        localStorage.setItem(CINEMATIC_KEY, next ? "on" : "off");
      } catch {
        // best-effort
      }
      return next;
    });
  }, []);
  const walkOrder = useMemo(() => outlineRows(liveDoc.root).map((r) => r.id), [liveDoc]);
  const node = walk != null ? findAnyNode(liveDoc, walkOrder[walk] ?? "") : null;

  const start = useCallback(() => {
    if (walkOrder.length > 0) setWalk(0);
  }, [walkOrder.length]);
  const exit = useCallback(() => {
    setWalk(null);
    setFocus(null);
  }, [setFocus]);
  const step = useCallback(
    (delta: number) =>
      setWalk((i) => (i == null ? i : Math.max(0, Math.min(walkOrder.length - 1, i + delta)))),
    [walkOrder.length],
  );

  // On each step: spotlight the topic (reuse the focus dim pipeline) and move the camera to it. In
  // cinematic mode the camera frames the topic's whole branch with an animated zoom (a Prezi-style
  // fly); otherwise it centres the single topic at 100%. (Reads the doc via liveDocRef so it re-runs
  // only when the step / mode changes, not on every edit.)
  useEffect(() => {
    if (walk == null) return;
    const id = walkOrder[walk];
    const found = id ? findAnyNode(liveDocRef.current, id) : null;
    if (!found) return;
    setFocus({ id, topic: found.topic });
    requestAnimationFrame(() => {
      if (cinematic) mapRef.current?.frameBranch(id, { duration: 550 });
      else mapRef.current?.focusNode(id);
    });
  }, [walk, walkOrder, liveDocRef, mapRef, setFocus, cinematic]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFocus(null);
        setDrillId(null);
        setWalk(null);
        return;
      }
      // While walking, ←/→ step through topics (ignored when typing in a field/editor).
      if (walk != null && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        const el = document.activeElement;
        const typing =
          el instanceof HTMLElement &&
          (el.isContentEditable ||
            el.tagName === "INPUT" ||
            el.tagName === "TEXTAREA" ||
            el.tagName === "SELECT");
        if (typing) return;
        e.preventDefault();
        step(e.key === "ArrowRight" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [walk, step, setFocus, setDrillId]);

  return {
    index: walk,
    total: walkOrder.length,
    node,
    start,
    exit,
    step,
    cinematic,
    toggleCinematic,
  };
}
