import { describe, expect, it } from "vitest";
import { MAP_PARTS, buildMapPart } from "../src/mapParts";

// Map parts are ready-made mini-structures grafted under a topic; each must build a valid forest with
// a labelled parent + prompts and unique ids (the graft op re-ids, but they must be self-consistent).
describe("map parts", () => {
  it("every part builds a single labelled parent with child prompts", () => {
    for (const part of MAP_PARTS) {
      const forest = part.build();
      expect(forest).toHaveLength(1);
      const root = forest[0];
      expect(root.topic.length).toBeGreaterThan(0);
      expect(root.children.length).toBeGreaterThan(1);
      for (const c of root.children) expect(c.children).toEqual([]);
    }
  });

  it("ids within a part are unique", () => {
    for (const part of MAP_PARTS) {
      const ids: string[] = [];
      const walk = (n: { id: string; children: { id: string; children: unknown[] }[] }) => {
        ids.push(n.id);
        for (const c of n.children) walk(c as never);
      };
      for (const n of part.build()) walk(n as never);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("buildMapPart finds a part or returns null", () => {
    expect(buildMapPart("swot")?.[0].topic).toBe("SWOT");
    expect(buildMapPart("5w1h")?.[0].children.map((c) => c.topic)).toEqual([
      "Who",
      "What",
      "When",
      "Where",
      "Why",
      "How",
    ]);
    expect(buildMapPart("nope")).toBeNull();
  });
});
