// Types for i18nFrozen.mjs, so `tsc --noEmit` can check the ratchet test that imports it. Same
// arrangement as i18nDetectors.d.mts — the script stays plain .mjs so `node scripts/…` runs it with no
// build step, and this file is the only thing TypeScript needs.

export interface FrozenCall {
  /** Forward-slashed path, relative to the repo root. */
  file: string;
  /** 1-based line of the `t(` call. */
  line: number;
  /** The call's source text, e.g. `t("panel.outline")`. */
  text: string;
}

/** Every module-scope `t(...)` call under `root` — the ones frozen at import time. */
export function findFrozenCalls(root: string): FrozenCall[];

/** `findFrozenCalls` collapsed to `file -> count`. */
export function frozenByFile(root: string): Map<string, number>;
