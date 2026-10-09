// Guards the PWA navigation denylist: with the service worker installed, workbox's
// NavigationRoute rewrites every top-level navigation into the precached SPA shell
// unless a denylist pattern matches. That once swallowed the book downloads —
// /Thinking-in-Maps.pdf opened the app instead of the PDF for anyone who had
// visited before. Assert every real file the site serves is denied the fallback
// (reaches the network) while app routes still get the offline shell.
import { describe, expect, it } from "vitest";
import { NAVIGATION_FALLBACK_DENYLIST } from "../src/pwa/navigationDenylist";

// Mirrors workbox-routing NavigationRoute semantics: patterns are tested against
// `url.pathname + url.search` (never the hash or origin).
function deniesFallback(url: string): boolean {
  const u = new URL(url, "https://mindmap-studio.example");
  const pathnameAndSearch = u.pathname + u.search;
  return NAVIGATION_FALLBACK_DENYLIST.some((re) => re.test(pathnameAndSearch));
}

describe("PWA navigateFallbackDenylist", () => {
  it("lets every served file through to the network", () => {
    const files = [
      "/Thinking-in-Maps.pdf",
      "/Thinking-in-Maps.epub",
      "/user-guide.html",
      "/dashboard.html",
      "/notices.html",
      "/stats.json",
      "/stats-history.json",
      "/icon.svg",
      "/apple-touch-icon.png",
    ];
    for (const f of files) {
      expect(deniesFallback(f), `${f} must bypass the SPA fallback`).toBe(true);
    }
  });

  it("still denies the fallback when a file URL carries a query string", () => {
    expect(deniesFallback("/Thinking-in-Maps.pdf?v=2")).toBe(true);
  });

  it("keeps the offline shell for app routes, even with dotted query values", () => {
    expect(deniesFallback("/")).toBe(false);
    expect(deniesFallback("/?map=Foo.mmst")).toBe(false);
    expect(deniesFallback("/some-route")).toBe(false);
  });
});
