import { describe, expect, it } from "vitest";
import { setRollup } from "../src/mindmap/flow/ops";
import type { MindMapDoc } from "../src/model/types";
import { refreshRollups } from "../src/rollup";

const mapDoc = (id: string, title: string, childTopics: string[]): MindMapDoc => ({
  schemaVersion: 1,
  id,
  title,
  root: {
    id: `${id}-root`,
    topic: title,
    children: childTopics.map((t, i) => ({ id: `${id}-${i}`, topic: t, children: [] })),
  },
});

const base = (): MindMapDoc => ({
  schemaVersion: 1,
  id: "main",
  title: "Main",
  root: { id: "r", topic: "Main", children: [{ id: "a", topic: "A", children: [] }] },
});

describe("refreshRollups", () => {
  it("pulls a bound node's source-map branches", async () => {
    const doc = setRollup(base(), "a", "q3").doc;
    const load = async (id: string) =>
      id === "q3" ? mapDoc("q3", "Q3 Plan", ["Goals", "Risks"]) : null;
    const res = await refreshRollups(doc, load);
    expect(res.count).toBe(1);
    expect(res.missing).toEqual([]);
    const a = res.doc.root.children.find((c) => c.id === "a");
    expect(a?.children.map((c) => c.topic)).toEqual(["Goals", "Risks"]);
  });

  it("reports a missing source and leaves the bound node untouched", async () => {
    const doc = setRollup(base(), "a", "gone").doc;
    const res = await refreshRollups(doc, async () => null);
    expect(res.count).toBe(0);
    expect(res.missing).toEqual(["gone"]);
  });

  it("skips a self-referential roll-up (never loads its own map id)", async () => {
    const doc = setRollup(base(), "a", "main").doc; // points at its own map id
    let loads = 0;
    const res = await refreshRollups(doc, async (id) => {
      loads++;
      return mapDoc(id, id, ["x"]);
    });
    expect(loads).toBe(0);
    expect(res.count).toBe(0);
  });

  it("is a no-op (same doc ref) when there are no roll-ups", async () => {
    const doc = base();
    const res = await refreshRollups(doc, async () => mapDoc("x", "x", ["y"]));
    expect(res).toEqual({ doc, count: 0, missing: [] });
    expect(res.doc).toBe(doc);
  });
});
