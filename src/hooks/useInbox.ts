import { useCallback, useEffect, useState } from "react";
import { type InboxItem, getInbox, saveInbox } from "../store/mapStore";

// Quick-capture inbox state: a map-independent "Unfiled" bucket loaded from IndexedDB once, then
// kept in sync on every mutation. Persistence is fire-and-forget (best-effort, like the rest of the
// local-first store) so the UI never blocks on a write. Newest-first order is maintained by add().
export interface UseInbox {
  items: InboxItem[];
  /** Capture a snippet (trimmed; a blank string is ignored). No-op on whitespace-only input. */
  add: (text: string) => void;
  /** Remove one item (e.g. after filing it onto a map, or discarding it). */
  remove: (id: string) => void;
  /** Empty the whole inbox. */
  clear: () => void;
}

export function useInbox(): UseInbox {
  const [items, setItems] = useState<InboxItem[]>([]);

  // Load once on mount. A later external write (unlikely — single-tab) isn't watched.
  useEffect(() => {
    let live = true;
    void getInbox().then((loaded) => {
      if (live) setItems(loaded);
    });
    return () => {
      live = false;
    };
  }, []);

  // One writer: every mutation goes through this so persistence can't drift from state.
  const commit = useCallback((next: InboxItem[]) => {
    setItems(next);
    void saveInbox(next);
  }, []);

  const add = useCallback((text: string) => {
    const t = text.trim();
    if (!t) return;
    const item: InboxItem = { id: crypto.randomUUID(), text: t, ts: Date.now() };
    // Prepend — newest first, matching getInbox's sort.
    setItems((prev) => {
      const next = [item, ...prev];
      void saveInbox(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      void saveInbox(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => commit([]), [commit]);

  return { items, add, remove, clear };
}
