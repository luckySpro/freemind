// A tiny immutable undo/redo stack over whole-doc snapshots. The React Flow editor is
// model-first (every edit produces a new MindMapDoc), so snapshot history is both simple and
// correct — no inverse-op bookkeeping. Pure + unit-tested; FlowInner holds one in a ref.

export interface History<T> {
  past: T[];
  future: T[];
}

const CAP = 100;

export function createHistory<T>(): History<T> {
  return { past: [], future: [] };
}

/** Record the previous value before an edit; clears the redo branch. Caps depth. */
export function record<T>(h: History<T>, prev: T, cap = CAP): History<T> {
  return { past: [...h.past, prev].slice(-cap), future: [] };
}

/** Undo: returns the value to restore + the new history, or null if nothing to undo. */
export function undo<T>(h: History<T>, current: T): { history: History<T>; value: T } | null {
  if (h.past.length === 0) return null;
  const value = h.past[h.past.length - 1];
  return { history: { past: h.past.slice(0, -1), future: [current, ...h.future] }, value };
}

/** Redo: returns the value to restore + the new history, or null if nothing to redo. */
export function redo<T>(h: History<T>, current: T): { history: History<T>; value: T } | null {
  if (h.future.length === 0) return null;
  const value = h.future[0];
  return { history: { past: [...h.past, current], future: h.future.slice(1) }, value };
}
