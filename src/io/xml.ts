// Shared XML escapers, named for their context so a call site can't quietly pick the wrong one.
// Element CONTENT only needs &, <, > escaped; an ATTRIBUTE value additionally needs " escaped
// (values are double-quoted everywhere we emit them). Both are used by the .opml / .smmx / .mm
// (FreeMind) writers and the OOXML (.docx / .pptx / .xlsx) builders.

/** Escape a string for XML element CONTENT (& < >). */
export function escapeXmlContent(s: string): string {
  return s.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));
}

/** Escape a string for a double-quoted XML ATTRIBUTE value (& < > "). Safe for content too, so the
 *  writers that emit both attributes and content use this one throughout. */
export function escapeXmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
