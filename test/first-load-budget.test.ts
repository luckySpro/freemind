// What counts as "first load" — the definition the size gate and the stats dashboard both defend.
//
// This is worth a test rather than a one-off manual check because the failure mode is a GREEN TICK.
// The old rule weighed `index-*.js` alone, so relocating code into a modulepreloaded sibling read as an
// improvement: migrating the eager inspectors moved ~16.6 kB into `primitives-*.js` and the gate
// reported 168.5 → 158.0, a 10.5 kB "win", for a change that added 141 catalogue keys. Nothing was
// deferred. A ceiling you can satisfy by moving weight sideways is not a ceiling, and nothing about
// that failure looks wrong in CI — it looks like progress.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { measureFirstLoad } from "../scripts/lib/firstLoad.mjs";

let dir: string;
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** A fake dist: an entry chunk, a preloaded sibling, and a genuinely lazy chunk. */
const buildDist = (html: string, files: Record<string, string>) => {
  dir = mkdtempSync(join(tmpdir(), "firstload-"));
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "index.html"), html);
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, "assets", name), body);
  return dir;
};

const kb = (body: string) => gzipSync(Buffer.from(body)).length / 1024;

describe("measureFirstLoad", () => {
  const HTML = `<!doctype html><html><head>
    <script type="module" crossorigin src="./assets/index-abc.js"></script>
    <link rel="modulepreload" crossorigin href="./assets/primitives-def.js">
  </head><body></body></html>`;

  // Distinct bodies so the three sizes can't coincidentally match.
  const ENTRY = "e".repeat(4000);
  const PRELOAD = "p".repeat(2000);
  const LAZY = "l".repeat(8000);

  it("counts a modulepreloaded chunk as first load, not as lazy", () => {
    const d = buildDist(HTML, {
      "index-abc.js": ENTRY,
      "primitives-def.js": PRELOAD,
      "xmind-ghi.js": LAZY,
    });
    const { entry, initial, lazy } = measureFirstLoad(d);

    expect(entry).toBeCloseTo(kb(ENTRY), 5);
    // The whole point: initial is entry + preloaded, NOT entry alone.
    expect(initial).toBeCloseTo(kb(ENTRY) + kb(PRELOAD), 5);
    expect(initial).toBeGreaterThan(entry);
    // Only the dynamically-imported chunk is deferred.
    expect(lazy).toBeCloseTo(kb(PRELOAD) + kb(LAZY), 5);
  });

  it("does not reward moving weight out of the entry into a preloaded sibling", () => {
    // The exact regression that produced a false 10.5 kB "win": same total, redistributed.
    const before = measureFirstLoad(
      buildDist(HTML, { "index-abc.js": ENTRY + PRELOAD, "primitives-def.js": "" }),
    );
    const beforeEntry = before.entry;
    const beforeInitial = before.initial;
    rmSync(dir, { recursive: true, force: true });

    const after = measureFirstLoad(
      buildDist(HTML, { "index-abc.js": ENTRY, "primitives-def.js": PRELOAD }),
    );

    // The OLD metric would have called this an improvement...
    expect(after.entry).toBeLessThan(beforeEntry);
    // ...while first load barely moved. (Not exactly equal: gzip compresses one 6 kB stream better
    // than two smaller ones, so splitting genuinely costs a little. The point is that the gate no
    // longer sees a large win where there is none.)
    expect(after.initial).toBeGreaterThanOrEqual(beforeInitial);
  });

  it("treats a chunk with no preload tag as lazy even if it sits beside the entry", () => {
    const d = buildDist(
      `<!doctype html><html><head>
        <script type="module" crossorigin src="./assets/index-abc.js"></script>
      </head><body></body></html>`,
      { "index-abc.js": ENTRY, "primitives-def.js": PRELOAD },
    );
    const { entry, initial } = measureFirstLoad(d);
    // No <link rel="modulepreload">, so nothing fetches it up front — a real split, a real win.
    expect(initial).toBeCloseTo(entry, 5);
  });
});
