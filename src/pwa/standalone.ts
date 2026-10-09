// Is the app running as an INSTALLED PWA (standalone window) rather than a normal browser tab?
// Used to gate shortcuts that browsers reserve at the tab level (e.g. Ctrl/⌘+T = new tab), which only
// reach the page in standalone mode. Reads off globalThis so it's safe under SSR/tests (absent → false).

export function isStandalonePwa(): boolean {
  const g = globalThis as {
    matchMedia?: (q: string) => { matches: boolean };
    navigator?: { standalone?: boolean };
  };
  // iOS Safari exposes navigator.standalone; everyone else uses the display-mode media query.
  if (g.navigator?.standalone === true) return true;
  return typeof g.matchMedia === "function" && g.matchMedia("(display-mode: standalone)").matches;
}
