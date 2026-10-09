import { XMLValidator } from "fast-xml-parser";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildXlsx } from "../src/io/xlsx";
import type { MindMapDoc } from "../src/model/types";

const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "Plan",
  root: {
    id: "r",
    topic: "Plan",
    children: [
      {
        id: "a",
        topic: "Alpha",
        note: "a note",
        children: [{ id: "a1", topic: "Alpha One", children: [] }],
      },
      { id: "b", topic: "Beta", children: [] },
    ],
  },
};

function open(d: MindMapDoc) {
  const files = unzipSync(buildXlsx(d));
  return { files, names: Object.keys(files), text: (name: string) => strFromU8(files[name]) };
}

describe("buildXlsx", () => {
  it("packages the minimal SpreadsheetML parts", () => {
    const { names } = open(doc);
    for (const required of [
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/worksheets/sheet1.xml",
      "xl/styles.xml",
    ]) {
      expect(names).toContain(required);
    }
  });

  it("emits well-formed XML for every part", () => {
    const { files } = open(doc);
    for (const name of Object.keys(files)) {
      expect(XMLValidator.validate(strFromU8(files[name]))).toBe(true);
    }
  });

  it("declares the workbook/worksheet/styles content types and relationships", () => {
    const { text } = open(doc);
    const ct = text("[Content_Types].xml");
    expect(ct).toContain("/xl/workbook.xml");
    expect(ct).toContain("/xl/worksheets/sheet1.xml");
    expect(ct).toContain("/xl/styles.xml");
    const rels = text("xl/_rels/workbook.xml.rels");
    expect(rels).toContain("worksheets/sheet1.xml");
    expect(rels).toContain("styles.xml");
  });

  it("places each topic in the column matching its depth, with a Notes column", () => {
    const sheet = open(doc).text("xl/worksheets/sheet1.xml");
    // header
    expect(sheet).toContain("Level 1");
    expect(sheet).toContain("Notes");
    // depth 0 -> col A (row 2), depth 1 -> col B, depth 2 -> col C
    expect(sheet).toMatch(/<c r="A2"[^>]*>.*?Plan/);
    expect(sheet).toMatch(/<c r="B3"[^>]*>.*?Alpha</);
    expect(sheet).toMatch(/<c r="C4"[^>]*>.*?Alpha One/);
    expect(sheet).toMatch(/<c r="B5"[^>]*>.*?Beta/);
    // the note sits in the Notes column (D, after the 3 level columns)
    expect(sheet).toMatch(/<c r="D3"[^>]*>.*?a note/);
  });

  it("marks the header row bold (style index 1)", () => {
    const sheet = open(doc).text("xl/worksheets/sheet1.xml");
    expect(sheet).toMatch(/<c r="A1" s="1"/);
  });

  it("escapes XML metacharacters in topics", () => {
    const evil: MindMapDoc = {
      schemaVersion: 1,
      id: "e",
      title: "T",
      root: { id: "r", topic: "T", children: [{ id: "x", topic: "X & <Y>", children: [] }] },
    };
    const sheet = strFromU8(unzipSync(buildXlsx(evil))["xl/worksheets/sheet1.xml"]);
    expect(sheet).toContain("X &amp; &lt;Y&gt;");
    expect(sheet).not.toContain("<Y>");
  });

  it("is deterministic — the same map produces identical bytes", () => {
    expect(Buffer.from(buildXlsx(doc)).equals(Buffer.from(buildXlsx(doc)))).toBe(true);
  });
});
