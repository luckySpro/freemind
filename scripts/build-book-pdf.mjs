#!/usr/bin/env node
/**
 * Build a fixed-layout A4 PDF of *Thinking in Maps* from docs/guide/*.md.
 *
 *   Output: docs/guide/Thinking-in-Maps.pdf
 *
 * Pure Node — pdf-lib for the document, marked's lexer for the manuscript. No
 * Chromium / Playwright (TP Studio's book uses a headless browser; this project
 * has neither, and a pure-Node builder is verifiable on any machine and adds no
 * 150 MB binary to CI). pdf-lib can't embed SVG, so the diagram is drawn from the
 * same source layout the EPUB renders as SVG — one model, two renderers.
 *
 * Produces: a cover page, a clickable table of contents, chapter bookmarks
 * (PDF outline), and document metadata carrying the stable book id. Re-run via
 * `pnpm book:pdf` (or `pnpm book` for both formats).
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { marked } from "marked";
import { PDFDocument, PDFName, PDFString, StandardFonts, rgb } from "pdf-lib";
import {
  BOOK_AUTHOR,
  BOOK_ID,
  BOOK_PUBLISHER,
  BOOK_SLUG,
  BOOK_SUBTITLE,
  BOOK_TITLE,
  PUBLIC_DIR,
  readChapterMetadata,
} from "./lib/bookChapters.mjs";
import { diagramCaption, diagramLayout } from "./lib/bookDiagrams.mjs";

const OUT_PATH = join(PUBLIC_DIR, `${BOOK_SLUG}.pdf`);

const PAGE = { w: 595.28, h: 841.89 }; // A4 portrait, points
const M = { top: 68, bottom: 64, left: 66, right: 66 };
const CONTENT_W = PAGE.w - M.left - M.right;

const INK = rgb(0.12, 0.16, 0.22);
const HEAD = rgb(0.07, 0.09, 0.15);
const MUTED = rgb(0.42, 0.45, 0.5);
const ACCENT = rgb(0.39, 0.4, 0.95);
const CODE_INK = rgb(0.74, 0.09, 0.36);
const CODE_BG = rgb(0.95, 0.96, 0.97);
const QUOTE_BG = rgb(0.96, 0.95, 1.0);
const RULE = rgb(0.9, 0.91, 0.93);
const ROOT_FILL = rgb(0.149, 0.129, 0.36);
const WHITE = rgb(1, 1, 1);

function hexToRgb(hex) {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

// Standard fonts use WinAnsi: it covers Latin + common punctuation (em dash,
// curly quotes, ellipsis, bullet) but not arrows or emoji. Map the few arrows
// we might use and strip emoji/dingbats/UI-icon glyphs so a draw never throws.
// The stripped blocks cover emoji (1F000-1FAFF), misc symbols + dingbats
// (2600-27BF), misc symbols & arrows (2B00-2BFF), supplemental arrows-B & misc
// math symbols-B (2900-29FF, e.g. ⧉ used as the Copy-outline button glyph), and
// arrows (2190-21FF). Prose may name a toolbar button by its icon (e.g. "⧉ Copy
// outline", "🔎 All maps"); the EPUB shows the glyph, the PDF drops it and keeps
// the words. (Box-drawing in code fences renders via codeBlock's safe path.)
function pdfText(s) {
  return decodeEntities(s)
    .replace(/→/g, "->")
    .replace(/←/g, "<-")
    .replace(/↔/g, "<->")
    .replace(/⇒/g, "=>")
    .replace(
      /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2900}-\u{29FF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}]/gu,
      "",
    )
    .replace(/️/g, "");
}

/** Build the PDF and return its bytes (no file write — keeps it testable). */
export async function buildPdf() {
  const chapters = await readChapterMetadata();
  const pdf = await PDFDocument.create();
  const F = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await pdf.embedFont(StandardFonts.HelveticaBoldOblique),
    mono: await pdf.embedFont(StandardFonts.Courier),
  };

  const S = { page: null, y: M.top };
  const addPage = () => {
    S.page = pdf.addPage([PAGE.w, PAGE.h]);
    S.y = M.top;
    return S.page;
  };
  const space = (h) => {
    if (S.y + h > PAGE.h - M.bottom) addPage();
  };
  const safeDraw = (page, str, opts) => {
    try {
      page.drawText(str, opts);
    } catch {
      page.drawText(str.replace(/[^\x20-\x7E]/g, ""), opts);
    }
  };
  // Measure with the same ASCII fallback safeDraw uses: a glyph that slipped past
  // pdfText can never throw here, and the measured width matches what is drawn.
  const safeWidth = (font, str, size) => {
    try {
      return font.widthOfTextAtSize(str, size);
    } catch {
      return font.widthOfTextAtSize(str.replace(/[^\x20-\x7E]/g, ""), size);
    }
  };

  const fontFor = (run) => {
    if (run.code) return F.mono;
    if (run.b && run.i) return F.boldItalic;
    if (run.b) return F.bold;
    if (run.i) return F.italic;
    return F.regular;
  };

  // Flatten marked inline tokens into styled runs.
  function inlineRuns(tokens, style = {}) {
    const out = [];
    for (const t of tokens || []) {
      if (t.type === "strong") out.push(...inlineRuns(t.tokens, { ...style, b: true }));
      else if (t.type === "em") out.push(...inlineRuns(t.tokens, { ...style, i: true }));
      else if (t.type === "codespan") out.push({ text: t.text, code: true, ...style });
      else if (t.type === "link") out.push(...inlineRuns(t.tokens, { ...style, link: true }));
      else if (t.type === "br") out.push({ text: "\n", ...style });
      else if (t.type === "text" && t.tokens) out.push(...inlineRuns(t.tokens, style));
      else out.push({ text: t.text ?? t.raw ?? "", ...style });
    }
    return out;
  }

  // Word-wrap styled runs into lines and draw them, paginating as needed.
  function flow(runs, opts = {}) {
    const {
      x = M.left,
      width = CONTENT_W,
      size = 10.5,
      lineHeight = 15.5,
      color = INK,
      leftBar = null,
      bg = null,
    } = opts;
    const spaceW = F.regular.widthOfTextAtSize(" ", size);

    // tokenize runs into words (style-carrying) + explicit breaks
    const words = [];
    for (const r of runs) {
      if (r.text === "\n") {
        words.push({ br: true });
        continue;
      }
      for (const p of pdfText(r.text).split(/\s+/)) {
        if (p !== "") words.push({ text: p, run: r });
      }
    }

    let line = [];
    let lineW = 0;
    const drawLine = () => {
      space(lineHeight);
      const top = S.y;
      const boxBottom = PAGE.h - top - lineHeight;
      if (bg)
        S.page.drawRectangle({
          x: x - 8,
          y: boxBottom,
          width: width + 12,
          height: lineHeight,
          color: bg,
        });
      if (leftBar)
        S.page.drawRectangle({
          x: x - 10,
          y: boxBottom,
          width: 3,
          height: lineHeight,
          color: leftBar,
        });
      let cx = x;
      for (const w of line) {
        const f = fontFor(w.run);
        const col = w.run.code ? CODE_INK : w.run.link ? ACCENT : color;
        safeDraw(S.page, w.text, { x: cx, y: PAGE.h - top - size, font: f, size, color: col });
        cx += safeWidth(f, w.text, size) + spaceW;
      }
      S.y += lineHeight;
      line = [];
      lineW = 0;
    };

    for (const w of words) {
      if (w.br) {
        drawLine();
        continue;
      }
      const f = fontFor(w.run);
      const ww = safeWidth(f, w.text, size);
      if (line.length > 0 && lineW + ww > width) drawLine();
      line.push(w);
      lineW += ww + spaceW;
    }
    if (line.length > 0) drawLine();
  }

  const gap = (h) => {
    S.y += h;
    if (S.y > PAGE.h - M.bottom) addPage();
  };

  // --- block renderers --------------------------------------------------------
  function heading(token, dest) {
    const depth = token.depth;
    const runs = inlineRuns(token.tokens);
    if (depth === 1) {
      addPage();
      if (dest) dest.push({ title: token.text, pageRef: S.page.ref, y: PAGE.h - M.top + 6 });
      flow(runs, { size: 23, lineHeight: 28, color: HEAD });
      gap(6);
      S.afterH1 = true;
      return;
    }
    if (depth === 3 && S.afterH1) {
      // the subtitle line right under a chapter title
      flow(runs, { size: 12.5, lineHeight: 17, color: MUTED });
      gap(8);
      S.afterH1 = false;
      return;
    }
    S.afterH1 = false;
    gap(depth === 2 ? 10 : 6);
    flow(
      runs,
      depth === 2
        ? { size: 15, lineHeight: 20, color: HEAD }
        : { size: 12.5, lineHeight: 17, color: HEAD },
    );
    gap(3);
  }

  function list(token) {
    let i = token.start || 1;
    for (const item of token.items) {
      const marker = token.ordered ? `${i}.` : "•";
      i++;
      const inline = item.tokens?.find((t) => t.type === "text")?.tokens ?? item.tokens ?? [];
      space(15.5);
      const top = S.y;
      safeDraw(S.page, marker, {
        x: M.left + 4,
        y: PAGE.h - top - 10.5,
        font: F.regular,
        size: 10.5,
        color: MUTED,
      });
      flow(inlineRuns(inline), { x: M.left + 22, width: CONTENT_W - 22 });
      gap(1.5);
    }
    gap(4);
  }

  function codeBlock(token) {
    const lines = String(token.text).split("\n");
    const size = 9;
    const lh = 12.5;
    const wrapped = [];
    const maxChars = Math.floor((CONTENT_W - 16) / F.mono.widthOfTextAtSize("M", size));
    for (const ln of lines) {
      if (ln.length <= maxChars) wrapped.push(ln);
      else for (let j = 0; j < ln.length; j += maxChars) wrapped.push(ln.slice(j, j + maxChars));
    }
    // Draw in per-page segments so a block taller than one page paginates cleanly
    // — each page segment gets its own background — instead of one background that
    // spills later lines onto the next page without one. A block that fits on a
    // page is kept whole (moved to a fresh page if the remaining space is short).
    const wholeHeight = wrapped.length * lh + 12;
    if (wholeHeight <= PAGE.h - M.top - M.bottom) space(wholeHeight);
    let i = 0;
    while (i < wrapped.length) {
      space(lh + 12);
      const segTop = S.y;
      const avail = PAGE.h - M.bottom - segTop - 10;
      const fit = Math.max(1, Math.min(wrapped.length - i, Math.floor(avail / lh)));
      S.page.drawRectangle({
        x: M.left,
        y: PAGE.h - segTop - (fit * lh + 10),
        width: CONTENT_W,
        height: fit * lh + 10,
        color: CODE_BG,
        borderColor: RULE,
        borderWidth: 0.5,
      });
      S.y += 6;
      for (let k = 0; k < fit; k++, i++) {
        safeDraw(S.page, pdfText(wrapped[i]), {
          x: M.left + 8,
          y: PAGE.h - S.y - size,
          font: F.mono,
          size,
          color: INK,
        });
        S.y += lh;
      }
      S.y += 4;
      if (i < wrapped.length) addPage();
    }
    gap(6);
  }

  function blockquote(token) {
    gap(2);
    for (const inner of token.tokens) {
      if (inner.type === "paragraph") {
        flow(inlineRuns(inner.tokens), {
          x: M.left + 12,
          width: CONTENT_W - 16,
          leftBar: ACCENT,
          bg: QUOTE_BG,
          color: rgb(0.3, 0.33, 0.4),
        });
      } else if (inner.type === "list") {
        list(inner);
      }
    }
    gap(8);
  }

  function drawDiagram(name) {
    const { width, height, nodes, edges } = diagramLayout(name);
    const scale = Math.min(CONTENT_W / width, 0.8);
    const dw = width * scale;
    const dh = height * scale;
    space(dh + 26);
    const ox = M.left + (CONTENT_W - dw) / 2;
    const oTop = S.y;
    const pX = (dx) => ox + dx * scale;
    const pYtop = (dy) => oTop + dy * scale; // from-top
    for (const e of edges) {
      S.page.drawLine({
        start: { x: pX(e.x1), y: PAGE.h - pYtop(e.y1) },
        end: { x: pX(e.x2), y: PAGE.h - pYtop(e.y2) },
        thickness: Math.max(1, 2.5 * scale),
        color: hexToRgb(e.color),
      });
    }
    for (const nd of nodes) {
      const rw = nd.w * scale;
      const rh = nd.h * scale;
      const bx = pX(nd.cx - nd.w / 2);
      const byTop = pYtop(nd.cy - nd.h / 2);
      S.page.drawRectangle({
        x: bx,
        y: PAGE.h - byTop - rh,
        width: rw,
        height: rh,
        color: nd.root ? ROOT_FILL : WHITE,
        borderColor: nd.root ? ROOT_FILL : hexToRgb(nd.color),
        borderWidth: Math.max(1, 2 * scale),
      });
      const fs = Math.max(8, 14 * scale);
      const f = nd.root ? F.bold : F.regular;
      const label = pdfText(nd.label);
      const tw = safeWidth(f, label, fs);
      safeDraw(S.page, label, {
        x: pX(nd.cx) - tw / 2,
        y: PAGE.h - pYtop(nd.cy) - fs * 0.35,
        font: f,
        size: fs,
        color: nd.root ? WHITE : INK,
      });
    }
    S.y = oTop + dh + 6;
    flow([{ text: diagramCaption(name), i: true }], { size: 8.5, lineHeight: 12, color: MUTED });
    gap(8);
  }

  function renderTokens(tokens, dest) {
    for (const token of tokens) {
      switch (token.type) {
        case "heading":
          heading(token, dest);
          break;
        case "paragraph":
          flow(inlineRuns(token.tokens));
          gap(7);
          break;
        case "list":
          list(token);
          break;
        case "code":
          codeBlock(token);
          break;
        case "blockquote":
          blockquote(token);
          break;
        case "hr":
          space(14);
          S.page.drawLine({
            start: { x: M.left, y: PAGE.h - S.y - 6 },
            end: { x: PAGE.w - M.right, y: PAGE.h - S.y - 6 },
            thickness: 0.75,
            color: RULE,
          });
          gap(14);
          break;
        case "html":
          if (/<!--\s*DIAGRAM:([\w-]+)\s*-->/.test(token.text)) {
            drawDiagram(token.text.match(/<!--\s*DIAGRAM:([\w-]+)\s*-->/)[1]);
          }
          break;
        case "space":
          gap(3);
          break;
        default:
          if (token.tokens) renderTokens(token.tokens, dest);
      }
    }
  }

  // --- cover ------------------------------------------------------------------
  const dateIso = new Date().toISOString().split("T")[0];
  const center = (page, str, font, size, color, yFromTop) => {
    const s = pdfText(str);
    const tw = safeWidth(font, s, size);
    safeDraw(page, s, { x: (PAGE.w - tw) / 2, y: PAGE.h - yFromTop - size, font, size, color });
  };
  const cover = addPage();
  center(cover, "A MINDMAP STUDIO GUIDE", F.bold, 11, ACCENT, 250);
  center(cover, BOOK_TITLE, F.bold, 42, HEAD, 300);
  {
    // subtitle, wrapped + centred
    const words = pdfText(BOOK_SUBTITLE).split(/\s+/);
    const size = 13;
    let ln = "";
    let yft = 372;
    const flush = () => {
      if (ln) {
        center(cover, ln, F.italic, size, rgb(0.29, 0.34, 0.41), yft);
        yft += 19;
      }
    };
    for (const w of words) {
      const test = ln ? `${ln} ${w}` : w;
      if (safeWidth(F.italic, test, size) > 360) {
        flush();
        ln = w;
      } else ln = test;
    }
    flush();
  }
  center(cover, BOOK_AUTHOR, F.regular, 12, INK, 470);
  center(cover, `Generated ${dateIso}`, F.regular, 9, MUTED, 496);
  center(cover, BOOK_PUBLISHER, F.regular, 9, MUTED, 510);

  // --- reserve the TOC page (filled after chapters, once page refs are known) -
  const tocPage = addPage();

  // --- chapters ---------------------------------------------------------------
  const dest = [];
  for (const c of chapters) {
    const tokens = marked.lexer(c.raw);
    renderTokens(tokens, dest);
  }

  // --- table of contents (clickable) ------------------------------------------
  S.page = tocPage;
  S.y = M.top;
  flow([{ text: "Contents", b: true }], { size: 22, lineHeight: 28, color: HEAD });
  gap(10);
  const linkAnnots = [];
  for (const d of dest) {
    space(19);
    const top = S.y;
    const label = pdfText(d.title);
    safeDraw(tocPage, label, {
      x: M.left + 4,
      y: PAGE.h - top - 11,
      font: F.regular,
      size: 11.5,
      color: INK,
    });
    // clickable rect over the whole line
    const ctx = pdf.context;
    const action = ctx.obj({
      S: PDFName.of("GoTo"),
      D: ctx.obj([d.pageRef, PDFName.of("XYZ"), null, d.y, null]),
    });
    const annot = ctx.obj({
      Type: PDFName.of("Annot"),
      Subtype: PDFName.of("Link"),
      Rect: ctx.obj([M.left, PAGE.h - top - 16, PAGE.w - M.right, PAGE.h - top]),
      Border: ctx.obj([0, 0, 0]),
      A: action,
    });
    linkAnnots.push(ctx.register(annot));
    S.y += 19;
  }
  tocPage.node.set(PDFName.of("Annots"), pdf.context.obj(linkAnnots));

  // --- chapter bookmarks (PDF outline) ----------------------------------------
  if (dest.length > 0) {
    const ctx = pdf.context;
    const outlineRef = ctx.nextRef();
    const itemRefs = dest.map(() => ctx.nextRef());
    dest.forEach((d, i) => {
      const fields = {
        Title: PDFString.of(pdfText(d.title)),
        Parent: outlineRef,
        Dest: ctx.obj([d.pageRef, PDFName.of("XYZ"), null, d.y, null]),
      };
      if (i > 0) fields.Prev = itemRefs[i - 1];
      if (i < dest.length - 1) fields.Next = itemRefs[i + 1];
      ctx.assign(itemRefs[i], ctx.obj(fields));
    });
    ctx.assign(
      outlineRef,
      ctx.obj({
        Type: PDFName.of("Outlines"),
        First: itemRefs[0],
        Last: itemRefs.at(-1),
        Count: dest.length,
      }),
    );
    pdf.catalog.set(PDFName.of("Outlines"), outlineRef);
  }

  // --- metadata ---------------------------------------------------------------
  pdf.setTitle(BOOK_TITLE);
  pdf.setAuthor(BOOK_AUTHOR);
  pdf.setSubject(BOOK_SUBTITLE);
  pdf.setProducer("MindMap Studio book builder (pdf-lib)");
  pdf.setCreator(BOOK_PUBLISHER);
  pdf.setKeywords([BOOK_ID]);
  // Pin dates to date-only (midnight UTC) so two builds on the same day are
  // byte-identical — the Rebuild-book workflow then only commits on real changes.
  const stamp = new Date(`${dateIso}T00:00:00Z`);
  pdf.setCreationDate(stamp);
  pdf.setModificationDate(stamp);

  return pdf.save();
}

async function main() {
  console.log(`📕 Building ${BOOK_SLUG}.pdf …`);
  const bytes = await buildPdf();
  await writeFile(OUT_PATH, bytes);
  console.log(`✓ Wrote ${OUT_PATH} (${(bytes.length / 1024).toFixed(1)} KB)`);
}

// Run only when executed directly (node scripts/build-book-pdf.mjs), not on import.
if (process.argv[1]?.endsWith("build-book-pdf.mjs")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
