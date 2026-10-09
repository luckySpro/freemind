// Bundle-size budget — the GATE for the INITIAL-load JS ceiling. Fails the build when the JS a browser
// fetches before first paint exceeds BUDGET_KB.
//
// The measurement (entry + every modulepreloaded chunk, and why that is the right definition) lives in
// scripts/lib/firstLoad.mjs, shared with the dashboard so the gate and the reported figure cannot mean
// different things. The ceiling itself, plus the rationale history for every bump, lives in
// scripts/bundle-budget.mjs, imported by both for the same reason.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { BUDGET_KB } from "./bundle-budget.mjs";
import { measureFirstLoad } from "./lib/firstLoad.mjs";

const distDir = join(import.meta.dirname, "..", "dist");
const assetsDir = join(distDir, "assets");

const { entry, initial, lazy, rows } = measureFirstLoad(distDir);

for (const row of rows) console.log(row);
console.log(
  `  ───\n  first load  ${initial.toFixed(1)} kB gz  (budget ${BUDGET_KB} kB)    lazy  ${lazy.toFixed(1)} kB gz\n` +
    `  of that first load, ${entry.toFixed(1)} kB is the entry chunk and ${(initial - entry).toFixed(1)} kB is preloaded siblings.`,
);

if (initial > BUDGET_KB) {
  console.error(`\n✗ First-load JS over budget: ${initial.toFixed(1)} kB > ${BUDGET_KB} kB`);
  process.exit(1);
}
console.log(`\n✓ First-load JS within budget: ${initial.toFixed(1)} kB ≤ ${BUDGET_KB} kB`);

// Critical-CSS guard. React Flow ships its core stylesheet as a SEPARATE file that must be
// imported (src/mindmap/FlowMindMap.tsx -> "@xyflow/react/dist/style.css"). If that import is
// ever dropped the JS still builds, but the canvas renders unstyled — nodes lose their absolute
// positioning and the whole map collapses into inline text (this exact failure shipped once with
// the mind-elixir CSS, undetected). `.react-flow` is a stable, engine-only selector the app never
// authors itself.
const cssText = readdirSync(assetsDir)
  .filter((name) => name.endsWith(".css"))
  .map((name) => readFileSync(join(assetsDir, name), "utf8"))
  .join("\n");
if (!cssText.includes(".react-flow")) {
  console.error(
    '\n✗ React Flow core CSS missing from the bundle — the canvas would render unstyled.\n  Check that `import "@xyflow/react/dist/style.css"` is still in src/mindmap/FlowMindMap.tsx.',
  );
  process.exit(1);
}
console.log("✓ React Flow core CSS bundled (.react-flow rules present)");
