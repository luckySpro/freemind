#!/usr/bin/env node
// Report hardcoded user-facing strings in any file, using the SAME detectors the guard test enforces
// (`scripts/lib/i18nDetectors.mjs`). The test only scans the migrated allowlist, by design — this is how
// you see the worklist for a file BEFORE migrating it, without putting it on the list and going red.
//
//   node scripts/i18n-scan.mjs src/Panels.tsx
//   node scripts/i18n-scan.mjs src/Panels.tsx src/App.tsx --count
//
// Exit code is 0 whether or not it finds anything: this is a worklist, not a gate. The gate is the test.

import { readFileSync } from "node:fs";
import { scanSource } from "./lib/i18nDetectors.mjs";

const args = process.argv.slice(2);
const countOnly = args.includes("--count");
const files = args.filter((a) => !a.startsWith("--"));

if (files.length === 0) {
  console.error("usage: node scripts/i18n-scan.mjs <file…> [--count]");
  process.exit(2);
}

let total = 0;
for (const file of files) {
  let violations;
  try {
    violations = scanSource(readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`✗ ${file}: ${err.message}`);
    continue;
  }
  total += violations.length;
  if (countOnly) {
    console.log(`${String(violations.length).padStart(4)}  ${file}`);
    continue;
  }
  console.log(`\n${file} — ${violations.length} hardcoded user-facing string(s)`);
  for (const v of violations) console.log(`  ${file}:${v.line}  ${v.why}\n    ${v.text}`);
}

if (files.length > 1) console.log(`\ntotal: ${total}`);
