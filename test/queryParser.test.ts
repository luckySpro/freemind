import { describe, expect, it } from "vitest";
import { parseQuery } from "../src/queryParser";

describe("parseQuery", () => {
  it("treats a plain query as a single non-scoped free-text term", () => {
    const p = parseQuery("market research");
    expect(p.scoped).toBe(false);
    expect(p.include).toEqual(["market", "research"]);
    expect(p.exclude).toEqual([]);
  });

  it("parses tag / marker / priority / due / has operators", () => {
    const p = parseQuery("tag:urgent marker:flag-red priority:2 due:overdue has:note");
    expect(p.scoped).toBe(true);
    expect(p.tags).toEqual(["urgent"]);
    expect(p.markers).toEqual(["flag-red"]);
    expect(p.priority).toBe(2);
    expect(p.due).toBe("overdue");
    expect(p.has).toEqual(["note"]);
    expect(p.include).toEqual([]);
  });

  it("parses exclusions and quoted phrases", () => {
    const p = parseQuery('"exact phrase" -draft hello');
    expect(p.scoped).toBe(true);
    expect(p.include).toEqual(["exact phrase", "hello"]);
    expect(p.exclude).toEqual(["draft"]);
  });

  it("parses level bounds (exact, >=, <=, >, <)", () => {
    expect(parseQuery("level:2")).toMatchObject({ minLevel: 2, maxLevel: 2, scoped: true });
    expect(parseQuery("level:>=2")).toMatchObject({ minLevel: 2, scoped: true });
    expect(parseQuery("level:<=3")).toMatchObject({ maxLevel: 3, scoped: true });
    expect(parseQuery("level:>1")).toMatchObject({ minLevel: 2 });
    expect(parseQuery("level:<4")).toMatchObject({ maxLevel: 3 });
  });

  it("falls back to literal text for an unknown operator or invalid value", () => {
    expect(parseQuery("foo:bar")).toMatchObject({ scoped: false, include: ["foo:bar"] });
    expect(parseQuery("priority:high")).toMatchObject({
      scoped: false,
      include: ["priority:high"],
    });
    expect(parseQuery("due:whenever")).toMatchObject({ scoped: false, include: ["due:whenever"] });
  });

  it('lower-cases operator values and supports tag:"quoted value"', () => {
    const p = parseQuery('tag:"Red Team"');
    expect(p.scoped).toBe(true);
    expect(p.tags).toEqual(["red team"]);
  });
});
