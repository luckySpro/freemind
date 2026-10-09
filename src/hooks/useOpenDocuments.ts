import { useCallback, useEffect, useRef, useState } from "react";
import { type TabSession, setTabSession } from "../store/mapStore";

/**
 * The open-document tab registry: which maps are open (in tab order) and which is active. It does
 * NOT own the document state — `doc`/`liveDoc`/selection stay in App as the single active map. The
 * registry just tracks the open set and follows the active map: App calls `ensureOpen(doc.id)` from
 * its load path, so opening/switching a map registers/activates its tab. Switching tabs reloads the
 * map from the store (cheap; lossless-for-recent caching is a later step).
 *
 * The set + active id are persisted (TabSession) so a reload restores the whole workspace.
 */
export function useOpenDocuments() {
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Mirror of openIds for synchronous reads inside closeTab (state updaters mustn't compute return
  // values — they don't run at call time and double-invoke under StrictMode).
  const openIdsRef = useRef<string[]>([]);
  openIdsRef.current = openIds;

  /** Register a map as a tab (if not already open) and make it the active tab. Idempotent. */
  const ensureOpen = useCallback((mapId: string) => {
    setOpenIds((prev) => (prev.includes(mapId) ? prev : [...prev, mapId]));
    setActiveId(mapId);
  }, []);

  /**
   * Close a tab. Removes it from the open set and, if it was the active tab, advances the active id
   * to a neighbour (or null when none remain). Returns the neighbour map id so the caller can load
   * it (or null to fall back to the start screen).
   */
  const closeTab = useCallback((mapId: string): string | null => {
    const prev = openIdsRef.current;
    const idx = prev.indexOf(mapId);
    if (idx === -1) return null;
    const remaining = prev.filter((id) => id !== mapId);
    const neighbour = remaining[idx] ?? remaining[idx - 1] ?? null;
    openIdsRef.current = remaining; // keep the ref current so a same-tick second close is correct
    setOpenIds(remaining);
    setActiveId((cur) => (cur === mapId ? neighbour : cur));
    return neighbour;
  }, []);

  /** Move an open tab from one index to another (drag-to-reorder); no-op for out-of-range/identical. */
  const reorder = useCallback((from: number, to: number) => {
    setOpenIds((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length)
        return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  /** Seed the registry from a persisted session on boot (before the active map is loaded). */
  const restoreSession = useCallback((session: TabSession) => {
    const ids = session.openTabIds.length ? session.openTabIds : [session.activeTabId];
    setOpenIds(ids);
    setActiveId(session.activeTabId);
  }, []);

  // Persist whenever the set or active id changes. Guarded by `hydrated` so the INITIAL empty state
  // (mount, before boot reads the stored session) never clobbers it — but once something has been
  // open, an empty state IS persisted (so closing the last tab actually sticks across a reload, and
  // doesn't resurrect the closed map). An empty session writes activeTabId "" — boot treats that as
  // "nothing open" → start screen.
  const hydrated = useRef(false);
  useEffect(() => {
    if (activeId !== null) hydrated.current = true;
    if (!hydrated.current) return;
    void setTabSession({ openTabIds: openIds, activeTabId: activeId ?? "" });
  }, [openIds, activeId]);

  return { openIds, activeId, ensureOpen, closeTab, reorder, restoreSession };
}
