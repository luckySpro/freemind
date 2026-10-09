import { describe, expect, it } from "vitest";
import type { ConditionalRule, MapNode } from "../src/model/types";
import {
  conditionalActions,
  conditionalStyle,
  describeRule,
  describeRuleActions,
  matchesRule,
  relationshipTypeIndex,
} from "../src/rules";

const node = (over: Partial<MapNode> = {}): MapNode => ({
  id: "n",
  topic: "N",
  children: [],
  ...over,
});

const rule = (over: Partial<ConditionalRule>): ConditionalRule => ({
  id: "r",
  kind: "tag",
  value: "risk",
  style: { border: "2px solid #e23b3b" },
  ...over,
});

describe("matchesRule", () => {
  it("matches by tag / marker", () => {
    expect(matchesRule(node({ tags: ["risk"] }), rule({ kind: "tag", value: "risk" }))).toBe(true);
    expect(matchesRule(node({ tags: ["ok"] }), rule({ kind: "tag", value: "risk" }))).toBe(false);
    expect(matchesRule(node({ icons: ["❗"] }), rule({ kind: "marker", value: "❗" }))).toBe(true);
    expect(matchesRule(node({ icons: ["⭐"] }), rule({ kind: "marker", value: "❗" }))).toBe(false);
  });

  it("never matches a tag/marker rule with an empty value", () => {
    expect(matchesRule(node({ tags: ["risk"] }), rule({ kind: "tag", value: "" }))).toBe(false);
    expect(matchesRule(node({ icons: ["❗"] }), rule({ kind: "marker", value: undefined }))).toBe(
      false,
    );
  });

  it("matches 'completed' against effective progress (1 = done)", () => {
    const r = rule({ kind: "completed", value: undefined });
    expect(matchesRule(node(), r, 1)).toBe(true);
    expect(matchesRule(node(), r, 0.5)).toBe(false);
    expect(matchesRule(node(), r, undefined)).toBe(false);
  });

  it("matches 'overdue' (past due + unfinished) against the given today", () => {
    const r = rule({ kind: "overdue", value: undefined });
    const overdue = node({ task: { due: "2026-01-01", progress: 0.5 } });
    expect(matchesRule(overdue, r, 0.5, "2026-06-21")).toBe(true);
    // finished → not overdue; future due → not overdue
    expect(
      matchesRule(node({ task: { due: "2026-01-01", progress: 1 } }), r, 1, "2026-06-21"),
    ).toBe(false);
    expect(matchesRule(node({ task: { due: "2026-12-31" } }), r, 0, "2026-06-21")).toBe(false);
  });

  it("matches 'priority' at or above a threshold (1=High; priority ≤ value)", () => {
    expect(
      matchesRule(node({ task: { priority: 1 } }), rule({ kind: "priority", value: "2" })),
    ).toBe(true);
    expect(
      matchesRule(node({ task: { priority: 3 } }), rule({ kind: "priority", value: "2" })),
    ).toBe(false);
    // no priority, or non-numeric threshold → no match
    expect(matchesRule(node(), rule({ kind: "priority", value: "2" }))).toBe(false);
    expect(
      matchesRule(node({ task: { priority: 1 } }), rule({ kind: "priority", value: "" })),
    ).toBe(false);
  });

  it("matches 'textContains' (case-insensitive) and 'hasAttachment'", () => {
    expect(
      matchesRule(
        node({ topic: "Quarterly Budget" }),
        rule({ kind: "textContains", value: "budget" }),
      ),
    ).toBe(true);
    expect(
      matchesRule(node({ topic: "Roadmap" }), rule({ kind: "textContains", value: "budget" })),
    ).toBe(false);
    const withFile = node({
      attachments: [{ name: "a.pdf", dataUrl: "data:,", size: 1 }],
    });
    expect(matchesRule(withFile, rule({ kind: "hasAttachment", value: undefined }))).toBe(true);
    expect(matchesRule(node(), rule({ kind: "hasAttachment", value: undefined }))).toBe(false);
  });

  it("matches 'dueSoon' (due within the window, unfinished) against the given today", () => {
    const r = rule({ kind: "dueSoon", value: undefined });
    const soon = node({ task: { due: "2026-06-25", progress: 0.5 } });
    expect(matchesRule(soon, r, 0.5, "2026-06-21")).toBe(true);
    // already overdue, already finished, or too far out → not "due soon"
    expect(matchesRule(node({ task: { due: "2026-01-01" } }), r, 0, "2026-06-21")).toBe(false);
    expect(
      matchesRule(node({ task: { due: "2026-06-25", progress: 1 } }), r, 1, "2026-06-21"),
    ).toBe(false);
    expect(matchesRule(node({ task: { due: "2026-12-31" } }), r, 0, "2026-06-21")).toBe(false);
  });

  it("negate inverts the primary condition", () => {
    const r = rule({ kind: "tag", value: "risk", negate: true });
    expect(matchesRule(node({ tags: ["risk"] }), r)).toBe(false);
    expect(matchesRule(node({ tags: ["ok"] }), r)).toBe(true);
    expect(matchesRule(node(), r)).toBe(true);
  });

  it("also AND-combines extra conditions, each independently negatable", () => {
    const r = rule({
      kind: "tag",
      value: "risk",
      also: [{ kind: "priority", value: "1" }],
    });
    // tag matches AND priority 1 matches → true
    expect(matchesRule(node({ tags: ["risk"], task: { priority: 1 } }), r)).toBe(true);
    // tag matches but priority doesn't → false
    expect(matchesRule(node({ tags: ["risk"], task: { priority: 3 } }), r)).toBe(false);
    // tag doesn't match at all → false regardless of the AND clause
    expect(matchesRule(node({ tags: ["ok"], task: { priority: 1 } }), r)).toBe(false);

    const withNegatedAlso = rule({
      kind: "tag",
      value: "risk",
      also: [{ kind: "hasAttachment", negate: true }],
    });
    // tag matches AND NOT hasAttachment → true
    expect(matchesRule(node({ tags: ["risk"] }), withNegatedAlso)).toBe(true);
    // tag matches but DOES have an attachment → false (negated clause fails)
    expect(
      matchesRule(
        node({ tags: ["risk"], attachments: [{ name: "a", dataUrl: "data:,", size: 1 }] }),
        withNegatedAlso,
      ),
    ).toBe(false);
  });
});

describe("conditionalStyle", () => {
  it("merges every matching rule, later rules winning per-property", () => {
    const rules: ConditionalRule[] = [
      rule({
        id: "a",
        kind: "tag",
        value: "risk",
        style: { border: "2px solid #e23b3b", background: "#fee" },
      }),
      rule({ id: "b", kind: "completed", value: undefined, style: { background: "#efe" } }),
    ];
    // tag-only (progress 0.5): just the first rule.
    expect(conditionalStyle(node({ tags: ["risk"] }), rules, 0.5)).toEqual({
      border: "2px solid #e23b3b",
      background: "#fee",
    });
    // both match (progress 1): the completed rule's background wins, border kept.
    expect(conditionalStyle(node({ tags: ["risk"] }), rules, 1)).toEqual({
      border: "2px solid #e23b3b",
      background: "#efe",
    });
  });

  it("returns undefined when nothing matches", () => {
    expect(conditionalStyle(node(), [rule({})], 0)).toBeUndefined();
  });
});

describe("conditionalActions", () => {
  it("unions markers across matches (deduped) and takes the last branchColor", () => {
    const rules: ConditionalRule[] = [
      rule({ id: "a", kind: "tag", value: "risk", icons: ["🚩", "❗"], branchColor: "#e23b3b" }),
      rule({
        id: "b",
        kind: "overdue",
        value: undefined,
        icons: ["❗", "⏰"],
        branchColor: "#f4b400",
      }),
    ];
    // only the tag rule matches (progress 0.5, no due date)
    expect(conditionalActions(node({ tags: ["risk"] }), rules, 0.5)).toEqual({
      icons: ["🚩", "❗"],
      branchColor: "#e23b3b",
    });
    // both match: markers union (deduped), last branchColor wins
    const overdue = node({ tags: ["risk"], task: { due: "2026-01-01", progress: 0.5 } });
    expect(conditionalActions(overdue, rules, 0.5, "2026-06-21")).toEqual({
      icons: ["🚩", "❗", "⏰"],
      branchColor: "#f4b400",
    });
  });

  it("returns empty icons + undefined branchColor when nothing matches or no actions are set", () => {
    expect(conditionalActions(node(), [rule({})], 0)).toEqual({
      icons: [],
      branchColor: undefined,
    });
    // a matching rule with only a style (no action fields) yields no actions
    expect(conditionalActions(node({ tags: ["risk"] }), [rule({})], 0)).toEqual({
      icons: [],
      branchColor: undefined,
    });
  });
});

describe("describeRuleActions", () => {
  it("suffixes applied markers + a colour note, or '' when none", () => {
    expect(describeRuleActions(rule({ icons: ["🚩"], branchColor: "#e23b3b" }))).toBe(
      " → 🚩 colour",
    );
    expect(describeRuleActions(rule({ icons: ["🚩", "❗"] }))).toBe(" → 🚩 ❗");
    expect(describeRuleActions(rule({ branchColor: "#e23b3b" }))).toBe(" → colour");
    expect(describeRuleActions(rule({}))).toBe("");
  });
});

describe("describeRule", () => {
  it("labels each condition", () => {
    expect(describeRule(rule({ kind: "tag", value: "risk" }))).toBe("tag risk");
    expect(describeRule(rule({ kind: "marker", value: "❗" }))).toBe("marker ❗");
    expect(describeRule(rule({ kind: "completed", value: undefined }))).toBe("completed (100%)");
    expect(describeRule(rule({ kind: "overdue", value: undefined }))).toBe("overdue");
    expect(describeRule(rule({ kind: "hasAttachment", value: undefined }))).toBe("has attachment");
    expect(describeRule(rule({ kind: "priority", value: "2" }))).toBe("priority ≤ 2 (1=High)");
    expect(describeRule(rule({ kind: "textContains", value: "x" }))).toBe('text contains "x"');
    expect(describeRule(rule({ kind: "relationshipType", value: "causes" }))).toBe(
      "relationship: causes",
    );
    expect(describeRule(rule({ kind: "relationshipType", value: undefined }))).toBe(
      "has a relationship",
    );
    expect(describeRule(rule({ kind: "dueSoon", value: undefined }))).toBe("due soon");
  });

  it("prefixes a negated primary condition with 'NOT'", () => {
    expect(describeRule(rule({ kind: "overdue", value: undefined, negate: true }))).toBe(
      "NOT overdue",
    );
  });

  it("AND-joins 'also' clauses, each independently negated", () => {
    expect(
      describeRule(
        rule({
          kind: "tag",
          value: "risk",
          also: [
            { kind: "priority", value: "1" },
            { kind: "hasAttachment", negate: true },
          ],
        }),
      ),
    ).toBe("tag risk AND priority ≤ 1 (1=High) AND NOT has attachment");
  });
});

describe("relationshipType rule (B3)", () => {
  it("indexes each node by the relationship types it is an endpoint of", () => {
    const idx = relationshipTypeIndex([
      { id: "a", from: "n1", to: "n2", type: "causes" },
      { id: "b", from: "n2", to: "n3" }, // untyped → relates-to
    ]);
    expect([...(idx.get("n1") ?? [])]).toEqual(["causes"]);
    expect([...(idx.get("n2") ?? [])].sort()).toEqual(["causes", "relates-to"]);
    expect([...(idx.get("n3") ?? [])]).toEqual(["relates-to"]);
    expect(idx.get("nX")).toBeUndefined();
  });

  it("matches a node touching a relationship of the given type (or any when blank)", () => {
    const r = (value?: string) => rule({ kind: "relationshipType", value });
    expect(matchesRule(node(), r("causes"), undefined, undefined, new Set(["causes"]))).toBe(true);
    expect(matchesRule(node(), r("blocks"), undefined, undefined, new Set(["causes"]))).toBe(false);
    expect(matchesRule(node(), r(), undefined, undefined, new Set(["relates-to"]))).toBe(true);
    // No relationship context (undefined set) → never matches.
    expect(matchesRule(node(), r("causes"), undefined, undefined, undefined)).toBe(false);
  });
});
