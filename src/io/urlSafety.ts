// URL-scheme safety checks shared by the SVG export sanitiser (the injection
// sink) and the hyperlink input boundaries (typed + imported links). Pure
// string logic — no DOM — so importers and the model<->canvas sync can use it
// without pulling in the browser-only sanitiser.

// Browsers ignore leading C0 control characters and spaces (U+0000–U+0020) when
// resolving a URL scheme, so `java\tscript:alert(1)` still runs. Strip every
// such character before testing, and lowercase for a case-insensitive match.
// (Done char-by-char rather than with a control-character regex, which trips
// biome's noControlCharactersInRegex.)
function schemeOf(url: string): string {
  let s = "";
  for (let i = 0; i < url.length; i++) {
    if (url.charCodeAt(i) > 0x20) s += url[i];
  }
  return s.toLowerCase();
}

/**
 * True for URL schemes that execute script or load active content when a link
 * is followed — `javascript:`, `data:`, `vbscript:`. Used at input boundaries
 * (typed and imported hyperlinks) so such a link is never stored on a node.
 */
export function isDangerousUrl(url: string): boolean {
  return /^(?:javascript|vbscript|data):/.test(schemeOf(url));
}

/**
 * True for URL schemes safe to emit in an exported document: http(s), mailto,
 * tel, in-page anchors (`#…`, including the app's `#map=` links), and inline
 * image data URLs. A strict allowlist used by the SVG export sanitiser, where
 * any URL not provably safe is dropped from the output. (`file:` is deliberately
 * excluded — browsers block file:// navigation from a web context.)
 */
export function isExportSafeUrl(url: string): boolean {
  const s = schemeOf(url);
  return /^(?:https?:|mailto:|tel:|#)/.test(s) || /^data:image\//.test(s);
}
