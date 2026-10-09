import type { ReactNode } from "react";
import { Fragment, createElement } from "react";
import type { MessageKey } from "./keys";
import { type MessageVars, t } from "./registry";

// Messages that interleave prose with MARKUP — `Press <kbd>Tab</kbd> for a child`.
//
// WHY t() ALONE CANNOT DO THIS. `t()` returns a string, so the only way to keep the `<kbd>` styling
// with a plain call is to cut the sentence into fragments around it:
//
//   Press <kbd>Tab</kbd> for a child     ->  "Press" + <kbd>Tab</kbd> + "for a child"
//
// which hands a translator three pieces in a fixed order and no way to reorder them. Most languages
// need to. German pushes the verb to the end, Japanese puts the particle after the key name, and
// several languages would want the key first. Three separate messages also give the translator no
// clue they belong to one sentence. The fragments are individually untranslatable in the strict
// sense: "Press" alone has no single correct rendering.
//
// So the message stays ONE string with placeholders, and the placeholders resolve to React nodes:
//
//   "canvas.coach.editKeys": "Press {child} for a child · {sibling} for a sibling · double-click to rename"
//   tNodes("canvas.coach.editKeys", { child: <kbd>Tab</kbd>, sibling: <kbd>Enter</kbd> })
//
// A translator now sees the whole sentence, can put {child} anywhere in it, and the `<kbd>` styling
// survives. Note the KEY NAMES themselves stay literal in the JSX, not in the catalogue: `Tab` and
// `Enter` denote physical keys, and a locale does not rename them. That is existing policy — see the
// keyboard cheat sheet in i18n/core.ts.
//
// IMPORTS: `./registry`, never the `i18n` barrel. The barrel side-effect-imports the eager core
// catalogue, so a lazy chunk importing it would drag the whole thing into that chunk. This helper is
// used from the canvas chunk, which is exactly that case.

/**
 * A message rendered with `{placeholder}`s replaced by React nodes.
 *
 * `nodes` maps a placeholder name to what it renders as. Any placeholder NOT in `nodes` falls back to
 * `vars`, and one in neither is left as its literal `{name}` — the same forgiving behaviour `t()` has,
 * so a typo shows up as visible text rather than a blank.
 *
 * A placeholder may appear more than once; each occurrence renders its own copy of the node.
 */
export function tNodes(
  key: MessageKey,
  nodes: Readonly<Record<string, ReactNode>>,
  vars?: MessageVars,
): ReactNode {
  // Resolve plurals but NOT the string vars: `n` picks the form (and fills its own `{n}`), while the
  // rest are interpolated below, per text segment. Doing it in that order matters — interpolating
  // everything up front would let a var whose VALUE happened to contain `{child}` be re-read as a node
  // placeholder, so user data could inject markup. Splitting first makes that impossible.
  const template = t(key, vars?.n === undefined ? undefined : { n: vars.n });

  const parts = template.split(/(\{\w+\})/g);
  const children: ReactNode[] = [];

  for (const [index, part] of parts.entries()) {
    if (!part) continue;
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    if (name === undefined) {
      children.push(part);
      continue;
    }
    if (name in nodes) {
      // Keyed by position: the same placeholder can appear twice and React needs the two occurrences
      // to be distinct children.
      children.push(createElement(Fragment, { key: `${name}-${index}` }, nodes[name]));
      continue;
    }
    children.push(vars && name in vars ? String(vars[name]) : part);
  }

  return createElement(Fragment, null, ...children);
}
