#!/usr/bin/env node
/**
 * Build a single reflowable EPUB 3 of *Thinking in Maps* from docs/guide/*.md.
 *
 *   Output: docs/guide/Thinking-in-Maps.epub
 *
 * EPUB is the Kindle-friendly form: Send-to-Kindle accepts `.epub` natively and
 * reflows the text on any screen (the PDF is fixed A4 — fine for desktop/print,
 * cramped on a 6-inch e-reader).
 *
 * Pure Node: marked (Markdown) + jszip (the EPUB zip container). Diagrams are
 * generated from source constants and inlined as SVG, so there are no external
 * image assets to embed. Re-run via `pnpm book:epub` (or `pnpm book` for both).
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import JSZip from "jszip";
import { marked } from "marked";
import {
  BOOK_AUTHOR,
  BOOK_ID,
  BOOK_LANG,
  BOOK_PUBLISHER,
  BOOK_SLUG,
  BOOK_SUBJECTS,
  BOOK_SUBTITLE,
  BOOK_TITLE,
  PUBLIC_DIR,
  TOC_GROUPS,
  readChapterMetadata,
} from "./lib/bookChapters.mjs";
import { diagramCaption, diagramSvg, hasDiagram } from "./lib/bookDiagrams.mjs";

const OUT_PATH = join(PUBLIC_DIR, `${BOOK_SLUG}.epub`);

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Replace each `<!-- DIAGRAM:name -->` placeholder with an inline-SVG figure.
function expandDiagrams(md) {
  return md.replace(/<!--\s*DIAGRAM:([\w-]+)\s*-->/g, (_full, name) => {
    if (!hasDiagram(name)) return `<!-- unknown diagram: ${name} -->`;
    return `\n\n<figure class="diagram">\n${diagramSvg(name)}\n<figcaption>${xmlEscape(
      diagramCaption(name),
    )}</figcaption>\n</figure>\n\n`;
  });
}

// marked emits HTML5 void elements (`<br>`, `<hr>`, `<img>`); EPUB wants XHTML.
function htmlToXhtml(html) {
  return html
    .replace(/<br>/g, "<br />")
    .replace(/<hr>/g, "<hr />")
    .replace(/<(img[^>]*?)(?<!\/)>/g, "<$1 />");
}

function chapterToXhtml(slug, markdownSource) {
  const expanded = expandDiagrams(markdownSource);
  let html = marked.parse(expanded, { async: false, gfm: true });
  // Anchor the H1 so the EPUB navigation lands at the chapter head.
  html = html.replace(/<h1(.*?)>/, `<h1 id="${slug}"$1>`);
  return htmlToXhtml(html);
}

function chapterDocument(title, bodyXhtml) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${BOOK_LANG}" lang="${BOOK_LANG}">
<head>
<title>${xmlEscape(title)}</title>
<meta charset="utf-8" />
<link rel="stylesheet" type="text/css" href="styles.css" />
</head>
<body>
${bodyXhtml}
</body>
</html>
`;
}

function coverXhtml(now) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${BOOK_LANG}" lang="${BOOK_LANG}">
<head>
<title>${xmlEscape(BOOK_TITLE)}</title>
<meta charset="utf-8" />
<link rel="stylesheet" type="text/css" href="styles.css" />
</head>
<body class="cover-body">
<section class="cover">
  <div class="cover-eyebrow">A MindMap Studio guide</div>
  <h1 class="cover-title">${xmlEscape(BOOK_TITLE)}</h1>
  <div class="cover-subtitle">${xmlEscape(BOOK_SUBTITLE)}</div>
  <div class="cover-meta">
    <div>${xmlEscape(BOOK_AUTHOR)}</div>
    <div>Generated ${now.toISOString().split("T")[0]}</div>
    <div>${xmlEscape(BOOK_PUBLISHER)}</div>
  </div>
</section>
</body>
</html>
`;
}

function navXhtml(chapters) {
  const grouped = TOC_GROUPS.map((group) => {
    const items = chapters.filter(group.match);
    if (items.length === 0) return "";
    const lis = items
      .map((c) => {
        const idx = chapters.indexOf(c);
        return `      <li><a href="chapter-${String(idx).padStart(2, "0")}.xhtml">${xmlEscape(
          c.title,
        )}</a></li>`;
      })
      .join("\n");
    return `  <li>${xmlEscape(group.label)}\n    <ol>\n${lis}\n    </ol>\n  </li>`;
  })
    .filter(Boolean)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${BOOK_LANG}" lang="${BOOK_LANG}">
<head>
<title>Contents</title>
<meta charset="utf-8" />
<link rel="stylesheet" type="text/css" href="styles.css" />
</head>
<body>
<nav epub:type="toc" id="toc">
<h1>Contents</h1>
<ol>
${grouped}
</ol>
</nav>
</body>
</html>
`;
}

function tocNcx(chapters) {
  const navPoints = chapters
    .map((c, idx) => {
      const num = String(idx).padStart(2, "0");
      return `<navPoint id="navPoint-${idx}" playOrder="${idx + 1}">
<navLabel><text>${xmlEscape(c.title)}</text></navLabel>
<content src="chapter-${num}.xhtml" />
</navPoint>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head>
<meta name="dtb:uid" content="${BOOK_ID}" />
<meta name="dtb:depth" content="1" />
<meta name="dtb:totalPageCount" content="0" />
<meta name="dtb:maxPageNumber" content="0" />
</head>
<docTitle><text>${xmlEscape(BOOK_TITLE)}</text></docTitle>
<navMap>
${navPoints}
</navMap>
</ncx>
`;
}

function contentOpf(chapters, now) {
  const dateIso = now.toISOString().split("T")[0];
  const manifestItems = [
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />',
    '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml" />',
    '<item id="styles" href="styles.css" media-type="text/css" />',
    '<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml" />',
  ];
  chapters.forEach((_c, idx) => {
    const num = String(idx).padStart(2, "0");
    manifestItems.push(
      `<item id="chapter-${num}" href="chapter-${num}.xhtml" media-type="application/xhtml+xml" />`,
    );
  });

  const spineItems = ['<itemref idref="cover" />'];
  chapters.forEach((_c, idx) => {
    spineItems.push(`<itemref idref="chapter-${String(idx).padStart(2, "0")}" />`);
  });

  const subjects = BOOK_SUBJECTS.map((s) => `  <dc:subject>${xmlEscape(s)}</dc:subject>`).join(
    "\n",
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${BOOK_LANG}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:identifier id="bookid">${BOOK_ID}</dc:identifier>
  <dc:title>${xmlEscape(BOOK_TITLE)}</dc:title>
  <dc:creator>${xmlEscape(BOOK_AUTHOR)}</dc:creator>
  <dc:language>${BOOK_LANG}</dc:language>
  <dc:publisher>${xmlEscape(BOOK_PUBLISHER)}</dc:publisher>
  <dc:date>${dateIso}</dc:date>
  <dc:description>${xmlEscape(BOOK_SUBTITLE)}</dc:description>
${subjects}
  <meta property="dcterms:modified">${dateIso}T00:00:00Z</meta>
</metadata>
<manifest>
${manifestItems.join("\n")}
</manifest>
<spine toc="ncx">
${spineItems.join("\n")}
</spine>
</package>
`;
}

const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>
`;

const EPUB_STYLESHEET = `
body { font-family: serif; font-size: 1em; line-height: 1.5; margin: 0; padding: 0; color: #1f2937; }
.cover-body { text-align: center; }
.cover { padding: 2em 1em; }
.cover-eyebrow { font-family: sans-serif; font-size: 0.75em; letter-spacing: 0.18em; text-transform: uppercase; color: #6366f1; font-weight: 600; margin-bottom: 2em; }
.cover-title { font-family: sans-serif; font-size: 2.6em; line-height: 1.1; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 0.8em 0; color: #111827; }
.cover-subtitle { font-size: 1.1em; line-height: 1.45; color: #4b5563; font-style: italic; margin-bottom: 2em; }
.cover-meta { font-size: 0.7em; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.12em; }
.cover-meta div + div { margin-top: 0.3em; }
h1 { font-family: sans-serif; font-size: 1.8em; font-weight: 700; letter-spacing: -0.01em; color: #111827; margin: 1em 0 0.2em 0; page-break-before: always; }
h2 { font-family: sans-serif; font-size: 1.4em; font-weight: 700; color: #111827; margin: 1.5em 0 0.5em 0; }
h3 { font-family: sans-serif; font-size: 1.15em; font-weight: 700; color: #1f2937; margin: 1.2em 0 0.4em 0; }
p { margin: 0 0 0.8em 0; text-align: justify; hyphens: auto; }
ul, ol { margin: 0 0 0.8em 0; padding-left: 1.5em; }
li { margin: 0.15em 0; }
strong { color: #111827; font-weight: 700; }
code { font-family: monospace; font-size: 0.9em; background: #f3f4f6; border-radius: 3px; padding: 0.05em 0.3em; color: #be185d; }
pre { font-family: monospace; font-size: 0.85em; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 3px; padding: 0.8em; margin: 0 0 1em 0; white-space: pre-wrap; }
pre code { background: transparent; padding: 0; color: #1f2937; }
blockquote { border-left: 3px solid #6366f1; background: #f5f3ff; padding: 0.8em 1.2em; margin: 0 0 1em 0; color: #4b5563; border-radius: 0 3px 3px 0; }
blockquote p { margin: 0 0 0.5em 0; font-style: normal; }
blockquote p:last-child { margin-bottom: 0; }
table { border-collapse: collapse; width: 100%; margin: 0 0 1em 0; font-size: 0.9em; }
th, td { border: 1px solid #e5e7eb; padding: 0.4em 0.6em; text-align: left; vertical-align: top; }
th { background: #f9fafb; font-weight: 700; color: #111827; }
hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.5em 0; }
a { color: #6366f1; text-decoration: none; }
figure.diagram { margin: 1.2em 0; text-align: center; }
figure.diagram svg { max-width: 100%; height: auto; }
figure.diagram figcaption { font-family: sans-serif; font-size: 0.8em; color: #6b7280; margin-top: 0.5em; font-style: italic; }
`;

/** Build the EPUB and return it as a Node Buffer (no file write — keeps it testable). */
export async function buildEpub() {
  const chapters = await readChapterMetadata();
  const now = new Date();
  // Pin entry timestamps to date-only (midnight UTC) so the EPUB is byte-stable
  // within a day. JSZip otherwise stamps each entry with the wall-clock time, so
  // every rebuild would differ and the Rebuild-book workflow would commit a no-op
  // "timestamp churn" each time the manuscript changes.
  const date = new Date(`${now.toISOString().split("T")[0]}T00:00:00Z`);
  const zip = new JSZip();

  // mimetype MUST be first + STORE-compressed (uncompressed) per the EPUB spec.
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", CONTAINER_XML);
  zip.file("OEBPS/content.opf", contentOpf(chapters, now));
  zip.file("OEBPS/nav.xhtml", navXhtml(chapters));
  zip.file("OEBPS/toc.ncx", tocNcx(chapters));
  zip.file("OEBPS/styles.css", EPUB_STYLESHEET);
  zip.file("OEBPS/cover.xhtml", coverXhtml(now));
  chapters.forEach((c, idx) => {
    const num = String(idx).padStart(2, "0");
    zip.file(`OEBPS/chapter-${num}.xhtml`, chapterDocument(c.title, chapterToXhtml(c.slug, c.raw)));
  });
  // Override the timestamp on EVERY entry — files and the folder entries JSZip
  // auto-creates (META-INF/, OEBPS/) — so none carries the wall-clock time.
  for (const entry of Object.values(zip.files)) entry.date = date;

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
}

async function main() {
  console.log(`📖 Building ${BOOK_SLUG}.epub …`);
  const buf = await buildEpub();
  await writeFile(OUT_PATH, buf);
  console.log(`✓ Wrote ${OUT_PATH} (${(buf.length / 1024).toFixed(1)} KB)`);
}

// Run only when executed directly (node scripts/build-book-epub.mjs), not on import.
if (process.argv[1]?.endsWith("build-book-epub.mjs")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
