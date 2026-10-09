import { describe, expect, it } from "vitest";
import { agendaBuckets, agendaIsEmpty } from "../src/agenda";
import type { MindMapDoc } from "../src/model/types";

// agendaBuckets is the pure selector behind the Agenda panel: it walks the root tree + floating
// topics and buckets every dated, unfinished task into overdue / today / this-week. `today` is
// injected so the buckets are deterministic.

const TODAY = "2026-06-24";

const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "Plan",
  root: {
    id: "r",
    topic: "Root",
    children: [
      {
        id: "past",
        topic: "Overdue task",
        task: { due: "2026-06-20", progress: 0.5 },
        children: [],
      },
      { id: "older", topic: "Older overdue", task: { due: "2026-06-10" }, children: [] },
      { id: "now", topic: "Due today", task: { due: TODAY }, children: [] },
      { id: "soon", topic: "Due this week", task: { due: "2026-06-28" }, children: [] },
      { id: "edge", topic: "Due day 7", task: { due: "2026-07-01" }, children: [] },
      { id: "later", topic: "Beyond a week", task: { due: "2026-07-10" }, children: [] },
      { id: "done", topic: "Done overdue", task: { due: "2026-06-01", progress: 1 }, children: [] },
      { id: "undated", topic: "No date", task: { progress: 0 }, children: [] },
      { id: "plain", topic: "Not a task", children: [] },
    ],
  },
  floatingTopics: [
    { id: "float", topic: "Floating overdue", task: { due: "2026-06-22" }, children: [] },
  ],
};

describe("agendaBuckets", () => {
  it("buckets dated, unfinished tasks into overdue / today / this week / later", () => {
    const b = agendaBuckets(doc, TODAY);
    expect(b.overdue.map((i) => i.id)).toEqual(["older", "past", "float"]); // oldest-first
    expect(b.today.map((i) => i.id)).toEqual(["now"]);
    expect(b.thisWeek.map((i) => i.id)).toEqual(["soon", "edge"]); // tomorrow..+7, soonest-first
    expect(b.later.map((i) => i.id)).toEqual(["later"]); // beyond +7, kept (not dropped)
  });

  it("excludes completed, undated, and non-task topics", () => {
    const ids = Object.values(agendaBuckets(doc, TODAY))
      .flat()
      .map((i) => i.id);
    expect(ids).not.toContain("done"); // progress = 1
    expect(ids).not.toContain("undated"); // no due date
    expect(ids).not.toContain("plain"); // no task
  });

  it("reports empty when nothing is due", () => {
    const bare: MindMapDoc = {
      ...doc,
      root: { id: "r", topic: "R", children: [] },
      floatingTopics: [],
    };
    const b = agendaBuckets(bare, TODAY);
    expect(agendaIsEmpty(b)).toBe(true);
    expect(agendaIsEmpty(agendaBuckets(doc, TODAY))).toBe(false);
  });
});
