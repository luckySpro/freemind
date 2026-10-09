import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type Violation,
  argumentViolations,
  jsxTextViolations,
  loneJsxTextViolations,
  placeholderViolations,
  propViolations,
  proseViolations,
  scanSource,
  templateViolations,
  tupleLabelViolations,
} from "../scripts/lib/i18nDetectors.mjs";

// The guard that stops the localisation work rotting.
//
// Once a file is migrated, nothing prevents the next person adding a button with a hardcoded label —
// and the failure is silent: the UI looks right in English and simply never translates. tsc can't see
// it (a plain string is valid), and no behavioural test notices, because English IS the fallback.
//
// So this scans the files that have been migrated and fails on user-facing string literals. It is
// deliberately an ALLOWLIST rather than a whole-tree scan: a file joins the list when it's migrated, so
// the guard grows with the work instead of blocking every file that hasn't been touched yet.
//
// It checks seven shapes, chosen because they're where user-facing text actually lives and because they
// can be detected without false positives on CSS values, class names and DOM plumbing:
//   1. a literal in a user-facing prop  — title="Save" rather than title={t("…")}
//   2. prose in a positional argument   — add("open-file", "Open file…", …), or a tuple member
//   3. prose in a template literal      — title={`Delete view ${v.name}`}
//   4. a user-facing placeholder        — "(untitled)"
//   5. a label in a label/action tuple  — ["Copy image to clipboard", () => io.copyPng()]
//   6. JSX text between its tags        — <MenuLabel>Arrowheads</MenuLabel>
//   7. a line of bare prose             — the multi-line paragraphs inside <p>…</p>
//
// Each detector past the first exists because the ones before it were demonstrably blind. (2) was added
// after putting `editorCommands.ts` on the list made it PASS with ~50 labels still hardcoded — an
// unnamed argument is neither a prop nor a bare prose line. (3) and (4) were added the same way: with
// four files on the list and a green tick, an interpolated `` `Inserted the ${p.name} map part.` `` and
// a bare `"(untitled)"` were still shipping untranslated, 12 strings in all. A green tick that claims
// coverage it doesn't have is worse than no tick, so when this list grows, re-verify the files already
// on it rather than assuming the tick covered them.
//
// Remaining limitation, stated so nobody assumes otherwise: (2) needs a capitalised MULTI-WORD literal,
// so a single-word label — `add("present", "Present", …)` — still slips through. Widening it to single
// words would collide with ids, `kind` values and technical tokens, and a noisy guard gets switched off.
// (5) and (6) are what make single words safe in the two places they CAN be told apart: between JSX
// tags, where `>Type</` is unambiguously rendered content, and as the first member of a tuple whose
// second member is a function, where the shape itself proves the string is a label.
//
// When this fires, the fix is to move the string into a catalogue — not to add the file to an ignore
// list. If a genuinely non-user-facing string trips it, narrow the check rather than widening the
// exceptions.
//
// The detectors themselves live in `scripts/lib/i18nDetectors.mjs`, shared with
// `scripts/i18n-scan.mjs` — which runs them over ANY file, so the next migration can see its worklist
// without joining this allowlist and going red. This file owns the allowlist and the self-test; that
// file owns the rules. They were briefly two copies, and the copy silently lost a `\s` and reported
// zero `label=` hits on a file that had sixty.

/** Files whose user-facing strings have been moved into a catalogue. Add a file when you migrate it. */
const MIGRATED = [
  "src/components/SettingsDialog.tsx",
  "src/mindmap/flow/TopicNode.tsx",
  "src/shortcuts.ts",
  "src/components/editorCommands.ts",
  "src/components/Toolbar.tsx",
  "src/mindmap/FlowMindMap.tsx",
  "src/App.tsx",
  "src/Panels.tsx",
  "src/mindmap/flow/BulkNodeMenu.tsx",
  "src/mindmap/flow/ShapeLayer.tsx",
  "src/mindmap/flow/NodePopover.tsx",
  "src/mindmap/flow/CrosslinkEdge.tsx",
  "src/mindmap/flow/slashCommands.ts",
  "src/components/start/AppTips.tsx",
  "src/components/start/CommandPalette.tsx",
  "src/components/start/MapCard.tsx",
  "src/components/start/MapDialogs.tsx",
  "src/components/start/MiniMap.tsx",
  "src/components/start/StartHeader.tsx",
  "src/components/start/StartHome.tsx",
  "src/components/start/StartScreen.tsx",
  "src/components/start/StartSidebar.tsx",
  "src/components/start/TemplateCard.tsx",
  "src/components/start/docBuilders.ts",
  "src/components/start/mapActions.ts",
  "src/components/start/nodeStats.ts",
  "src/components/start/sections/AllMaps.tsx",
  "src/components/start/sections/EmptyMaps.tsx",
  "src/components/start/sections/Examples.tsx",
  "src/components/start/sections/ImportView.tsx",
  "src/components/start/sections/Layouts.tsx",
  "src/components/start/sections/Learn.tsx",
  "src/components/start/sections/Recent.tsx",
  "src/components/start/sections/Templates.tsx",
  "src/components/start/sections/Trash.tsx",
  "src/components/ThemeDesignerDialog.tsx",
  "src/present/Presentation.tsx",
  "src/components/MapPanel.tsx",
  "src/components/EdgeInspector.tsx",
  "src/components/FindReplaceOverlay.tsx",
  "src/components/OverlayInspector.tsx",
  "src/components/IconRail.tsx",
  "src/components/BranchExportDialog.tsx",
  "src/mindmap/theme.ts",
  "src/panelLabels.ts",
  "src/stickers.ts",
  "src/hooks/useVersionHistory.ts",
  "src/hooks/useDiskFile.ts",
  "src/Kanban.tsx",
  "src/components/CommandPalette.tsx",
  "src/hooks/usePasteOutline.ts",
  "src/hooks/useClipboardImagePaste.ts",
  "src/hooks/useFormatPainter.ts",
  "src/useMapExports.ts",
  "src/store/settingsFile.ts",
  "src/mapParts.ts",
  "src/components/start/tokens.ts",
  "src/components/start/types.ts",
  "src/components/start/useLibrary.ts",
  // Markup-in-prose, unblocked by `tNodes` (src/i18n/nodes.tsx) — one message per sentence, with the
  // <kbd>/<strong> parts as placeholders a translator can move. Their guard is NOT this scan: no
  // detector matches a sentence a JSX element has cut in half, so all three reported zero while the
  // prose was still hardcoded. test/i18n-pseudo-render.test.tsx renders them and is what actually
  // holds them.
  "src/mindmap/flow/CanvasOverlays.tsx",
  "src/components/FirstRunCard.tsx",
  "src/components/start/CaptureCard.tsx",
  // Import/export adapters. Their strings live in src/io/messages.ts — its own catalogue because every
  // adapter is behind a dynamic import(), and ~60 keys in the eager one would have blown the entry
  // budget. src/io/messages.ts itself is NOT here: a catalogue quotes its own English by definition,
  // and src/io/pdf.ts keeps one brand string in PDF metadata.
  "src/io/attachment.ts",
  "src/io/deck.ts",
  "src/io/docx.ts",
  "src/io/download.ts",
  "src/io/fileName.ts",
  "src/io/fileSystem.ts",
  "src/io/freemind.ts",
  "src/io/html.ts",
  "src/io/htmlEscape.ts",
  "src/io/image.ts",
  "src/io/importDispatch.ts",
  "src/io/interactiveHtml.ts",
  "src/io/ithoughts.ts",
  "src/io/json.ts",
  "src/io/library.ts",
  "src/io/markdown.ts",
  "src/io/markmap.ts",
  "src/io/mermaid.ts",
  "src/io/mindmeister.ts",
  "src/io/mindmup.ts",
  "src/io/mmap.ts",
  "src/io/notesAppendix.ts",
  "src/io/ooxml.ts",
  "src/io/opml.ts",
  "src/io/pasteOutline.ts",
  "src/io/pasteTable.ts",
  "src/io/pptx.ts",
  "src/io/richText.ts",
  "src/io/searchHistory.ts",
  "src/io/smmx.ts",
  "src/io/svgSanitize.ts",
  "src/io/tableExport.ts",
  "src/io/textbundle.ts",
  "src/io/urlSafety.ts",
  "src/io/xlsx.ts",
  "src/io/xmind.ts",
  "src/io/xml.ts",
  "src/io/zip.ts",
  "src/import/mmap.ts",
];

const scan = (rel: string): Violation[] =>
  scanSource(readFileSync(join(process.cwd(), rel), "utf8"));

const report = (rel: string, v: Violation[]) => {
  const lines = v.map((x) => `  ${rel}:${x.line}  ${x.why}\n    ${x.text}`).join("\n");
  return `${rel} has ${v.length} hardcoded user-facing string(s) — move them into a catalogue:\n${lines}`;
};

describe("migrated files carry no hardcoded user-facing strings", () => {
  for (const rel of MIGRATED) {
    it(rel, () => {
      const violations = scan(rel);
      expect(violations, report(rel, violations)).toEqual([]);
    });
  }

  it("actually detects all seven shapes it claims to", () => {
    // A guard that can't fail is worse than none — pin that each detector fires on its own shape.
    expect(propViolations('        title="Save the map"')).toHaveLength(1);
    expect(propViolations('        title={t("map.save")}')).toHaveLength(0);
    expect(propViolations('        <MenuItem label="Fit map to screen" />')).toHaveLength(1);
    expect(propViolations('        <optgroup label="Templates">')).toHaveLength(1);
    // (2) the positional-argument shape, and the things it must not mistake for prose.
    expect(
      argumentViolations('  add("open-file", "Open file…", "map", () => io.openFile());'),
    ).toHaveLength(1);
    expect(
      argumentViolations('  add("open-file", t("cmd.open-file"), "map", () => io.openFile());'),
    ).toHaveLength(0);
    expect(argumentViolations('  ["json", ".json (lossless)", io.exportJson],')).toHaveLength(0); // lowercase start
    expect(argumentViolations('  ["json", "JSON (lossless)", io.exportJson],')).toHaveLength(1);
    // An object property is NOT an argument: shortcuts.ts keeps key names literal on purpose.
    expect(argumentViolations('      { keys: "Ctrl/⌘ + Z", action: t("x") },')).toHaveLength(0);
    // A doc comment quoting UI text must NOT be flagged — the Toolbar migration rewrote exactly this
    // shape once, turning commentary into a t() call mid-sentence.
    expect(
      argumentViolations('  /** Copy the branch into a new library map ("New map from topic"). */'),
    ).toHaveLength(0);
    // An argument wrapped onto its own line, and a ternary's two branches.
    expect(argumentViolations('    "Priority: clear on selected topic",')).toHaveLength(1);
    expect(argumentViolations('    t("cmd.node-priority-clear"),')).toHaveLength(0);
    expect(
      argumentViolations('    sel ? "Copy link to this topic" : "Copy link to this map",'),
    ).toHaveLength(2);
    // …including the arms prettier wraps onto their own lines, where only the `?` half used to be seen.
    expect(argumentViolations('                  ? "Couldn\'t save"')).toHaveLength(1);
    expect(argumentViolations('                  : "Saved locally"}')).toHaveLength(1);
    // A template in the `then` arm must not hide a hardcoded `else` arm.
    expect(
      argumentViolations(
        '  showHint(ok ? `Inserted the ${p.name} map part.` : "Select a topic first.");',
      ),
    ).toHaveLength(1);
    // …but a plain object property with a prose value stays exempt, as before — no space before its
    // colon, and no `?` on the line either.
    expect(argumentViolations('      { keys: "Ctrl/⌘ + Z" },')).toHaveLength(0);
    expect(
      argumentViolations('      { keys: cond ? a : b, action: "Undo The Thing" },'),
    ).toHaveLength(0);
    expect(argumentViolations('  const label = "Saved locally";')).toHaveLength(0);
    // Documented limitation: a single-word label isn't caught.
    expect(argumentViolations('  add("present", "Present", "map", run);')).toHaveLength(0);
    // (3) template literals — prose survives the `${…}` holes; machine values don't look like prose.
    expect(templateViolations("  title={`Delete view ${v.name}`}")).toHaveLength(1);
    expect(templateViolations("  showHint(`Inserted the ${p.name} map part.`)")).toHaveLength(1);
    expect(templateViolations('  title={t("view.delete", { name: v.name })}')).toHaveLength(0);
    // MARKUP is stripped before the prose rule runs — the exporters build OOXML and SVG by
    // concatenation, and a tag or attribute name reads exactly like "capitalised word, lowercase word".
    expect(templateViolations('  `<a:p><a:r><a:rPr lang="en"/></a:r></a:p>`')).toHaveLength(0);
    expect(
      templateViolations('  `<Relationships xmlns="http://x"><Sld name="Blank"/>`'),
    ).toHaveLength(0);
    // …but prose BETWEEN tags must still fire. Stripping the tags must not strip the file.
    expect(
      templateViolations('  `<div class="warn">Could not render ${n} topics</div>`'),
    ).toHaveLength(1);
    // Machine-facing templates that must NOT trip it — all real shapes from the canvas and exporters.
    expect(templateViolations("  transform: `translate(${x}px, ${y}px) scale(${s})`")).toHaveLength(
      0,
    );
    expect(templateViolations("  const d = `M ${x} ${y} L ${a} ${b}`")).toHaveLength(0);
    expect(templateViolations("  const src = `data:image/png;base64,${b64}`")).toHaveLength(0);
    expect(
      templateViolations("  className={`node ${selected ? 'is-selected' : ''}`}"),
    ).toHaveLength(0);
    // (4) the placeholder, and the things shaped like it that aren't prose.
    expect(placeholderViolations('  {mm.title || "(untitled)"}')).toHaveLength(1);
    expect(placeholderViolations('  {mm.title || t("common.untitled")}')).toHaveLength(0);
    expect(placeholderViolations('  const re = /"(a|b)"/')).toHaveLength(0);
    // (5) a label/action tuple — the shape proves it's a label, so no capitalisation rule is needed.
    expect(tupleLabelViolations('  ["Copy image to clipboard", () => io.copyPng()],')).toHaveLength(
      1,
    );
    expect(tupleLabelViolations('  [".svg (vector)", io.exportSvg],')).toHaveLength(1);
    expect(tupleLabelViolations('  ["Rename", () => startEdit(id)],')).toHaveLength(1);
    expect(tupleLabelViolations('  [t("cmd.export.svg"), io.exportSvg],')).toHaveLength(0);
    // A plain data array of strings holds ids, not labels — it must NOT fire.
    expect(
      tupleLabelViolations('  (["relates-to", "depends-on", "causes"] as const).map((kind) => ('),
    ).toHaveLength(0);
    // (6) JSX text between its tags — the one place a SINGLE word is safe to flag.
    expect(jsxTextViolations("        <MenuLabel>Arrowheads</MenuLabel>")).toHaveLength(1);
    expect(jsxTextViolations('        <option value="left">Left side</option>')).toHaveLength(1);
    expect(jsxTextViolations('        <option value="org-down">Org chart ↓</option>')).toHaveLength(
      1,
    );
    // Interpolated content is already migrated — it must not fire.
    expect(
      jsxTextViolations('        <MenuLabel>{t("canvas.menu.type")}</MenuLabel>'),
    ).toHaveLength(0);
    expect(jsxTextViolations("        <span>{count} selected</span>")).toHaveLength(0);
    // A lone glyph or initial is not a label.
    expect(jsxTextViolations("        <kbd>K</kbd>")).toHaveLength(0);
    // (6a) A LEADING GLYPH does not stop it being a label. The rule required `[A-Z]` immediately
    // after the `>`, so the app's emoji-prefixed panel headings were invisible to it — ~15 strings
    // hiding inside files the allowlist had already certified clean, which is the failure this whole
    // guard exists to prevent.
    expect(jsxTextViolations("        <div>🔗 Relationships</div>")).toHaveLength(1);
    expect(jsxTextViolations("        <strong>▦ Board</strong>")).toHaveLength(1);
    expect(jsxTextViolations("        <Button>＋ New</Button>")).toHaveLength(1);
    // The migrated form of exactly that shape — glyph inline, words from the catalogue — must NOT fire.
    expect(jsxTextViolations('        <div>🔗 {t("app.relationships")}</div>')).toHaveLength(0);
    // (6b) PARENTHESES are punctuation in UI copy. Excluding them cost `Presenter view (P)`,
    // `Exit (Esc)` and `Read (PDF)`. Safe here because the rule is anchored on the tags.
    expect(
      loneJsxTextViolations("            >\n              Exit (Esc)\n            </button>"),
    ).toHaveLength(1);
    // (6b′) A LEADING GLYPH does not stop it being a label here either — same fix as (6a), applied to
    // the MULTI-LINE wrapped-tag shape. This one required its first character to come from a fixed set
    // (`[A-Z＋✕←→‹›▦☰⏸▶↺−+]`), so a new glyph the house style reached for — ⤢, ☑ — was invisible even
    // though the identical text on ONE line was already caught by (6a).
    expect(
      loneJsxTextViolations(
        "                    >\n                      ⤢ Open in dock\n                    </button>",
      ),
    ).toHaveLength(1);
    expect(
      loneJsxTextViolations("            >\n              ☑ List\n            </Button>"),
    ).toHaveLength(1);
    // A bare glyph alone is still not a label.
    expect(
      loneJsxTextViolations("            >\n              ✕\n            </button>"),
    ).toHaveLength(0);
    // (6c) A user-facing prop must not be a TEMPLATE either. `templateViolations` cannot catch these:
    // it needs a capitalised word followed by a lowercase one, which `Apply "${s.name}"` never is once
    // the interpolation is blanked. Anchoring on the prop name is what makes a single word enough.
    expect(propViolations("        title={`Open ${name}`}")).toHaveLength(1);
    expect(propViolations("        aria-label={`${ariaLabel}: pick from calendar`}")).toHaveLength(
      1,
    );
    // ...but a MACHINE-TOKEN cheatsheet is not prose. The search tooltip lists query syntax the user
    // types; translating it would break the feature, and the sentence above it is already a message.
    expect(
      propViolations(
        '        title={`${t("search.operatorsHelp")}\\ntag:foo  marker:flag-red  priority:1`}',
      ),
    ).toHaveLength(0);
    // Pure data interpolation is not a label.
    expect(propViolations("        title={`${n}%`}")).toHaveLength(0);
    // Lowercase content is a technical token, not a label.
    expect(jsxTextViolations("        <code>npm run dev</code>")).toHaveLength(0);
    expect(
      proseViolations("          Preferences live in this browser and stop there"),
    ).toHaveLength(1);
    expect(proseViolations('          {t("settings.prefsFile.body")}')).toHaveLength(0);
    // Things that must NOT trip it — every one of these was a real false positive on the first run.
    expect(proseViolations("  const settingsFileRef = useRef(null)")).toHaveLength(0);
    expect(
      proseViolations("  // Read the local storage estimate when the dialog opens"),
    ).toHaveLength(0);
    expect(propViolations('  <div aria-hidden="true" />')).toHaveLength(0);
    expect(proseViolations("      void navigator.storage")).toHaveLength(0);
    expect(proseViolations("          background: style?.fillImage")).toHaveLength(0);
    expect(proseViolations("            style?.background ??")).toHaveLength(0);
    expect(proseViolations("        boxShadow: dropTarget")).toHaveLength(0);
    // A control-flow keyword plus ONE identifier is a wrapped statement, not a sentence. Seven of
    // these exist in src and none is prose.
    expect(proseViolations("      return parsed")).toHaveLength(0);
    expect(proseViolations("      return folderName")).toHaveLength(0);
    expect(proseViolations("      throw err")).toHaveLength(0);
    // Anchored to end-of-line, so real copy opening with the same word keeps firing.
    expect(proseViolations("      Return to the map to continue")).toHaveLength(1);
    // Short prose is allowed through only when it's sentence-cased. `Map side` is a real label in the
    // branch menu and only 8 characters; the length floor alone was hiding it. JS keywords are
    // lowercase, which is what keeps the short code lines out.
    expect(proseViolations("                        Map side")).toHaveLength(1);
    expect(proseViolations("      return null")).toHaveLength(0);
    expect(proseViolations("      const x")).toHaveLength(0);
    expect(proseViolations("      break")).toHaveLength(0);
  });

  it("does not mistake a multi-line block comment's continuation lines for prose", () => {
    // The one false positive this guard produced in anger: a JSX block comment whose opener is on the
    // first line, so the CONTINUATION lines start with prose rather than a star and looked like copy.
    const jsxComment = [
      "        {/* Move project item 14 shifts every task date in this branch by a preset,",
      "            preserving relative offsets. Shown only when the branch actually has dated",
      "            tasks, so this stays honest */}",
      "        Branch layout follows",
    ].join("\n");
    const hits = proseViolations(jsxComment);
    // Only the real JSX copy on the last line survives — all three comment lines are skipped.
    expect(hits.map((h) => h.line)).toEqual([4]);

    // An opener INSIDE a string must not start a phantom block that swallows everything after it.
    const notAComment = [
      '        const glob = "src/**/*.tsx";',
      "        Real copy lives here",
    ].join("\n");
    expect(proseViolations(notAComment)).toHaveLength(1);
  });
});
