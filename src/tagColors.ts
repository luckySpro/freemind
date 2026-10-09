import type { ConditionalRule } from "./model/types";

// Tag → colour mapping: a thin convenience over the conditional-rule engine. Assigning a tag a
// colour is just an upserted `kind:"tag"` rule whose `style.background` tints every topic carrying
// that tag (and feeds the legend). Kept pure so the tag manager can read / set colours without
// touching the rule list directly, and so re-colouring a tag replaces (never stacks) its rule.
// Each tag's rule has a stable, namespaced id so these convenience rules are distinguishable from
// hand-built tag rules in the Styles panel.

const PREFIX = "tag-color:";

/** A stable id for a tag's colour rule, so re-colouring replaces (not stacks) the rule. */
function ruleId(tag: string): string {
  return `${PREFIX}${tag}`;
}

/** The colour currently mapped to a tag (its tag-colour rule's background), or undefined. */
export function tagColor(rules: ConditionalRule[] | undefined, tag: string): string | undefined {
  return rules?.find((r) => r.id === ruleId(tag))?.style.background;
}

/** Upsert (colour set) or remove (colour empty / undefined) a tag's colour rule, returning a new
 *  rule list. Pure — never mutates the input. */
export function setTagColor(
  rules: ConditionalRule[] | undefined,
  tag: string,
  color: string | undefined,
): ConditionalRule[] {
  const rest = (rules ?? []).filter((r) => r.id !== ruleId(tag));
  if (!color) return rest;
  const rule: ConditionalRule = {
    id: ruleId(tag),
    kind: "tag",
    value: tag,
    style: { background: color },
  };
  return [...rest, rule];
}

/** Every tag → colour pair currently mapped (for a legend / swatch summary). */
export function tagColorMap(rules: ConditionalRule[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rules ?? []) {
    if (r.id.startsWith(PREFIX) && r.value && r.style.background) out[r.value] = r.style.background;
  }
  return out;
}
