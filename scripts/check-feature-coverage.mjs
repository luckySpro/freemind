// scripts/check-feature-coverage.mjs
//
// Guards docs/features.json — the feature catalogue that build-stats.mjs turns
// into the `featureCoverage` metric (the dashboard's "% of features documented"
// denominator). Run in `pnpm gate` AND in the Stats workflow so the catalogue
// can't silently rot:
//
//   • INTEGRITY (hard fail): duplicate / missing id, unknown area, missing name,
//     bad `since` date, non-boolean coverage flag, or `bookExample` without
//     `book`. build-stats reads this file through a safe() guard, so a broken
//     registry would otherwise just make featureCoverage null with no signal —
//     this converts that silent failure into a loud one.
//   • FRESHNESS (warn, not fail): if CHANGELOG.md has more "- **…**" feature
//     bullets than the catalogue's `reviewedThroughChangelogBullets` watermark,
//     the catalogue may be missing newly-shipped features — surfaced as a GitHub
//     annotation. Bump the watermark when you've reviewed the new entries.
//
// The coverage flags themselves are judgment-maintained alongside the docs (the
// repo's "keep the docs in sync" rule); this guards the denominator + structure.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

let reg;
try {
  reg = JSON.parse(read("docs/features.json"));
} catch (e) {
  console.error(`✗ docs/features.json is not valid JSON: ${e.message}`);
  process.exit(1);
}

const feats = reg.features;
if (!Array.isArray(feats) || feats.length === 0) {
  console.error("✗ docs/features.json: `features` must be a non-empty array");
  process.exit(1);
}

const areas = new Set(Array.isArray(reg.areas) ? reg.areas : []);
const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const errors = [];
const seen = new Set();
for (const f of feats) {
  const where = f && typeof f.id === "string" ? f.id : JSON.stringify(f);
  if (typeof f.id !== "string" || !f.id) errors.push(`feature has no string id: ${where}`);
  else if (seen.has(f.id)) errors.push(`duplicate id: ${f.id}`);
  else seen.add(f.id);
  if (typeof f.name !== "string" || !f.name) errors.push(`${where}: missing name`);
  if (!areas.has(f.area)) errors.push(`${where}: area "${f.area}" not in the declared areas list`);
  if (!isDate(f.since)) errors.push(`${where}: since must be a YYYY-MM-DD date string`);
  for (const k of ["manual", "book", "bookExample"])
    if (typeof f[k] !== "boolean") errors.push(`${where}: ${k} must be a boolean`);
  if (f.bookExample === true && f.book !== true)
    errors.push(`${where}: bookExample is true but book is false`);
}

if (errors.length) {
  console.error(`✗ feature catalogue integrity: ${errors.length} error(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

// Surface the live coverage numbers in the gate output.
const T = feats.length;
const pct = (n) => Math.round((n / T) * 1000) / 10;
const count = (k) => feats.filter((f) => f[k]).length;
console.log(
  `✓ feature catalogue: ${T} features — manual ${count("manual")} (${pct(count("manual"))}%), ` +
    `book ${count("book")} (${pct(count("book"))}%), book+example ${count("bookExample")} (${pct(count("bookExample"))}%)`,
);

// Freshness: has the CHANGELOG grown past the reviewed watermark? Count the
// "- **Feature**" bullets across the changelog (each is a shipped capability).
const watermark =
  typeof reg.reviewedThroughChangelogBullets === "number" ? reg.reviewedThroughChangelogBullets : 0;
const bullets = (read("CHANGELOG.md").match(/^- \*\*/gm) || []).length;
if (bullets > watermark) {
  process.stdout.write(
    `::warning::feature catalogue reviewed through ${watermark} changelog bullets, but CHANGELOG now has ${bullets}. Review the new entries for user-facing features, update docs/features.json, and bump reviewedThroughChangelogBullets.\n`,
  );
} else {
  console.log(
    `✓ catalogue reviewed through ${watermark} changelog bullets (CHANGELOG has ${bullets})`,
  );
}
