import { describe, expect, it } from "vitest";
import { parseTable, tableToForest } from "../src/io/pasteTable";
import { TABLE_HEADERS, mapToRows, mapToTsv } from "../src/io/tableExport";
import type { MindMapDoc } from "../src/model/types";

// mapToRows / mapToTsv flatten a map to a spreadsheet table (the inverse of io/pasteTable).
const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "Plan",
  root: {
    id: "r",
    topic: "Root",
    children: [
      {
        id: "a",
        topic: "Alpha",
        note: "a note",
        tags: ["q3", "urgent"],
        children: [{ id: "a1", topic: "A1", children: [] }],
      },
      { id: "b", topic: "Bravo", children: [] },
    ],
  },
};

describe("mapToRows", () => {
  it("emits a header row then one row per topic, depth-first, with depth/note/tags", () => {
    expect(mapToRows(doc)).toEqual([
      [...TABLE_HEADERS],
      ["Root", "0", "", ""],
      ["Alpha", "1", "a note", "q3, urgent"],
      ["A1", "2", "", ""],
      ["Bravo", "1", "", ""],
    ]);
  });

  it("flattens tabs/newlines in a cell so they can't break the grid", () => {
    const rows = mapToRows({
      schemaVersion: 1,
      id: "x",
      title: "X",
      root: { id: "r", topic: "R", note: "line1\nline2\twith tab", children: [] },
    });
    expect(rows[1][2]).toBe("line1 line2 with tab");
  });
});

describe("mapToTsv", () => {
  it("joins cells with tabs and rows with newlines", () => {
    const tsv = mapToTsv(doc);
    expect(tsv.split("\n")[0]).toBe("Topic\tDepth\tNote\tTags");
    expect(tsv.split("\n")[2]).toBe("Alpha\t1\ta note\tq3, urgent");
  });

  it("round-trips back through the paste-table parser (topics + tags preserved)", () => {
    const rows = parseTable(mapToTsv(doc));
    expect(rows).not.toBeNull();
    const forest = tableToForest(rows as string[][]);
    // The "Topic" header column drives the topic; tags come back from the "Tags" column.
    expect(forest.map((n) => n.topic)).toEqual(["Root", "Alpha", "A1", "Bravo"]);
    expect(forest.find((n) => n.topic === "Alpha")?.tags).toEqual(["q3", "urgent"]);
  });
});
