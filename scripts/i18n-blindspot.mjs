// The FLOOR under `i18n-scan.mjs` — what the line-based detectors cannot see.
//
// WHY THIS EXISTS SEPARATELY. `scripts/i18n-scan.mjs` and the allowlist guard share one set of
// detectors, and those detectors are regex-over-lines by design: they have to be, because they run on
// any file without a parse step, and they are tuned for zero false positives so nobody switches them
// off. The cost is that "0 hardcoded strings" means "0 that these rules can see", and the gap between
// those two has been the single most repeated failure in this migration — a green tick certifying a
// file that still shipped English.
//
// So this walks the real TypeScript AST instead, reports every JSX text node and every user-facing
// prop, and subtracts what the detectors already report. What comes out is the blind spot, measured.
// It is deliberately NOISY — it has no false-positive budget, because it is a worklist for a human,
// not a gate. Nothing fails on its output.
//
//   node scripts/i18n-blindspot.mjs            # allowlisted files only (the dangerous ones)
//   node scripts/i18n-blindspot.mjs --all      # every .tsx under src/
//
// The allowlisted default is the point: an unmigrated file being full of English is expected, whereas
// an ALLOWLISTED file being full of English is a lie the gate is currently telling.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { scanSource } from "./lib/i18nDetectors.mjs";

const ALL = process.argv.includes("--all");

const allowlisted = () => {
  const guard = readFileSync("test/i18n-no-hardcoded-strings.test.ts", "utf8");
  const start = guard.indexOf("const MIGRATED = [");
  const body = guard.slice(start, guard.indexOf("];", start));
  return [...body.matchAll(/"(src\/[^"]+)"/g)].map((m) => m[1]);
};

const everyTsx = () => {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name).replaceAll("\\", "/");
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".tsx")) out.push(p);
    }
  };
  walk("src");
  return out;
};

const USER_PROPS = new Set(["title", "aria-label", "placeholder", "alt", "label"]);

const files = (ALL ? everyTsx() : allowlisted()).filter((f) => f.endsWith(".tsx"));
let total = 0;
const rows = [];

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const reported = new Set(scanSource(src).map((v) => v.line));
  const hits = [];

  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const text = node.text.trim();
      if (/\p{Letter}{2,}/u.test(text)) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
        hits.push({ line: line + 1, kind: "jsx-text", text: text.replace(/\s+/g, " ") });
      }
    }
    if (ts.isJsxAttribute(node) && node.initializer && USER_PROPS.has(node.name.getText())) {
      const init = node.initializer;
      let text = null;
      if (ts.isStringLiteral(init)) text = init.text;
      else if (ts.isJsxExpression(init) && init.expression) {
        const e = init.expression;
        if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) text = e.text;
        else if (ts.isTemplateExpression(e)) {
          // STATIC spans only — `e.getText()` returns the raw SOURCE including the `${…}`
          // interpolation code, so a variable or function name inside one (`timeAgo`, `playback`)
          // reads as if it were prose. Walking `head` + each span's trailing literal is what the real
          // detector's regex-blank achieves for the non-AST case; here the AST already has it split.
          text = e.head.text + e.templateSpans.map((s) => s.literal.text).join("");
        }
      }
      if (text && /\p{Letter}{2,}/u.test(text)) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
        hits.push({ line: line + 1, kind: node.name.getText(), text: text.replace(/\s+/g, " ") });
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);

  const missed = hits.filter((h) => !reported.has(h.line));
  if (missed.length) {
    rows.push([file, missed]);
    total += missed.length;
  }
}

rows.sort((a, b) => b[1].length - a[1].length);
for (const [file, missed] of rows) {
  console.log(`\n${file} — ${missed.length}`);
  for (const h of missed) console.log(`  :${h.line}  [${h.kind}]  ${h.text.slice(0, 90)}`);
}
console.log(
  `\n${total} string(s) the detectors do not see, across ${rows.length} ${ALL ? "" : "ALLOWLISTED "}file(s).`,
);
console.log(
  "Not all are defects — physical key names, ids and copyright lines are legitimately literal.\n" +
    "The large class that is real: a sentence a JSX element or interpolation has cut in half. No\n" +
    "line-based rule can match those; `tNodes` (src/i18n/nodes.tsx) is the fix and\n" +
    "test/i18n-pseudo-render.test.tsx is the only thing that can prove one clean.",
);
