import { isExportSafeUrl } from "./urlSafety";

// Neutralise XSS vectors in an exported map SVG before it leaves the app as a standalone
// document (.svg / .html / print-to-PDF), which embed the SVG as live markup via src/io/html.ts.
// The exporter (flow/exportSvg.ts) authors native <text>, but it still emits node <image>s and
// can carry a hyperlink, so a `javascript:`/`data:` URL or any injected script/handler must be
// stripped before the file is opened. A hand-rolled, namespace-aware DOMParser/XMLSerializer pass
// (DOMPurify is avoided — its SVG profiles strip content too aggressively): it removes
// script-bearing elements, every on* handler, and any URL outside a strict allowlist, while
// keeping the safe SVG vocabulary (incl. foreignObject — harmless now that nothing emits it).
// Browser-only (DOMParser/XMLSerializer, like src/io/image.ts); unit-tested under jsdom.

// Elements that can execute script or pull active remote content — removed with
// their subtree. Everything else is kept: all SVG elements and the xhtml
// <div>/<span>/<a>/<img>/<style> that carry node topics inside foreignObject.
const FORBIDDEN_TAGS = new Set(["script", "iframe", "object", "embed", "base", "link", "meta"]);

// URL-bearing attributes that get scheme-filtered. `href` matches both the plain
// and the xlink: namespaced form (same localName); `src` covers <img>/<image>.
const URL_ATTRS = new Set(["href", "src"]);

function scrub(el: Element): void {
  // Snapshot first: removing an attribute mutates the live NamedNodeMap.
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    if (name.startsWith("on")) {
      el.removeAttributeNode(attr);
      continue;
    }
    const local = (attr.localName ?? name).toLowerCase();
    if (URL_ATTRS.has(local) && !isExportSafeUrl(attr.value)) {
      el.removeAttributeNode(attr);
    }
  }
}

// Best-effort strip for the rare case the SVG doesn't parse as XML — fail safe,
// never return the raw input. Regex HTML editing is fragile, so this is only the
// fallback; the DOM walk below is the real sanitiser.
function stripFallback(svg: string): string {
  return svg
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<(?:script|iframe|object|embed|base|link|meta)\b[^>]*?\/?>/gi, "")
    .replace(/\son[a-z-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s/>]+)/gi, "")
    .replace(/\s(?:xlink:href|href|src)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s/>]+)/gi, (m) =>
      /(?:javascript|vbscript|data):/i.test(m) ? "" : m,
    );
}

/**
 * Return a copy of an exported SVG with script-bearing elements, inline event
 * handlers, and dangerous URL schemes removed, while preserving foreignObject
 * node topics, styling, and inline images. Serialises the documentElement, so
 * the `<?xml?>`/DOCTYPE prolog is dropped (cleaner when embedded inline in HTML).
 */
export function sanitizeSvg(svg: string): string {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = doc.documentElement;
  // A malformed document yields a <parsererror> (or no usable root); fall back
  // to a conservative string strip rather than emitting the raw input.
  if (!root || root.localName === "parsererror" || doc.getElementsByTagName("parsererror").length) {
    return stripFallback(svg);
  }

  scrub(root);
  // Snapshot the live descendant list before mutating the tree.
  const toRemove: Element[] = [];
  for (const el of Array.from(root.getElementsByTagName("*"))) {
    if (FORBIDDEN_TAGS.has((el.localName ?? "").toLowerCase())) toRemove.push(el);
    else scrub(el);
  }
  for (const el of toRemove) el.remove();

  return new XMLSerializer().serializeToString(root);
}
