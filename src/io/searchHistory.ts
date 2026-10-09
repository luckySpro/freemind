// Recent-searches history for Find & Replace (item 18) — the last few queries, most-recent-first,
// so the Find box can offer them as a datalist (MindManager remembers your recent searches). Pure
// list logic here (unit-tested); the overlay reads/writes localStorage through loadHistory/recordSearch.

const KEY = "mindmap-search-history";
const LIMIT = 10;

/** Add `query` to the front of `history` (most-recent-first), de-duplicated, capped at `limit`. A
 *  blank/whitespace query returns the list unchanged. Pure. */
export function pushHistory(history: string[], query: string, limit = LIMIT): string[] {
  const q = query.trim();
  if (!q) return history;
  return [q, ...history.filter((h) => h !== q)].slice(0, limit);
}

/** Read the saved history (most-recent-first), or [] when empty / unreadable. */
export function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Record a query into the saved history and return the new list (best-effort persist). */
export function recordSearch(query: string): string[] {
  const next = pushHistory(loadHistory(), query);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // best-effort — history just won't persist this session
  }
  return next;
}
