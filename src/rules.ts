import type {
  ConditionalRule,
  CrossLink,
  MapNode,
  NodeStyle,
  RuleConditionKind,
} from "./model/types";
import { isDueSoon, isOverdue, todayISO } from "./taskDate";

/** Build `nodeId → set of relationship types it is an endpoint of` (source OR target), resolving an
 *  absent `CrossLink.type` to "relates-to". Feeds the "relationshipType" conditional rule. Pure. */
export function relationshipTypeIndex(links: CrossLink[] = []): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  const add = (id: string, type: string) => {
    const set = index.get(id) ?? new Set<string>();
    set.add(type);
    index.set(id, set);
  };
  for (const l of links) {
    const type = l.type ?? "relates-to";
    add(l.from, type);
    add(l.to, type);
  }
  return index;
}

// Conditional formatting: given a node + the map's rules, compute the style that should be layered
// onto it (view-only — never written to the node). A rule matches by tag, marker, "completed" (task
// at 100%), "overdue" (past due + unfinished), "priority" (at/above a threshold), "textContains", or
// "hasAttachment"; later matching rules win on a per-property basis. Pure + unit-tested; the
// projection merges this *under* the node's own explicit style, so manual styling still wins.

/** Does a node match a single condition (a rule's primary `kind`/`value`, or one of its `also`
 *  clauses)? Shared by `matchesRule` for both. Pure. */
function matchesCondition(
  node: MapNode,
  kind: RuleConditionKind,
  value: string | undefined,
  progress: number | undefined,
  today: string,
  relTypes: Set<string> | undefined,
): boolean {
  switch (kind) {
    case "tag":
      return !!value && (node.tags?.includes(value) ?? false);
    case "marker":
      return !!value && (node.icons?.includes(value) ?? false);
    case "completed":
      return (progress ?? 0) >= 1;
    case "overdue":
      return isOverdue(node.task?.due, progress, today);
    case "dueSoon":
      return isDueSoon(node.task?.due, progress, today);
    case "priority": {
      const threshold = Number(value);
      const p = node.task?.priority;
      return p !== undefined && Number.isFinite(threshold) && p <= threshold;
    }
    case "textContains":
      return !!value && node.topic.toLowerCase().includes(value.toLowerCase());
    case "hasAttachment":
      return (node.attachments?.length ?? 0) > 0;
    case "relationshipType":
      // A blank value matches any relationship endpoint; a set value matches that specific type.
      return !!relTypes && (value ? relTypes.has(value) : relTypes.size > 0);
    default:
      return false;
  }
}

/** Does a node match a rule? The primary `kind`/`value` (inverted by `negate`) must match, AND every
 *  clause in `also` (each independently inverted by its own `negate`) — an empty/absent `also` is the
 *  pre-AND/NOT behaviour, unchanged. `progress` is the node's effective (rolled-up) completion 0..1;
 *  `today` (ISO) anchors the "overdue"/"dueSoon" checks — defaulted so callers needn't thread it,
 *  overridable for deterministic tests. Pure. */
export function matchesRule(
  node: MapNode,
  rule: ConditionalRule,
  progress?: number,
  today: string = todayISO(),
  /** The set of relationship types this node is an endpoint of (from relationshipTypeIndex); required
   *  for a "relationshipType" rule to match, absent → that rule never matches. */
  relTypes?: Set<string>,
): boolean {
  const primary = matchesCondition(node, rule.kind, rule.value, progress, today, relTypes);
  if ((rule.negate ? !primary : primary) === false) return false;
  if (!rule.also?.length) return true;
  return rule.also.every((c) => {
    const m = matchesCondition(node, c.kind, c.value, progress, today, relTypes);
    return c.negate ? !m : m;
  });
}

/** Merge the styles of every rule a node matches (later rules win per-property), or undefined. */
export function conditionalStyle(
  node: MapNode,
  rules: ConditionalRule[],
  progress?: number,
  today: string = todayISO(),
  relTypes?: Set<string>,
): NodeStyle | undefined {
  let merged: NodeStyle | undefined;
  for (const rule of rules) {
    if (matchesRule(node, rule, progress, today, relTypes)) merged = { ...merged, ...rule.style };
  }
  return merged;
}

/** The non-style *actions* a node's matching rules apply (view-only, like `conditionalStyle`): markers
 *  are **unioned** across every match (deduped, first-seen order), and `branchColor` is **last-match
 *  wins**. Returns empty `icons` + undefined `branchColor` when nothing applies. Pure + unit-tested. */
export function conditionalActions(
  node: MapNode,
  rules: ConditionalRule[],
  progress?: number,
  today: string = todayISO(),
  relTypes?: Set<string>,
): { icons: string[]; branchColor?: string } {
  const icons: string[] = [];
  let branchColor: string | undefined;
  for (const rule of rules) {
    if (!matchesRule(node, rule, progress, today, relTypes)) continue;
    for (const ic of rule.icons ?? []) if (!icons.includes(ic)) icons.push(ic);
    if (rule.branchColor) branchColor = rule.branchColor;
  }
  return { icons, branchColor };
}

/** A short human label for one condition (no negation/AND — that's layered on by `describeRule`). */
function describeCondition(kind: RuleConditionKind, value: string | undefined): string {
  switch (kind) {
    case "completed":
      return "completed (100%)";
    case "overdue":
      return "overdue";
    case "dueSoon":
      return "due soon";
    case "hasAttachment":
      return "has attachment";
    case "priority":
      return `priority ≤ ${value ?? "?"} (1=High)`;
    case "textContains":
      return `text contains "${value ?? ""}"`;
    case "relationshipType":
      return value ? `relationship: ${value}` : "has a relationship";
    default:
      return `${kind} ${value ?? ""}`.trim();
  }
}

/** A short human label for a rule's full condition set: the primary clause (negated with a "NOT "
 *  prefix if `rule.negate`), AND-ed with every `also` clause (each independently negatable). */
export function describeRule(rule: ConditionalRule): string {
  const primary = describeCondition(rule.kind, rule.value);
  const parts = [rule.negate ? `NOT ${primary}` : primary];
  for (const c of rule.also ?? []) {
    const d = describeCondition(c.kind, c.value);
    parts.push(c.negate ? `NOT ${d}` : d);
  }
  return parts.join(" AND ");
}

/** A short "→ actions" suffix for the rules list (markers + branch colour applied), or "" if none. */
export function describeRuleActions(rule: ConditionalRule): string {
  const parts: string[] = [];
  if (rule.icons?.length) parts.push(rule.icons.join(" "));
  if (rule.branchColor) parts.push("colour");
  return parts.length ? ` → ${parts.join(" ")}` : "";
}
