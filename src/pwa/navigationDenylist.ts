// Navigations the service worker must NOT rewrite into the precached SPA shell
// (fed to workbox's `navigateFallbackDenylist` in vite.config.ts). Workbox's
// NavigationRoute answers every top-level navigation with the cached index.html
// unless a denylist pattern matches — so anything that is a real file on the
// server (the book downloads /Thinking-in-Maps.pdf + .epub, the standalone
// dashboard/notices/user-guide .html pages, stats.json) must be denied here or
// installed clients get the app instead of the file.
//
// The rule: a pathname ending in a dot-extension is a file, not an app route
// (the app has no dot-containing routes), so future artifacts in public/ can't
// re-hit this bug. Workbox tests patterns against `pathname + search`, so the
// leading `[^?]*` keeps the extension match inside the pathname — a dotted
// query value on an app route (`/?map=Foo.mmst`) still falls back to the shell.
export const NAVIGATION_FALLBACK_DENYLIST = [/^[^?]*\.[a-z0-9]+(\?|$)/i];
