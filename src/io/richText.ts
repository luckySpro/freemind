// Sanitiser for inline rich-text topics (the React Flow canvas lets you bold/italic/underline
// part of a topic via Ctrl+B/I/U). We keep a tiny allowlist of inline formatting elements +
// safe style props and drop everything else — no library (TipTap/DOMPurify would threaten the
// bundle budget). Mirrors the hand-rolled, DOM-walk approach of io/svgSanitize.ts. Browser/
// jsdom only (DOMParser); unit-tested under jsdom.
//
// `MapNode.topic` always holds the plain-text fallback (search / outline / every io/* exporter
// read it), so rich text is a canvas-only enhancement that never affects the flat formats.

// Inline formatting elements kept verbatim; everything else is unwrapped (its text survives).
const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "SPAN", "BR"]);

// Elements dropped WITH their content (so script/style source never surfaces as visible text).
const DROP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "IFRAME", "OBJECT", "EMBED"]);

// Style declarations kept on a surviving element (e.g. execCommand emits styled spans).
const ALLOWED_STYLE = new Set([
  "font-weight",
  "font-style",
  "text-decoration",
  "text-decoration-line",
  "color",
  "background-color",
]);

const NBSP = String.fromCharCode(160);

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** A CSS colour value safe to inline: hex, rgb()/rgba(), or a bare keyword. No url()/expression. */
function safeColor(v: string): boolean {
  if (/url\(|expression|javascript:|[<>]/i.test(v)) return false;
  return (
    /^#[0-9a-f]{3,8}$/i.test(v) || /^rgba?\([\d.,\s%]+\)$/i.test(v) || /^[a-z][a-z-]*$/i.test(v)
  );
}

/** Keep only allowlisted, value-safe style declarations from a `style` attribute. */
function cleanStyle(style: string): string {
  const out: string[] = [];
  for (const decl of style.split(";")) {
    const idx = decl.indexOf(":");
    if (idx < 0) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const val = decl.slice(idx + 1).trim();
    if (!val || !ALLOWED_STYLE.has(prop)) continue;
    if (/url\(|expression|javascript:|[<>]/i.test(val)) continue;
    if ((prop === "color" || prop === "background-color") && !safeColor(val)) continue;
    out.push(`${prop}: ${val}`);
  }
  return out.join("; ");
}

function cleanNode(node: Node): string {
  if (node.nodeType === 3) return escapeText(node.textContent ?? ""); // text
  if (node.nodeType !== 1) return ""; // drop comments / others
  const el = node as Element;
  const tag = el.tagName.toUpperCase();
  if (DROP_TAGS.has(tag)) return ""; // drop script/style/etc. with their content
  const inner = Array.from(el.childNodes).map(cleanNode).join("");
  if (tag === "BR") return "<br>";
  if (!ALLOWED_TAGS.has(tag)) return inner; // unwrap a disallowed element, keep its text
  const styleAttr = el.getAttribute("style");
  const style = styleAttr ? cleanStyle(styleAttr) : "";
  const lower = tag.toLowerCase();
  return style
    ? `<${lower} style="${escapeAttr(style)}">${inner}</${lower}>`
    : `<${lower}>${inner}</${lower}>`;
}

/** Return a safe inline-HTML subset of `html` (allowlisted tags + style; scripts/handlers gone). */
export function sanitizeRich(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Array.from(doc.body.childNodes).map(cleanNode).join("");
}

/** The plain-text equivalent of a rich-text fragment (for the `topic` fallback). */
export function richToPlain(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  // Contenteditable inserts non-breaking spaces; normalise them to plain spaces.
  return (doc.body.textContent ?? "").split(NBSP).join(" ");
}

/** True if sanitised HTML carries any real inline formatting (else the plain topic suffices). */
export function hasFormatting(cleanHtml: string): boolean {
  return /<(?:b|strong|i|em|u|s|strike|span|br)\b/i.test(cleanHtml);
}
