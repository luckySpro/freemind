// Self-contained HTML export: embed the map's SVG in a standalone document that
// opens anywhere, offline, with no dependencies. Pure + deterministic.
//
// SECURITY: `svg` is interpolated verbatim into live markup, so it MUST already be
// sanitised — pass the output of io/svgSanitize.ts `sanitizeSvg` (the app routes
// exports through useMapExports.cleanSvg, which does exactly that). Never hand this
// raw exporter output or untrusted SVG; `title` is escaped here, the SVG body is not.

import { getLocale } from "../i18n/registry";
import { escapeHtmlContent as escapeHtml } from "./htmlEscape";

/** Wrap an ALREADY-SANITISED SVG (see module note) in a standalone HTML document. */
export function wrapSvgHtml(svg: string, title: string): string {
  return `<!doctype html>
<html lang="${getLocale()}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  body { margin: 0; background: #faf9f5; font-family: ui-sans-serif, system-ui, sans-serif; }
  main { display: flex; justify-content: center; padding: 24px; }
  svg { max-width: 100%; height: auto; }
</style>
</head>
<body>
<main>${svg}</main>
</body>
</html>
`;
}

// Print-to-PDF document: the same embedded SVG, scaled to fit a landscape page,
// for the browser's "Save as PDF". Pure + deterministic; the app loads this into
// a hidden iframe and calls print(). Maps are wide, so the page defaults to
// landscape. No auto-print script here — the caller triggers print on load.
// `appendixHtml`, when supplied, is the notes appendix from io/notesAppendix.ts — already-safe HTML
// (renderNote is escape-first). It prints on its own portrait page(s) after the map.
/** Build a print-to-PDF document from an ALREADY-SANITISED SVG (see module note) + optional notes. */
export function buildPrintDoc(svg: string, title: string, appendixHtml = ""): string {
  return `<!doctype html>
<html lang="${getLocale()}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { size: landscape; margin: 10mm; }
  html, body { margin: 0; padding: 0; background: #fff; }
  main { display: flex; justify-content: center; }
  svg { max-width: 100%; height: auto; }
  .mm-notes-appendix { break-before: page; page-break-before: always; padding: 12mm; font-family: ui-sans-serif, system-ui, sans-serif; color: #23211c; }
  .mm-notes-appendix h2 { font-size: 18px; margin: 0 0 12px; }
  .mm-notes-appendix article { break-inside: avoid; page-break-inside: avoid; margin: 0 0 12px; }
  .mm-notes-appendix h3 { font-size: 13px; margin: 0 0 4px; }
  .mm-notes-appendix img { max-width: 100%; height: auto; }
  .mm-notes-appendix table { border-collapse: collapse; }
  .mm-notes-appendix th, .mm-notes-appendix td { border: 1px solid #ccc; padding: 2px 6px; }
</style>
</head>
<body>
<main>${svg}</main>
${appendixHtml}
</body>
</html>
`;
}
