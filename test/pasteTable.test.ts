import { describe, expect, it } from "vitest";
import { parsePaste, parseTable, tableToForest } from "../src/io/pasteTable";

// parseTable detects a spreadsheet block (interior tab / consistent commas) without hijacking an
// indented outline; tableToForest maps rows → topics (+ note / tags); parsePaste routes between the
// table and outline parsers.
describe("parseTable", () => {
  it("splits a TSV block into rows × cells", () => {
    expect(parseTable("Task\tOwner\nA\tAnn\nB\tBo")).toEqual([
      ["Task", "Owner"],
      ["A", "Ann"],
      ["B", "Bo"],
    ]);
  });

  it("ignores an indented outline (leading tabs are not column separators)", () => {
    expect(parseTable("Theme\n\tIdea\n\tIdea")).toBeNull();
  });

  it("falls back to commas only when every line has them, and needs ≥2 columns", () => {
    expect(parseTable("a,b\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
    expect(parseTable("just one\nplain line")).toBeNull(); // no delimiter
    expect(parseTable("single\ncolumn")).toBeNull(); // 1 column
  });
});

describe("tableToForest", () => {
  it("uses headers to label note lines and split a Tags column", () => {
    const rows = [
      ["Topic", "Owner", "Tags"],
      ["Launch", "Ann", "q3, urgent"],
      ["Research", "Bo", "q4"],
    ];
    const forest = tableToForest(rows);
    expect(forest.map((n) => n.topic)).toEqual(["Launch", "Research"]);
    expect(forest[0].note).toBe("Owner: Ann");
    expect(forest[0].tags).toEqual(["q3", "urgent"]);
    expect(forest[1].tags).toEqual(["q4"]);
  });

  it("without headers, row[0] is the topic and the rest become plain note lines", () => {
    const forest = tableToForest([
      ["A", "first note", "second"],
      ["B", "x"],
    ]);
    expect(forest[0]).toMatchObject({ topic: "A", note: "first note\nsecond" });
    expect(forest[0].tags).toBeUndefined();
    expect(forest[1]).toMatchObject({ topic: "B", note: "x" });
  });

  it("skips blank rows and never produces an empty topic", () => {
    const forest = tableToForest([
      ["", ""],
      ["", "note only"],
    ]);
    expect(forest).toHaveLength(1);
    expect(forest[0].topic).toBe("(untitled)");
  });
});

describe("parsePaste", () => {
  it("routes a table block to the row-per-topic parser", () => {
    const forest = parsePaste("Topic\tOwner\nLaunch\tAnn");
    expect(forest).toHaveLength(1);
    expect(forest[0]).toMatchObject({ topic: "Launch", note: "Owner: Ann" });
  });

  it("routes an indented outline to the outline parser (nesting preserved)", () => {
    const forest = parsePaste("Theme\n\tIdea");
    expect(forest).toHaveLength(1);
    expect(forest[0].topic).toBe("Theme");
    expect(forest[0].children.map((c) => c.topic)).toEqual(["Idea"]);
  });

  it("turns a lone URL into one titled, linked node (offline, no fetch)", () => {
    const forest = parsePaste("https://www.example.com/blog/my-great-post");
    expect(forest).toHaveLength(1);
    expect(forest[0]).toMatchObject({
      topic: "My Great Post", // last path segment, de-slugged + Title Cased
      hyperlink: "https://www.example.com/blog/my-great-post",
    });
    expect(forest[0].children).toEqual([]);
  });

  it("falls back to the host when the URL has no path slug, and strips a file extension", () => {
    expect(parsePaste("https://www.example.com/").at(0)?.topic).toBe("example.com");
    expect(parsePaste("https://example.com/docs/report.pdf").at(0)?.topic).toBe("Report");
  });

  it("does not hijack text that merely contains a URL, or a non-http(s) scheme", () => {
    // A URL with trailing prose is an outline line, not a single-link paste.
    expect(parsePaste("see https://example.com for more")[0].hyperlink).toBeUndefined();
    // A dangerous scheme is never linkified.
    const bad = parsePaste("javascript:alert(1)");
    expect(bad[0].hyperlink).toBeUndefined();
  });
});
