import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import type { MindMapDoc } from "../model/types";
import { saveMap, setLastOpened } from "../store/mapStore";

/** The live autosave status, surfaced in the toolbar badge so "Saved locally" can't lie: `saving`
 *  while a debounced/in-flight write is pending, `saved` once it lands, `error` if the write throws
 *  (quota exceeded / private-mode / disk full) instead of silently swallowing it. */
export type SaveState = "idle" | "saving" | "saved" | "error";

// The IndexedDB autosave path: a debounced write-through of the live doc to the library (the always-on
// safety net), plus the guards that keep an edit from being lost on tab close. Lifted out of App so the
// shell isn't carrying the debounce + lifecycle effects inline.
//
// Ordering note: `persist` feeds the version-history auto-snapshot (`maybeSnapshot`, which comes from
// useVersionHistory) and App's `load` calls `persist` — so this hook is wired *after* useVersionHistory
// and *before* `load`.

interface Options {
  /** The live (uncommitted) doc — read by ref so the handlers always see the latest. */
  liveDocRef: RefObject<MindMapDoc>;
  /** Mirror of the file-dirty flag (drives the beforeunload guard). */
  dirtyRef: RefObject<boolean>;
  /** Refresh the library list after a save (App-owned). */
  refreshMaps: () => Promise<void> | void;
  /** Edit-driven saves feed the throttled version-history snapshot. */
  maybeSnapshot: (doc: MindMapDoc) => void;
}

export function useIdbAutosave({ liveDocRef, dirtyRef, refreshMaps, maybeSnapshot }: Options) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const persist = useCallback(
    // `snapshot` is true only on edit-driven saves — opening/switching a map shouldn't create a
    // version, or pure reloads would spam the history.
    async (d: MindMapDoc, snapshot = false) => {
      setSaveState("saving");
      try {
        await saveMap(d);
        await setLastOpened(d.id);
        await refreshMaps();
        // Edit-driven saves feed the version-history auto-snapshot (throttle lives inside that hook).
        if (snapshot) maybeSnapshot(d);
        setSaveState("saved");
      } catch {
        // Don't swallow it silently — a quota/private-mode failure must reach the badge so the user
        // doesn't trust "Saved locally" while nothing persisted.
        setSaveState("error");
      }
    },
    [refreshMaps, maybeSnapshot],
  );

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving"); // a pending edit → show "Saving…" right away, before the debounce fires
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null; // mark not-pending so the hidden-flush below skips an already-saved doc
      persist(liveDocRef.current, true);
    }, 500);
  }, [persist, liveDocRef]);

  // Warn before leaving with unsaved changes to a linked file. Only fires when a file is bound and
  // behind (dirtyRef) — a library-only map autosaves to IndexedDB, so it never blocks the unload.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirtyRef]);

  // A library-only map autosaves to IndexedDB on a 500ms debounce, so an edit made just before the tab
  // is hidden/closed would be lost if that debounce hasn't fired yet. Flush a pending autosave the
  // moment the page is hidden — visibilitychange is the reliable persistence signal (beforeunload can't
  // run async work and is unreliable on mobile). The disk write-through is intentionally NOT flushed
  // here: it needs a live permission grant and FS writes from a hidden page aren't reliable; the
  // IndexedDB copy stays the record of truth.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState !== "hidden" || !saveTimer.current) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      void persist(liveDocRef.current, true);
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, [persist, liveDocRef]);

  return { persist, scheduleSave, saveState };
}
