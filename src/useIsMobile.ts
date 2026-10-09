import { useEffect, useState } from "react";

// True when the viewport is phone-width. The editor toolbar is built for a wide screen (it wraps
// into a wall of rows on a phone), so the editor uses this to switch it to a compact, single
// horizontally-scrollable strip. matchMedia, so it tracks rotation / resize live.
export function useIsMobile(query = "(max-width: 640px)"): boolean {
  const supported = typeof window !== "undefined" && typeof window.matchMedia === "function";
  const [matches, setMatches] = useState(() =>
    supported ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    if (!supported) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query, supported]);
  return matches;
}
