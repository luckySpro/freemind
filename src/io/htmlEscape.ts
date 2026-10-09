// Shared HTML escapers, named for their context + escape level so a call site can't reach for one
// that's too weak. Escaping more than the context strictly needs is always safe, so they form a
// ladder — content < attribute < script-safe — and a writer should pick the strictest that fits.
//   • content  : text between tags (& < >)
//   • attr     : a quoted attribute value, adds " and ' (& < > " ')
//   • scriptSafe: also escapes "/", so a "</script>" inside embedded data can't break out of a
//                 <script> block (& < > " ' /)
// The repo has hit stored-XSS twice (see svgSanitize / the export-safety tests); centralising the
// escapers here keeps the "right escaper for the context" decision in one auditable place.

/** Escape for HTML element CONTENT (& < >). */
export function escapeHtmlContent(text: string): string {
  return text.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));
}

/** Escape for a quoted HTML ATTRIBUTE value (& < > " '). */
export function escapeHtmlAttr(text: string): string {
  return text.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

/** Escape for HTML that is also safe inside a <script> data block (& < > " ' /), so an embedded
 *  "</script>" can't terminate the block early. */
export function escapeHtmlScriptSafe(text: string): string {
  return text.replace(/[&<>"'/]/g, (c) =>
    c === "&"
      ? "&amp;"
      : c === "<"
        ? "&lt;"
        : c === ">"
          ? "&gt;"
          : c === '"'
            ? "&quot;"
            : c === "'"
              ? "&#39;"
              : "&#47;",
  );
}
