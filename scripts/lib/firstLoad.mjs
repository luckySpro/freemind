// What a browser actually downloads before first paint — SINGLE SOURCE OF TRUTH, imported by both the
// gate (scripts/size-budget.mjs, which fails the build) and the dashboard (scripts/build-stats.mjs,
// which reports it in public/stats.json).
//
// WHY THIS IS NOT JUST index-*.js. Rollup splits code shared by several eagerly-imported modules into
// its own chunk, and Vite emits a <link rel="modulepreload"> for it. A preloaded chunk is fetched on
// first paint exactly like the entry — nothing defers it — but the old rule filed it under "lazy" and
// stopped counting. Anything reached through a dynamic import() genuinely IS deferred, gets no preload
// tag, and is reported but not gated, which is what makes a split like exampleBuilders a real win
// rather than a bookkeeping one.
//
// Not hypothetical: migrating the eager inspectors moved ~16.6 kB into primitives-*.js and the gate
// reported a 10.5 kB IMPROVEMENT (168.5 -> 158.0) for a change that ADDED 141 catalogue keys. The same
// undercount had hidden ~8 kB for as long as primitives-* has existed, so the figure the gate defended
// was never the figure it claimed.
//
// It lives beside bundle-budget.mjs, and for the same reason. That module exists because the gate and
// the dashboard drifted on the NUMBER; this one exists because they would otherwise drift on the
// MEASUREMENT, which is the harder kind to notice — both would report a green tick against a ceiling
// they were each interpreting differently.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

/**
 * Measure `dist`, in gzipped kB.
 *
 * Returns `{ entry, initial, lazy, rows }`:
 *   entry   — the index-*.js chunk alone (the OLD metric; kept so the two can be compared)
 *   initial — entry + every chunk index.html preloads (what the gate defends)
 *   lazy    — everything else: genuinely deferred behind a dynamic import()
 *   rows    — per-file lines for the gate's console output
 */
export function measureFirstLoad(distDir) {
  const assetsDir = join(distDir, "assets");

  // Every JS file index.html pulls in up front: the entry <script type="module"> and each
  // <link rel="modulepreload">. Both appear as ./assets/<name>.js hrefs/srcs.
  const html = readFileSync(join(distDir, "index.html"), "utf8");
  const upFront = new Set(
    [...html.matchAll(/(?:href|src)="\.\/assets\/([^"]+\.js)"/g)].map((m) => m[1]),
  );

  let entry = 0;
  let lazy = 0;
  let initial = 0;
  const rows = [];
  for (const name of readdirSync(assetsDir)) {
    if (!name.endsWith(".js")) continue;
    const kb = gzipSync(readFileSync(join(assetsDir, name))).length / 1024;
    const isEntry = /^index-/.test(name);
    const isUpFront = isEntry || upFront.has(name);
    if (isEntry) entry += kb;
    else lazy += kb;
    if (isUpFront) initial += kb;
    rows.push(
      `  ${name}  ${kb.toFixed(1)} kB gz  ${isEntry ? "(entry)" : isUpFront ? "(preloaded — first paint)" : "(lazy)"}`,
    );
  }

  return { entry, initial, lazy, rows };
}
