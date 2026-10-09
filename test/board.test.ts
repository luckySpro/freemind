import { describe, expect, it } from "vitest";
import {
  UNTAGGED,
  boardColumns,
  bucketDueDate,
  buildBoard,
  reMarkForMove,
  retagForMove,
  scheduleBucketOf,
} from "../src/board";
import type { MindMapDoc } from "../src/model/types";

const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "T",
  root: {
    id: "r",
    topic: "Root",
    children: [
      {
        id: "a",
        topic: "Alpha",
        tags: ["now"],
        task: { progress: 0.5, due: "2026-07-01" },
        children: [],
      },
      { id: "b", topic: "Beta", tags: ["now", "next"], children: [] },
      { id: "c", topic: "Gamma", children: [] },
    ],
  },
  floatingTopics: [{ id: "f", topic: "Float", tags: ["next"], children: [] }],
};

describe("boardColumns", () => {
  const cols = boardColumns(doc);

  it("makes one column per tag, sorted, with the Untagged column last", () => {
    expect(cols.map((c) => c.key)).toEqual(["next", "now", UNTAGGED]);
  });

  it("puts a multi-tagged topic in every matching column", () => {
    expect(cols.find((c) => c.key === "now")?.cards.map((x) => x.topic)).toEqual(["Alpha", "Beta"]);
    expect(cols.find((c) => c.key === "next")?.cards.map((x) => x.topic)).toEqual([
      "Beta",
      "Float",
    ]);
  });

  it("collects untagged topics (root + Gamma) into the Untagged column", () => {
    expect(cols.find((c) => c.key === UNTAGGED)?.cards.map((x) => x.topic)).toEqual([
      "Root",
      "Gamma",
    ]);
  });

  it("carries each card's rolled-up progress + due", () => {
    const alpha = cols.find((c) => c.key === "now")?.cards.find((x) => x.id === "a");
    expect(alpha?.progress).toBe(50);
    expect(alpha?.due).toBe("2026-07-01");
  });

  it("leaves a non-task card's progress undefined", () => {
    const beta = cols.find((c) => c.key === "now")?.cards.find((x) => x.id === "b");
    expect(beta?.progress).toBeUndefined();
  });

  it("omits the Untagged column when every node is tagged", () => {
    const allTagged: MindMapDoc = {
      schemaVersion: 1,
      id: "d2",
      title: "T",
      root: {
        id: "r",
        topic: "Root",
        tags: ["x"],
        children: [{ id: "k", topic: "K", tags: ["x"], children: [] }],
      },
    };
    expect(boardColumns(allTagged).map((c) => c.key)).toEqual(["x"]);
  });

  it("lists a topic once per column even if it carries the same tag twice", () => {
    // A duplicate tag (from an import or a hand-edited file) must not list — or double-count — a card.
    const dup: MindMapDoc = {
      schemaVersion: 1,
      id: "d3",
      title: "T",
      root: { id: "r", topic: "Root", tags: ["dup", "dup"], children: [] },
    };
    const col = boardColumns(dup).find((c) => c.key === "dup");
    expect(col?.cards.map((x) => x.id)).toEqual(["r"]); // once, not ["r","r"]
  });
});

describe("retagForMove (drag-to-retag)", () => {
  it("drops the source tag and adds the target tag, preserving other tags", () => {
    expect(retagForMove(["now", "next"], "now", "later").sort()).toEqual(["later", "next"]);
  });
  it("dropping into Untagged only removes the source tag", () => {
    expect(retagForMove(["now"], "now", UNTAGGED)).toEqual([]);
  });
  it("dragging from Untagged only adds the target tag", () => {
    expect(retagForMove([], UNTAGGED, "now")).toEqual(["now"]);
  });
  it("doesn't duplicate a tag the card already carries", () => {
    expect(retagForMove(["a", "b"], "a", "b")).toEqual(["b"]);
  });
});

describe("marker-group board (item 4)", () => {
  const markerDoc: MindMapDoc = {
    schemaVersion: 1,
    id: "m",
    title: "T",
    root: {
      id: "r",
      topic: "Root",
      children: [
        { id: "a", topic: "A", icons: ["🔴", "⭐"], children: [] }, // status=red, plus a free marker
        { id: "b", topic: "B", icons: ["🟢"], children: [] }, // status=green
        { id: "c", topic: "C", children: [] }, // no status → None
      ],
    },
  };

  it("makes one column per group member (in order) plus a trailing None column", () => {
    const cols = buildBoard(markerDoc, { kind: "marker", group: "status" }, "2026-06-24");
    // Status group members: 🔴 🟡 🟢 🔵 🟠 🟣, then None.
    expect(cols.map((c) => c.key)).toEqual(["🔴", "🟡", "🟢", "🔵", "🟠", "🟣", ""]);
    expect(cols.find((c) => c.key === "🔴")?.cards.map((x) => x.topic)).toEqual(["A"]);
    expect(cols.find((c) => c.key === "🟢")?.cards.map((x) => x.topic)).toEqual(["B"]);
    // Root (no status) + C fall into None.
    expect(cols.find((c) => c.key === "")?.cards.map((x) => x.topic)).toEqual(["Root", "C"]);
  });

  it("reMarkForMove swaps the group member, keeping markers outside the group", () => {
    // A carries 🔴 (status) + ⭐ (free). Dropping on the 🟢 column swaps status but keeps ⭐.
    expect(reMarkForMove(["🔴", "⭐"], "status", "🟢").sort()).toEqual(["⭐", "🟢"].sort());
    // Dropping on None clears the group marker only.
    expect(reMarkForMove(["🔴", "⭐"], "status", "")).toEqual(["⭐"]);
  });
});

describe("schedule board (item 5)", () => {
  const TODAY = "2026-06-24";

  it("scheduleBucketOf files a dated, unfinished task into the right date bucket", () => {
    expect(scheduleBucketOf(undefined, undefined, TODAY)).toBe("unscheduled");
    expect(scheduleBucketOf("2026-06-24", 0.5, TODAY)).toBe("today");
    expect(scheduleBucketOf("2026-06-20", 0, TODAY)).toBe("overdue");
    expect(scheduleBucketOf("2026-06-27", 0, TODAY)).toBe("week");
    expect(scheduleBucketOf("2026-12-31", 0, TODAY)).toBe("later");
    // A finished task is "unscheduled" (off the board's active columns) even if it has a due date.
    expect(scheduleBucketOf("2026-06-20", 1, TODAY)).toBe("unscheduled");
  });

  it("bucketDueDate writes a sensible due date per column (and clears for Unscheduled)", () => {
    expect(bucketDueDate("today", TODAY)).toBe("2026-06-24");
    expect(bucketDueDate("overdue", TODAY)).toBe("2026-06-23");
    expect(bucketDueDate("week", TODAY)).toBe("2026-06-27");
    expect(bucketDueDate("later", TODAY)).toBe("2026-07-08");
    expect(bucketDueDate("unscheduled", TODAY)).toBeUndefined();
  });

  it("buildBoard lays out Unscheduled first, then the date buckets", () => {
    const cols = buildBoard(doc, { kind: "schedule" }, "2026-06-24");
    expect(cols.map((c) => c.key)).toEqual(["unscheduled", "overdue", "today", "week", "later"]);
  });
});
