# Authoring notes — *Thinking in Maps*

How the book is structured, built, and kept in sync with the app. For whoever
(Claude, a contributor, future-Dann) sits down to edit a chapter.

## Layout

```
docs/guide/
├── README.md                 ← table of contents (public face)
├── AUTHORING.md              ← this file (maintainer face)
├── 00-foreword.md
├── 01-…  through  07-…       ← chapter files, one per chapter
└── appendix-a-…  through  appendix-c-…
```

Each chapter is a self-contained Markdown file. Cross-references use relative links
(`[Chapter 6](06-sharing-and-exporting.md)`). The build outputs —
`Thinking-in-Maps.epub` / `.pdf` — are written to **`public/`** (not here), so they
deploy with the site and are downloadable from the live URL.

## The single source of truth

`scripts/lib/bookChapters.mjs` is the manifest both builders share:

- `CHAPTER_FILES` — the canonical chapter order (hand-listed, so a rename can't
  silently reshuffle the book). **Add a chapter:** append its filename here and give
  the file an H1.
- Book identity — `BOOK_TITLE`, `BOOK_AUTHOR`, and a **stable `BOOK_ID`**. Don't
  regenerate the id: e-readers cache by it, so a new id forces readers to re-add the
  book as a new title.
- `TOC_GROUPS` — the part-headers, matched on filename prefix.

`readChapterMetadata` reads each file's H1 (title) + optional H3 (subtitle), so the
table of contents always reflects the actual headings.

## Diagrams from source constants

Diagrams are **generated, never hand-drawn**, so they can't drift from what the app
produces. A diagram is a small data model in `scripts/lib/bookDiagrams.mjs`; one layout
function turns it into boxes + connectors, and two renderers consume that layout:

- `diagramSvg(name)` → inline SVG for the HTML/EPUB build.
- `diagramLayout(name)` → the geometry the PDF builder draws natively with pdf-lib
  (pdf-lib can't embed SVG, so it draws the same model).

Embed one in a chapter with a placeholder comment: `<!-- DIAGRAM:first-map -->`. Each
builder replaces it. **Add a diagram:** add a model to `DIAGRAMS`.

## Building

```bash
pnpm book        # builds both EPUB and PDF
pnpm book:epub   # EPUB only  (pure Node: jszip + marked)
pnpm book:pdf    # PDF only   (pure Node: pdf-lib + marked)
```

Both are pure-Node — no Chromium, no LaTeX, no system tools. The EPUB is the
Kindle-friendly reflowable form; the PDF is fixed A4 with a cover, a clickable table
of contents, and chapter bookmarks.

## Staying in sync via CI

The **Rebuild book artifacts** workflow (`.github/workflows/rebuild-book.yml`) runs
when anything under `docs/guide/*.md` or the book scripts changes. It rebuilds both
formats, commits the refreshed `public/*.epub|pdf` back to `main` (guarded against
recursion by an actor check — the bot's own pushes don't re-trigger it), and can email
the EPUB to a Kindle on request.

**Send to Kindle:** tick the `send_to_kindle` input on a manual run, or include
`[kindle]` in a commit message that touches the book. Needs the `KINDLE_TO` + `SMTP_*`
repo secrets; it's a silent no-op until those are set.

## Voice

- **Technique first, tool second.** Each chapter teaches a way of thinking; MindMap
  Studio is how you do it, not the subject.
- **Present tense, second person.** "You press Tab", "your canvas looks like".
- **Restraint.** The recurring lesson is that the plainest map that carries the meaning
  wins. The prose should model it.
- **Plain Markdown**, WinAnsi-safe punctuation (the PDF uses standard fonts): write
  `--` and `->`, not exotic glyphs or emoji.
