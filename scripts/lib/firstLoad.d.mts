// Types for firstLoad.mjs, so `tsc --noEmit` can check the test that imports it. Same arrangement as
// i18nDetectors.d.mts and i18nFrozen.d.mts — the script stays plain .mjs so `node scripts/…` runs it
// with no build step, and this file is the only thing TypeScript needs.

export interface FirstLoad {
  /** The `index-*.js` chunk alone, in gzipped kB — the OLD metric, kept for comparison. */
  entry: number;
  /** Entry + every chunk `index.html` preloads, in gzipped kB — what the budget gates on. */
  initial: number;
  /** Everything else: genuinely deferred behind a dynamic `import()`, in gzipped kB. */
  lazy: number;
  /** Per-file lines for the gate's console output. */
  rows: string[];
}

/** Measure a built `dist` directory. */
export function measureFirstLoad(distDir: string): FirstLoad;
