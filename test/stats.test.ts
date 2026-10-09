import { describe, expect, it } from "vitest";
import type { MindMapDoc } from "../src/model/types";
import { countWords, mapStats } from "../src/stats";

// mapStats summarises a map in one walk — structure, task health, and content tallies — for the
// Map-statistics panel. Pure + deterministic (overdue is anchored on the passed `today`).
const doc = (): MindMapDoc => ({
  schemaVersion: 1,
  id: "d",
  title: "Root",
  root: {
    id: "r",
    topic: "Root",
    children: [
      {
        id: "a",
        topic: "Alpha",
        note: "a note",
        tags: ["x"],
        icons: ["⭐"],
        task: { progress: 1, due: "2026-01-01" },
        attachments: [{ name: "f.pdf", dataUrl: "data:,", size: 1 }],
        children: [
          {
            id: "a1",
            topic: "A1",
            tags: ["x", "y"],
            task: { progress: 0.5, due: "2026-01-01" },
            children: [],
          },
        ],
      },
      { id: "b", topic: "Bravo", icons: ["❗"], children: [] },
    ],
  },
  links: [{ id: "l", from: "a", to: "b" }],
  boundaries: [{ id: "bd", nodeIds: ["a", "b"], label: "g" }],
  floatingTopics: [{ id: "f", topic: "Float", children: [] }],
});

describe("mapStats", () => {
  it("counts structure, tasks, and content in a single pass", () => {
    const s = mapStats(doc(), "2026-06-21");
    expect(s.topics).toBe(4); // r, a, a1, b
    expect(s.leaves).toBe(2); // a1, b
    expect(s.maxDepth).toBe(2); // a1
    expect(s.floating).toBe(1);
    expect(s.tasks).toBe(2); // a, a1
    expect(s.completed).toBe(1); // a
    expect(s.overdue).toBe(1); // a1 (past due, 50%)
    expect(s.completion).toBeCloseTo(0.5);
    expect(s.notes).toBe(1);
    expect(s.attachments).toBe(1);
    expect(s.tags).toBe(2); // x, y
    expect(s.markers).toBe(2); // ⭐, ❗
    expect(s.links).toBe(1);
    expect(s.boundaries).toBe(1);
    // words: Root(1) + Alpha(1)+"a note"(2) + A1(1) + Bravo(1) = 6 → <200 so ~1 min
    expect(s.words).toBe(6);
    expect(s.readingMinutes).toBe(1);
  });

  it("counts words across titles + notes and rounds reading time up", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("  ")).toBe(0);
    expect(countWords("one two   three")).toBe(3);
    const big = Array.from({ length: 250 }, () => "w").join(" ");
    const s = mapStats({
      schemaVersion: 1,
      id: "w",
      title: "R",
      root: { id: "r", topic: "R", note: big, children: [] },
    });
    expect(s.words).toBe(251); // "R" + 250 note words
    expect(s.readingMinutes).toBe(2); // ceil(251/200)
  });

  it("reports zero completion + no overdue for a task-free map", () => {
    const s = mapStats({
      schemaVersion: 1,
      id: "e",
      title: "E",
      root: { id: "r", topic: "R", children: [] },
    });
    expect(s.tasks).toBe(0);
    expect(s.completion).toBe(0);
    expect(s.overdue).toBe(0);
    expect(s.topics).toBe(1);
  });
});
