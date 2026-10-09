import { useRef } from "react";

/** A ref that always holds the latest `value`, mirrored DURING render so any post-commit callback reads
 *  the current value immediately (not one render stale, as a useEffect mirror would be). Use it to read
 *  live props/state inside stable useCallback/effect closures without listing them as deps.
 *
 *  NOT for imperative refs that carry their OWN state rather than mirroring a prop/state — a live edited
 *  model (docRef), a history stack (historyRef), or a one-shot mount capture (mountSession). Those must
 *  stay hand-rolled; collapsing them here would clobber their value every render. */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
