import { type Catalogue, registerMessages } from "../i18n/registry";

// English messages for IMPORT/EXPORT — the failures an adapter reports, and the chrome baked into the
// artifacts we generate.
//
// Chunk-local, and its own catalogue rather than part of `i18n/core.ts`, because every format adapter
// under `io/` is reached through a dynamic `import()`. Putting ~60 keys in the eager catalogue would
// move them onto the initial-load path that `scripts/size-budget.mjs` caps — which had 0.9 kB of
// headroom when this was written.
//
// Imports `registerMessages` from `../i18n/registry`, NOT the `../i18n` barrel: the barrel pulls in the
// eager core catalogue, which would defeat the arrangement.
//
// TWO KINDS OF STRING LIVE HERE, and the distinction matters:
//
//  1. IMPORT FAILURES. These are not internal diagnostics — `App.tsx` renders `err.message` verbatim
//     into the error banner, so every one of them is user-facing copy. They name the file type the
//     user chose, which is why they stay specific ("Not a valid .mup file") rather than collapsing
//     into one generic message.
//  2. EXPORTED CHROME. `interactiveHtml` and `deck` build standalone HTML the user opens later, or
//     sends to someone else. Its buttons are as much product as anything on the canvas, so a Danish
//     user's export should say "Skjul alle", not "Collapse all".
//
// Format names, file extensions, XML element names and internal paths inside these messages are
// TOKENS, not words — `.mmap`, `<Topic>`, `word/document.xml` mean the same in every locale and must
// survive translation unchanged.
export const IO_EN = {
  // Per-format "what didn't come across" notes. Loaded on demand by importDispatch's lossyNote(),
  // which is why they live here and not in the eager catalogue: importDispatch is reached from the
  // eager graph, so a static import of this file would put all of it in the entry chunk.
  "io.warn.fromMarkdown":
    "Imported from Markdown — visual styling and layout aren’t part of the format.",
  "io.warn.fromMermaid": "Imported from Mermaid — only the diagram structure is converted.",
  "io.warn.fromOpml":
    "Imported from OPML — an outline format; styling, markers and images aren’t included.",
  "io.warn.fromFreemind":
    "Imported from FreeMind/Freeplane — some styling and icons may not map exactly.",
  "io.warn.fromXmind":
    "Imported from XMind — styling, relationships and some markers may not be fully preserved.",
  "io.warn.fromSimpleMind":
    "Imported from SimpleMind — styling and some elements may not be fully preserved.",
  "io.warn.fromWord":
    "Imported from Word — headings and lists become topics; document formatting isn’t preserved.",
  "io.warn.fromExcel": "Imported from Excel — rows become topics; cell formatting isn’t preserved.",
  "io.warn.fromIthoughts":
    "Imported from iThoughts — styling and some elements may not be fully preserved.",
  "io.warn.fromMindmeister":
    "Imported from MindMeister — styling and some elements may not be fully preserved.",
  "io.warn.fromMindmup":
    "Imported from MindMup — styling and some elements may not be fully preserved.",
  "io.warn.fromTextBundle":
    "Imported from TextBundle — a Markdown outline; visual styling isn’t part of the format.",
  // --- import failures -----------------------------------------------------------------------
  "io.err.notFreeMind": "Not a FreeMind/Freeplane .mm file",
  "io.err.notOpml": "Not an OPML file",
  "io.err.notZip": "Not a valid {ext} file (could not unzip)",
  "io.err.noTextBundle": "No text.md found in the TextBundle (.textpack)",

  "io.err.docxNoDocument": "No word/document.xml found in .docx",
  "io.err.docxNoParagraphs": "No paragraphs found in .docx",

  "io.err.xlsxNoRows": "No rows found in .xlsx",
  "io.err.xlsxNoSheet": "No xl/worksheets/sheet1.xml found in .xlsx",

  "io.err.xmindNoRootElement": "XMind content.xml: missing <xmap-content> root element",
  "io.err.xmindNoSheet": "XMind content.xml: no <sheet> found",
  "io.err.xmindSheetNoTopic": "XMind content.xml: sheet has no root <topic>",
  "io.err.xmindNoRootTopic": "XMind file has no root topic",
  "io.err.xmindUnsupported": "Unsupported .xmind: no content.json or content.xml found",

  "io.err.itmzNoMapdata": "Not a valid .itmz file (no mapdata.xml)",
  "io.err.itmzNoTopicsElement": "Not a valid .itmz file (mapdata.xml has no <topics> element)",
  "io.err.itmzNoTopics": "Not a valid .itmz file (no topics found)",

  "io.err.mindNoMapJson": "Not a valid .mind file (no map.json)",
  "io.err.mindBadJson": "Not a valid .mind file (map.json is not valid JSON)",
  "io.err.mindNoRoot": "Not a valid .mind file (no root node found in map.json)",

  "io.err.mupBadJson": "Not a valid .mup file (not valid JSON)",
  "io.err.mupMissingFields":
    "Not a valid .mup file (missing title, ideas, and formatVersion fields)",

  "io.err.smmxNoTopics": "SimpleMind file has no topics",

  "io.err.mmapNoDocument":
    "Not a MindManager .mmap: Document.xml not found. Archive entries: {entries}",
  "io.err.mmapNoMapRoot": "Unexpected .mmap: no <Map> root element in Document.xml.",
  "io.err.mmapNoRootTopic": "Unexpected .mmap: no root <Topic> under <Map>/<OneTopic>.",

  // --- import warnings (shown as a toast, not thrown) ------------------------------------------
  "io.warn.mmapImageSkipped": "An embedded image was skipped (unsupported format or missing data).",
  "io.warn.mmapFloatingTopics": {
    one: '{n} floating topic imported — shown in a separate, editable "Floating topics" branch.',
    other: '{n} floating topics imported — shown in a separate, editable "Floating topics" branch.',
  },

  // --- default titles for an import that carries none ------------------------------------------
  "io.title.importedOutline": "Imported outline",
  "io.title.importedSimpleMind": "Imported SimpleMind map",

  // --- the OS file picker's own filter descriptions ---------------------------------------------

  // --- chrome compiled INTO an export -----------------------------------------------------------
  // The interactive HTML export is a standalone file the user opens later or sends on; its controls
  // are product, not scaffolding.
  "io.html.toggleChildren": "Toggle children",
  "io.html.modeToggleTitle": "Switch between the visual map and the text outline",
  "io.html.outlineView": "Outline view",
  "io.html.filterTopics": "Filter topics",
  "io.html.filterTopicsPlaceholder": "Filter topics…",
  "io.html.expandAll": "Expand all",
  "io.html.collapseAll": "Collapse all",
  "io.html.resetView": "Reset view",
  "io.html.resetPanZoom": "Reset pan / zoom",

  // The export footer, as two whole sentences rather than a fragment conditionally spliced in — a
  // translator needs the complete line to word it naturally.
  "io.html.footerWithVisual":
    "Interactive map — Visual map + collapsible outline · filter to search · Ctrl/⌘ + scroll to zoom, drag to pan · self-contained, offline",
  "io.html.footerOutlineOnly":
    "Interactive map — collapsible outline · filter to search · Ctrl/⌘ + scroll to zoom, drag to pan · self-contained, offline",

  "io.deck.slides": "Slides",
  "io.deck.toggleNotes": "Toggle speaker notes (N)",
} as const satisfies Catalogue;

export type IoKey = keyof typeof IO_EN;

registerMessages("en", IO_EN);
