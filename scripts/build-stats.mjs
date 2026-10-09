#!/usr/bin/env node
// scripts/build-stats.mjs
// -----------------------------------------------------------------------------
// Generates public/stats.json — the deep project metrics the GitHub API cannot
// compute on its own: lines of code by category, test counts, coverage, domain
// richness, footprint, code hygiene, risk map and the git story. The live
// dashboard reads this file (via the GitHub raw mirror) so the numbers refresh
// whenever the Stats workflow regenerates it.
//
// Dependency-free: Node built-ins + the `git` CLI only.
// Run after coverage so coverage/coverage-summary.json exists, e.g.:
//   pnpm exec vitest run --coverage --coverage.reporter=json-summary
//   node ./scripts/build-stats.mjs
// -----------------------------------------------------------------------------

import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { gzipSync } from "node:zlib";
import { BUDGET_KB } from "./bundle-budget.mjs";
import { measureFirstLoad } from "./lib/firstLoad.mjs";

const ROOT = process.cwd();
const sh = (cmd) =>
  execSync(cmd, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
const safe = (fn, dflt) => {
  try {
    return fn();
  } catch {
    return dflt;
  }
};
const round1 = (n) => Math.round((n / 1024) * 10) / 10;

// --- tracked files (respects .gitignore; also gives the "tracked files" count) --
const tracked = sh("git ls-files").split("\n").filter(Boolean);

const countLines = (f) => {
  try {
    const s = readFileSync(join(ROOT, f), "utf8");
    if (s.length === 0) return 0;
    let n = 0;
    for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) n++;
    return s.endsWith("\n") ? n : n + 1;
  } catch {
    return 0;
  }
};

const isTsx = (f) => /\.(ts|tsx)$/.test(f) && !f.endsWith(".d.ts");

// --- categorize every tracked file into one bucket -----------------------------
const cat = {
  app: (f) => f.startsWith("src/") && isTsx(f),
  unit: (f) => f.startsWith("test/") && isTsx(f),
  scripts: (f) => f.startsWith("scripts/") && /\.(mjs|cjs|js)$/.test(f),
  styles: (f) => f.endsWith(".css"),
  docs: (f) => f.startsWith("docs/") && f.endsWith(".md"),
};

const buckets = {};
for (const k of Object.keys(cat)) buckets[k] = { files: 0, lines: 0 };
for (const f of tracked) {
  for (const k of Object.keys(cat)) {
    if (cat[k](f)) {
      buckets[k].files++;
      buckets[k].lines += countLines(f);
      break;
    }
  }
}

const code = [
  { category: "App code (src)", files: buckets.app.files, lines: buckets.app.lines },
  { category: "Unit tests", files: buckets.unit.files, lines: buckets.unit.lines },
  { category: "Build scripts", files: buckets.scripts.files, lines: buckets.scripts.lines },
  { category: "Styles (CSS)", files: buckets.styles.files, lines: buckets.styles.lines },
  { category: "Docs (Markdown)", files: buckets.docs.files, lines: buckets.docs.lines },
];

const linesTsJs = buckets.app.lines + buckets.unit.lines + buckets.scripts.lines;

// --- test counts (count it()/test() call sites in test/) -----------------------
const countTests = (prefix) => {
  let n = 0;
  for (const f of tracked) {
    if (!f.startsWith(prefix) || !isTsx(f)) continue;
    const s = safe(() => readFileSync(join(ROOT, f), "utf8"), "");
    const m = s.match(/(?:^|\s)(?:it|test)(?:\.\w+)?\s*\(/g);
    if (m) n += m.length;
  }
  return n;
};
const unitTests = countTests("test/");

// --- coverage (read the V8 json-summary if present) ----------------------------
let coverage = null;
if (existsSync(join(ROOT, "coverage/coverage-summary.json"))) {
  const c = safe(
    () => JSON.parse(readFileSync(join(ROOT, "coverage/coverage-summary.json"), "utf8")),
    null,
  );
  if (c?.total) {
    const pick = (k) => ({
      pct: c.total[k].pct,
      covered: c.total[k].covered,
      total: c.total[k].total,
    });
    coverage = {
      lines: pick("lines"),
      statements: pick("statements"),
      functions: pick("functions"),
      branches: pick("branches"),
    };
  }
}

// --- domain richness: read from the canonical source modules, not guesses ------
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const readSrc = (rel) => safe(() => readFileSync(join(ROOT, rel), "utf8"), "");
const srcFiles = tracked.filter((f) => f.startsWith("src/") && isTsx(f));

// Count the entries of a named array literal `<name> ... = [ ... ]` by counting a marker inside it.
const countArrayEntries = (rel, name, marker) =>
  safe(() => {
    const src = stripComments(readSrc(rel));
    const at = src.indexOf(name);
    if (at === -1) return null;
    const open = src.indexOf("[", src.indexOf("=", at));
    if (open === -1) return null;
    // crude bracket match to the array's close
    let depth = 0;
    let end = -1;
    for (let i = open; i < src.length; i++) {
      if (src[i] === "[") depth++;
      else if (src[i] === "]" && --depth === 0) {
        end = i;
        break;
      }
    }
    if (end === -1) return null;
    const m = src.slice(open, end).match(marker);
    return m ? m.length : null;
  }, null);

const canvasThemes = countArrayEntries("src/mindmap/theme.ts", "canvasThemes", /\bid:\s*['"]/g);
const markerCount = countArrayEntries("src/icons.ts", "MARKER_PALETTE", /["']/g);
const templates = countArrayEntries("src/templates.ts", "templates", /\bid:\s*['"]/g);
const exportFormats = safe(() => {
  const src = stripComments(readSrc("src/useMapExports.ts"));
  const at = src.indexOf("interface MapExports");
  if (at === -1) return null;
  const m = src.slice(at, src.indexOf("}", at)).match(/export\w+\s*:/g);
  return m ? m.length : null;
}, null);

const domain = {
  components: srcFiles.filter((f) => f.endsWith(".tsx")).length,
  hooks: srcFiles.filter((f) => /(^|\/)use[A-Z]\w*\.ts$/.test(f)).length,
  ioModules: srcFiles.filter((f) => f.startsWith("src/io/")).length,
  canvasThemes,
  markers: markerCount ? markerCount / 2 : null, // each emoji is two quotes
  templates,
  exportFormats,
};

// --- footprint -----------------------------------------------------------------
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const depsProd = Object.keys(pkg.dependencies || {}).length;
const depsDev = Object.keys(pkg.devDependencies || {}).length;

const biggestFiles = tracked
  .filter(cat.app)
  .map((f) => ({ name: f.replace(/^src\//, ""), lines: countLines(f) }))
  .sort((a, b) => b.lines - a.lines)
  .slice(0, 5);

// --- git story -----------------------------------------------------------------
const commits = Number(safe(() => sh("git rev-list --count HEAD"), "0")) || 0;
const born =
  safe(() => sh("git log --reverse --max-parents=0 --format=%aI").split("\n")[0], null) || null;
const ageDays = born ? Math.floor((Date.now() - new Date(born)) / 86400000) : null;
const commits7d =
  Number(safe(() => sh('git rev-list --count --since="7 days ago" HEAD'), "0")) || 0;

const authors = safe(
  () =>
    sh("git shortlog -sn --no-merges HEAD")
      .split("\n")
      .map((l) => {
        const m = l.trim().match(/^(\d+)\s+(.*)$/);
        return m ? { name: m[2], count: Number(m[1]) } : null;
      })
      .filter(Boolean),
  [],
);

const churn30d = { added: 0, removed: 0 };
safe(() => {
  const out = sh('git log --since="30 days ago" --numstat --format=tformat: HEAD');
  for (const line of out.split("\n")) {
    const m = line.trim().match(/^(\d+|-)\t(\d+|-)\t/);
    if (m) {
      if (m[1] !== "-") churn30d.added += Number(m[1]);
      if (m[2] !== "-") churn30d.removed += Number(m[2]);
    }
  }
});

// CHANGELOG "feature bullets" (one per shipped capability) — a meaningful count.
let changelogEntries = null;
if (existsSync(join(ROOT, "CHANGELOG.md"))) {
  const m = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8").match(/^- \*\*/gm);
  changelogEntries = m ? m.length : null;
}

const headSha = safe(() => sh("git rev-parse --short HEAD"), null);

// --- per-file coverage (drives leastCovered + risky) --------------------------
const perFileCov = safe(() => {
  const c = JSON.parse(readFileSync(join(ROOT, "coverage/coverage-summary.json"), "utf8"));
  const out = [];
  for (const [k, v] of Object.entries(c)) {
    if (k === "total" || !v?.lines) continue;
    const rel = k.replace(/\\/g, "/");
    const i = rel.lastIndexOf("/src/");
    if (i === -1) continue;
    const file = rel.slice(i + 5);
    if (/\.(test|spec)\.tsx?$/.test(file)) continue;
    if (v.lines.total === 0) continue;
    out.push({ file, pct: v.lines.pct });
  }
  return out;
}, []);

// --- bundle size (gzip of built dist/; budget = TRUE FIRST LOAD ≤ BUDGET_KB) ---
//
// `withinBudget` must be computed from the same figure the gate defends, or the dashboard reports a
// green tick against a ceiling it is interpreting differently — the same class of drift that made
// bundle-budget.mjs necessary, one level up. Hence `measureFirstLoad`, shared with size-budget.mjs.
// `entryGzipKb` stays in the payload for continuity of the historical series, but it is no longer what
// the budget is judged against.
const bundle = safe(
  () => {
    const distDir = join(ROOT, "dist");
    if (!existsSync(distDir)) {
      return {
        jsGzipKb: null,
        cssGzipKb: null,
        totalGzipKb: null,
        entryGzipKb: null,
        firstLoadGzipKb: null,
        budgetKb: BUDGET_KB,
        withinBudget: true,
      };
    }
    let jsBytes = 0;
    let cssBytes = 0;
    for (const e of readdirSync(distDir, { recursive: true })) {
      const rel = String(e).replace(/\\/g, "/");
      if (!/\.(js|css)$/.test(rel)) continue;
      const buf = safe(() => readFileSync(join(distDir, rel)), null);
      if (!buf) continue;
      const gz = gzipSync(buf).length;
      if (rel.endsWith(".css")) cssBytes += gz;
      else jsBytes += gz;
    }
    const { entry, initial } = measureFirstLoad(distDir);
    const budgetKb = BUDGET_KB; // imported, not mirrored — see scripts/bundle-budget.mjs
    return {
      jsGzipKb: round1(jsBytes),
      cssGzipKb: round1(cssBytes),
      totalGzipKb: round1(jsBytes + cssBytes),
      entryGzipKb: round1(entry * 1024),
      firstLoadGzipKb: round1(initial * 1024),
      budgetKb,
      withinBudget: round1(initial * 1024) <= budgetKb,
    };
  },
  {
    jsGzipKb: null,
    cssGzipKb: null,
    totalGzipKb: null,
    entryGzipKb: null,
    firstLoadGzipKb: null,
    budgetKb: BUDGET_KB,
    withinBudget: true,
  },
);

// --- quality (least-covered, churn hotspots, risky) ----------------------------
const mutationScore = null; // no mutation testing configured for this project

const leastCovered = perFileCov
  .filter((f) => f.pct < 100)
  .sort((a, b) => a.pct - b.pct)
  .slice(0, 5);

const churn = safe(() => {
  const out = sh('git log --since="90 days ago" --name-only --format= -- src');
  const counts = new Map();
  for (const line of out.split("\n")) {
    const f = line.trim();
    if (!f.startsWith("src/")) continue;
    const file = f.replace(/^src\//, "");
    counts.set(file, (counts.get(file) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([file, n]) => ({ file, commits: n }))
    .sort((a, b) => b.commits - a.commits);
}, []);
const churnHotspots = churn.slice(0, 5);

// risky = high-change × low-coverage: churn top-15 whose line coverage is < 70%.
const lowCov = new Set(perFileCov.filter((f) => f.pct < 70).map((f) => f.file));
const covByFile = new Map(perFileCov.map((f) => [f.file, f.pct]));
const risky = churn
  .slice(0, 15)
  .filter((c) => lowCov.has(c.file))
  .map((c) => ({ file: c.file, pct: covByFile.get(c.file) ?? null, commits: c.commits }))
  .slice(0, 5);

const quality = { mutationScore, leastCovered, churnHotspots, risky };

// --- code hygiene (escape-hatch + marker counts over src) ----------------------
const hygiene = safe(() => {
  const h = {
    todo: 0,
    fixme: 0,
    hack: 0,
    anyCount: 0,
    tsIgnore: 0,
    tsExpectError: 0,
    biomeIgnore: 0,
    nonNull: 0,
  };
  const n = (s, re) => (s.match(re) || []).length;
  for (const f of srcFiles) {
    const s = safe(() => readFileSync(join(ROOT, f), "utf8"), "");
    h.todo += n(s, /TODO/g);
    h.fixme += n(s, /FIXME/g);
    h.hack += n(s, /HACK/g);
    h.anyCount += n(s, /:\s*any\b/g) + n(s, /\bas\s+any\b/g);
    h.tsIgnore += n(s, /@ts-ignore/g);
    h.tsExpectError += n(s, /@ts-expect-error/g);
    h.biomeIgnore += n(s, /biome-ignore/g);
    h.nonNull += n(s, /[\w)\]]!(?!=)/g);
  }
  return h;
}, null);

// --- docs: book size vs app code (docs/guide/*.md once the book exists) ---------
const guideFiles = tracked.filter(
  (f) => f.startsWith("docs/guide/") && f.endsWith(".md") && !/\/(README|AUTHORING)\.md$/.test(f),
);
const docs = safe(
  () => {
    let words = 0;
    for (const f of guideFiles) {
      const s = safe(() => readFileSync(join(ROOT, f), "utf8"), "").trim();
      if (s) words += s.split(/\s+/).length;
    }
    const appLoc = buckets.app.lines;
    return {
      bookWords: words,
      chapters: guideFiles.length,
      appLoc,
      docToCodeRatio: appLoc > 0 && words > 0 ? Math.round((words / appLoc) * 100) / 100 : null,
    };
  },
  { bookWords: null, chapters: guideFiles.length, appLoc: buckets.app.lines, docToCodeRatio: null },
);

// --- test-suite timing (Vitest JSON report from the run, if present) -----------
const timing = safe(
  () => {
    const r = JSON.parse(readFileSync(join(ROOT, ".tmp/vitest-report.json"), "utf8"));
    const results = Array.isArray(r.testResults) ? r.testResults : [];
    if (results.length === 0) return { durationMs: null, slowest: [] };
    const ends = results.map((t) => t.endTime).filter((x) => typeof x === "number");
    const starts = results.map((t) => t.startTime).filter((x) => typeof x === "number");
    const durationMs =
      ends.length && starts.length ? Math.round(Math.max(...ends) - Math.min(...starts)) : null;
    const slowest = results
      .map((t) => ({
        file: String(t.name || "")
          .replace(/\\/g, "/")
          .replace(/^.*\/(test\/)/, "$1"),
        ms: Math.round((t.endTime ?? 0) - (t.startTime ?? 0)),
      }))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 5);
    return { durationMs, slowest };
  },
  { durationMs: null, slowest: [] },
);

// --- feature coverage (reads docs/features.json) -------------------------------
const featureCoverage = safe(() => {
  const reg = JSON.parse(readFileSync(join(ROOT, "docs/features.json"), "utf8"));
  const feats = Array.isArray(reg.features) ? reg.features : [];
  const total = feats.length;
  const pct = (n) => (total ? Math.round((n / total) * 1000) / 10 : 0);
  const manual = feats.filter((f) => f.manual).length;
  const book = feats.filter((f) => f.book).length;
  const bookExample = feats.filter((f) => f.bookExample).length;
  const byArea = {};
  for (const f of feats) {
    if (!byArea[f.area]) byArea[f.area] = { total: 0, manual: 0, book: 0 };
    const a = byArea[f.area];
    a.total++;
    if (f.manual) a.manual++;
    if (f.book) a.book++;
  }
  const newestFirst = (arr) =>
    [...arr].sort((a, b) => String(b.since).localeCompare(String(a.since)));
  const gap = (pred) =>
    newestFirst(feats.filter(pred)).map((f) => ({ id: f.id, name: f.name, since: f.since }));
  return {
    total,
    manual,
    manualPct: pct(manual),
    book,
    bookPct: pct(book),
    bookExample,
    bookExamplePct: pct(bookExample),
    byArea,
    gaps: { noManual: gap((f) => !f.manual), noBook: gap((f) => !f.book) },
  };
}, null);

// --- assemble + write ----------------------------------------------------------
const stats = {
  generatedAt: new Date().toISOString(),
  commit: headSha,
  headline: {
    linesTsJs,
    tests: unitTests,
    lineCoveragePct: coverage ? coverage.lines.pct : null,
    commits,
    ageDays,
    trackedFiles: tracked.length,
    featureManualPct: featureCoverage ? featureCoverage.manualPct : null,
    featureBookPct: featureCoverage ? featureCoverage.bookPct : null,
    featureExamplePct: featureCoverage ? featureCoverage.bookExamplePct : null,
  },
  code,
  coverage,
  tests: { unit: unitTests, e2e: 0, durationMs: timing.durationMs, slowest: timing.slowest },
  domain,
  footprint: { depsProd, depsDev, biggestFiles },
  quality,
  hygiene,
  bundle,
  docs,
  featureCoverage,
  git: { born, ageDays, commits, commits7d, authors, churn30d, changelogEntries },
};

// REFUSE to overwrite a good stats.json with a coverage-less one.
//
// Every coverage figure here comes from `coverage/coverage-summary.json`, and without it the `safe()`
// guards degrade to `null` rather than failing — which is right for a first run in a fresh checkout,
// and wrong for a re-run in a repo that already has real numbers. Running `node scripts/build-stats.mjs`
// on its own (easy to do: it is a one-liner, and the coverage prerequisite lives in a comment at the
// top of this file and in stats.yml) then silently replaces `lineCoveragePct: 90.1` with `null`. The
// dashboard renders "—", `test/dashboard.test.ts` fails on its own contract, and nothing points at the
// cause. That is not hypothetical — it happened, and the failure surfaced three commits later.
//
// So: no coverage + an existing file that HAS coverage = exit non-zero and touch nothing. Use
// `pnpm stats`, which runs coverage first.
const priorStats = safe(
  () => JSON.parse(readFileSync(join(ROOT, "public/stats.json"), "utf8")),
  null,
);
if (!coverage && priorStats?.headline?.lineCoveragePct != null) {
  console.error(
    [
      "✗ Refusing to overwrite public/stats.json: no coverage/coverage-summary.json, but the committed",
      `  stats.json has real coverage (${priorStats.headline.lineCoveragePct}%). Writing now would blank it.`,
      "  Run `pnpm stats` (coverage → build → features → stats) instead of this script alone.",
    ].join("\n"),
  );
  process.exit(1);
}

writeFileSync(join(ROOT, "public/stats.json"), `${JSON.stringify(stats, null, 2)}\n`);

// --- trends: append today's point to public/stats-history.json -----------------
const histPath = join(ROOT, "public/stats-history.json");
let history = safe(() => JSON.parse(readFileSync(histPath, "utf8")), []);
if (!Array.isArray(history)) history = [];
const today = new Date().toISOString().slice(0, 10);
const point = {
  date: today,
  linesTsJs,
  coveragePct: coverage ? coverage.lines.pct : null,
  tests: unitTests,
  bundleKb: bundle.totalGzipKb,
  mutationScore: quality.mutationScore,
  featureManualPct: featureCoverage ? featureCoverage.manualPct : null,
  featureBookPct: featureCoverage ? featureCoverage.bookPct : null,
  featureExamplePct: featureCoverage ? featureCoverage.bookExamplePct : null,
};
history = history.filter((h) => h.date !== today);
history.push(point);
if (history.length > 180) history = history.slice(-180);
writeFileSync(histPath, `${JSON.stringify(history, null, 2)}\n`);

console.log("Wrote public/stats.json —", JSON.stringify(stats.headline));
console.log("Wrote public/stats-history.json —", `${history.length} points`);
