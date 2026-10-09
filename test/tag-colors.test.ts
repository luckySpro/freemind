import { describe, expect, it } from "vitest";
import type { ConditionalRule, MapNode } from "../src/model/types";
import { matchesRule } from "../src/rules";
import { setTagColor, tagColor, tagColorMap } from "../src/tagColors";

const node = (tags: string[]): MapNode => ({ id: "n", topic: "N", tags, children: [] });

describe("tagColors", () => {
  it("setTagColor upserts a kind:tag rule whose background tints matching topics", () => {
    const rules = setTagColor(undefined, "risk", "#ff0000");
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      kind: "tag",
      value: "risk",
      style: { background: "#ff0000" },
    });
    // The rule actually matches a topic carrying the tag.
    expect(matchesRule(node(["risk"]), rules[0])).toBe(true);
    expect(matchesRule(node(["other"]), rules[0])).toBe(false);
  });

  it("re-colouring a tag replaces its rule (no stacking) and reads back via tagColor", () => {
    let rules = setTagColor(undefined, "risk", "#ff0000");
    rules = setTagColor(rules, "risk", "#00ff00");
    expect(rules).toHaveLength(1);
    expect(tagColor(rules, "risk")).toBe("#00ff00");
  });

  it("setTagColor with an empty colour clears the tag's rule but leaves others", () => {
    let rules = setTagColor(undefined, "risk", "#ff0000");
    rules = setTagColor(rules, "idea", "#0000ff");
    rules = setTagColor(rules, "risk", undefined);
    expect(tagColor(rules, "risk")).toBeUndefined();
    expect(tagColor(rules, "idea")).toBe("#0000ff");
  });

  it("does not disturb unrelated hand-built rules", () => {
    const manual: ConditionalRule = {
      id: "manual-1",
      kind: "tag",
      value: "risk",
      style: { border: "#000000" },
    };
    const rules = setTagColor([manual], "risk", "#ff0000");
    expect(rules).toHaveLength(2);
    expect(rules.find((r) => r.id === "manual-1")).toBe(manual);
  });

  it("tagColorMap returns every mapped tag → colour pair", () => {
    let rules = setTagColor(undefined, "risk", "#ff0000");
    rules = setTagColor(rules, "idea", "#0000ff");
    expect(tagColorMap(rules)).toEqual({ risk: "#ff0000", idea: "#0000ff" });
  });
});
