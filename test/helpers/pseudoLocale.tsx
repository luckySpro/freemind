import { START_EN } from "../../src/components/start/messages";
import { THEME_EN } from "../../src/components/themeDesignerMessages";
// The pseudo-locale harness — the only check that can prove an i18n migration batch CORRECT.
//
// WHY THIS EXISTS. Migrating a string is observationally a no-op: English before, English after. So
// `pnpm gate`, a clean diff review and a dev-server screenshot are all *guaranteed* to pass on a batch
// that silently dropped a string on the floor, wired a call site to the wrong key, or left a label
// hardcoded. Every one of those has happened in this migration. The gate cannot see them because there
// is nothing to see — until you make the catalogue say something different from the source.
//
// That is what this does. `registerMessages` merges and LATER REGISTRATIONS WIN (see i18n/registry.ts),
// so overlaying the live catalogue with a marked-up copy is enough — no second locale, no build change,
// no production code touched.
//
//   MARKER mode  — every message becomes ⟦…⟧. Any user-visible text WITHOUT the marker is a string the
//                  app did not get from the catalogue: unmigrated, or hardcoded, or lost.
//   ECHO mode    — every message becomes its own KEY. This is the only way to tell a correct reuse from
//                  a plausible wrong one: it renders `toolbar.layout`, so the assertion names the exact
//                  key the call site read, not merely that it read something.
//
// The overlay is GLOBAL MUTABLE STATE. Always pair it with `restoreCatalogues()` in an afterEach, or
// the next test file to touch i18n inherits a marked-up catalogue and fails somewhere unrelated.
import type { Catalogue, Message } from "../../src/i18n";
import { registerMessages } from "../../src/i18n";
import { CORE_EN } from "../../src/i18n/core";
import { IO_EN } from "../../src/io/messages";
import { CANVAS_EN } from "../../src/mindmap/flow/messages";
import { PRESENT_EN } from "../../src/present/presentMessages";

export const MARK_OPEN = "⟦";
export const MARK_CLOSE = "⟧";

// EVERY catalogue, not just the eager one. A catalogue left out of this list is not merely uncovered —
// it makes the harness actively WRONG for any component that uses it, because those strings come back
// as plain English and get reported as unmarked. Until this was fixed the harness could only be
// pointed at core + canvas components; aiming it at the Start screen would have produced a wall of
// false positives and, most likely, an ignore list written to silence them.
const CATALOGUES: Catalogue[] = [
  CORE_EN as Catalogue,
  CANVAS_EN as Catalogue,
  START_EN as Catalogue,
  THEME_EN as Catalogue,
  PRESENT_EN as Catalogue,
  IO_EN as Catalogue,
];

const mapMessage = (message: Message, f: (s: string) => string): Message =>
  typeof message === "string"
    ? f(message)
    : Object.fromEntries(Object.entries(message).map(([cat, form]) => [cat, f(form as string)]));

const transform = (catalogue: Catalogue, f: (s: string) => string): Catalogue =>
  Object.fromEntries(Object.entries(catalogue).map(([k, v]) => [k, mapMessage(v, f)]));

/**
 * Wrap every message in markers. Placeholders survive, so interpolation still works.
 *
 * Marks each literal SEGMENT rather than the whole message, because `tNodes` renders a message with
 * markup placeholders by splitting it on those placeholders — so one message becomes several sibling
 * text nodes. Wrapping the message as a whole gives the first node `⟦`, the last `⟧`, and everything
 * between them NOTHING: for `Press {child} for a child · {sibling} for a sibling`, the run
 * `" for a child · "` carries no marker and gets reported as if it were hardcoded. Marking segments
 * makes every rendered run carry its own pair, whichever way the renderer cuts them up.
 *
 * For a message with no placeholders this is exactly the old behaviour — one segment, one pair.
 */
const markSegments = (s: string) =>
  s
    .split(/(\{\w+\})/g)
    .map((part) =>
      part === "" || /^\{\w+\}$/.test(part) ? part : `${MARK_OPEN}${part}${MARK_CLOSE}`,
    )
    .join("");

export function applyMarkerLocale(): void {
  for (const c of CATALOGUES) registerMessages("en", transform(c, markSegments));
}

/** Replace every message with its own key, so a rendered string names the key that produced it. */
export function applyEchoLocale(): void {
  for (const c of CATALOGUES)
    registerMessages(
      "en",
      Object.fromEntries(
        Object.entries(c).map(([k, v]) => [k, mapMessage(v, () => k)]),
      ) as Catalogue,
    );
}

/** Put the real English back. MUST run after every test that applied an overlay. */
export function restoreCatalogues(): void {
  for (const c of CATALOGUES) registerMessages("en", c);
}

/** Attributes a user or a screen reader actually reads. */
const USER_FACING_ATTRS = ["title", "aria-label", "placeholder", "alt"];

/**
 * Every user-visible string in `root` that did NOT come from the catalogue.
 *
 * `ignore` is for text that is legitimately not a message: fixture-supplied user DATA (topic titles,
 * map names), physical key names, and decorative glyphs. Keep it short and give each entry a reason —
 * it is the same trap as the guard's allowlist, and a long ignore list means this harness is lying too.
 */
export function unmarkedStrings(root: HTMLElement, ignore: readonly string[] = []): string[] {
  const skip = (text: string) => {
    const t = text.trim();
    if (!t) return true;
    // EITHER marker, not just the opening one. `tNodes` renders a message with markup placeholders by
    // splitting it into segments, so one marked message becomes several text nodes and only the first
    // carries `⟦` while only the last carries `⟧` — the middle ones carry neither and are matched by
    // their siblings' markers being present in the same message, which is why the check is per-marker
    // rather than per-pair. Requiring `⟦` reported every trailing segment ("a topic to rename it⟧") as
    // if it were hardcoded. A marker can only come from the overlay, so seeing one is proof enough.
    if (t.includes(MARK_OPEN) || t.includes(MARK_CLOSE)) return true;
    if (!/\p{Letter}/u.test(t)) return true; // glyphs, digits, punctuation
    return ignore.some((allowed) => t.includes(allowed));
  };

  const found = new Set<string>();

  for (const el of root.querySelectorAll<HTMLElement>("*")) {
    for (const attr of USER_FACING_ATTRS) {
      const value = el.getAttribute(attr);
      if (value && !skip(value)) found.add(`${attr}="${value.trim()}"`);
    }
  }

  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = node.textContent ?? "";
    if (!skip(text)) found.add(`text: ${text.trim()}`);
    node = walker.nextNode();
  }

  return [...found].sort();
}
