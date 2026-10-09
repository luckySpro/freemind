// Tests for the .xlsx importer (fromXlsx). Covers:
//   1. Round-trip: buildXlsx → fromXlsx recovers the topic tree + notes.
//   2. Shared-strings fixture: hand-authored XML with t="s" cells + sharedStrings.xml,
//      zipped with fflate, verifying the shared-string path + depth-from-column logic.
//   3. Error case: a zip without xl/worksheets/sheet1.xml throws.

import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildXlsx, fromXlsx } from "../src/io/xlsx";
import type { MindMapDoc } from "../src/model/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal .xlsx ZIP from raw XML strings (no shared strings). */
function makeXlsx(sheet1Xml: string, sharedStringsXml?: string): Uint8Array {
  const parts: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        "</Types>",
    ),
    "_rels/.rels": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        "</Relationships>",
    ),
    "xl/workbook.xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></sheets>' +
        "</workbook>",
    ),
    "xl/worksheets/sheet1.xml": strToU8(sheet1Xml),
  };
  if (sharedStringsXml !== undefined) {
    parts["xl/sharedStrings.xml"] = strToU8(sharedStringsXml);
  }
  return zipSync(parts);
}

// ---------------------------------------------------------------------------
// Test document
// ---------------------------------------------------------------------------

const roundTripDoc: MindMapDoc = {
  schemaVersion: 1,
  id: "rt-doc",
  title: "Root Topic",
  root: {
    id: "r",
    topic: "Root Topic",
    children: [
      {
        id: "c1",
        topic: "Child One",
        note: "a useful note",
        children: [
          { id: "gc1", topic: "Grandchild A", children: [] },
          { id: "gc2", topic: "Grandchild B", children: [] },
        ],
      },
      {
        id: "c2",
        topic: "Child Two",
        children: [],
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// 1. Round-trip: buildXlsx → fromXlsx
// ---------------------------------------------------------------------------

describe("fromXlsx — round-trip via buildXlsx", () => {
  it("recovers the root topic and title", () => {
    const doc = fromXlsx(buildXlsx(roundTripDoc));
    expect(doc.title).toBe("Root Topic");
    expect(doc.root.topic).toBe("Root Topic");
    expect(doc.meta?.source).toBe("xlsx");
  });

  it("recovers the first-level children in order", () => {
    const doc = fromXlsx(buildXlsx(roundTripDoc));
    expect(doc.root.children.map((c) => c.topic)).toEqual(["Child One", "Child Two"]);
  });

  it("recovers grandchildren under their correct parent", () => {
    const doc = fromXlsx(buildXlsx(roundTripDoc));
    const child1 = doc.root.children[0];
    expect(child1.topic).toBe("Child One");
    expect(child1.children.map((c) => c.topic)).toEqual(["Grandchild A", "Grandchild B"]);
  });

  it("recovers a note on the annotated node", () => {
    const doc = fromXlsx(buildXlsx(roundTripDoc));
    const child1 = doc.root.children[0];
    expect(child1.note).toBe("a useful note");
  });

  it("does not attach a note where there was none", () => {
    const doc = fromXlsx(buildXlsx(roundTripDoc));
    const child2 = doc.root.children[1];
    expect(child2.note).toBeUndefined();
    expect(doc.root.note).toBeUndefined();
  });

  it("sets schemaVersion: 1", () => {
    const doc = fromXlsx(buildXlsx(roundTripDoc));
    expect(doc.schemaVersion).toBe(1);
  });

  it("generates unique node ids", () => {
    const doc = fromXlsx(buildXlsx(roundTripDoc));
    const collect = (n: typeof doc.root): string[] => [n.id, ...n.children.flatMap(collect)];
    const ids = collect(doc.root);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// 2. Shared-strings fixture
// ---------------------------------------------------------------------------

// Layout:
//   Row 1 (header):  A1="Level 1"  B1="Level 2"  C1="Notes"   (shared strings 0,1,2)
//   Row 2 (depth 0): A2="Alpha"                               (shared string 3)
//   Row 3 (depth 1):            B3="Beta"                     (shared string 4)
//   Row 4 (depth 2):                      C4="Gamma"   D4="a note"  (shared strings 5,6)
//   Row 5 (depth 1):            B5="Delta"                    (shared string 7)
//
// Expected tree:  Alpha → Beta → Gamma(note:"a note")
//                            └→ Delta

const sharedStringsXml = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="8" uniqueCount="8">',
  "<si><t>Level 1</t></si>", // 0
  "<si><t>Level 2</t></si>", // 1
  "<si><t>Level 3</t></si>", // 2  (header for col C — but col C is also used for depth-2 topics)
  "<si><t>Notes</t></si>", // 3  (header Notes — in col D)
  "<si><t>Alpha</t></si>", // 4
  "<si><t>Beta</t></si>", // 5
  "<si><t>Gamma</t></si>", // 6
  "<si><t>a note</t></si>", // 7
  "<si><t>Delta</t></si>", // 8
  "</sst>",
].join("");

// Sheet uses t="s" cells with <v> holding the shared-string index.
// Header row has Level 1/Level 2/Level 3 in A1/B1/C1; Notes in D1.
// Topic layout: depth 0 → col A, depth 1 → col B, depth 2 → col C; Notes → col D.
const sharedSheet1Xml = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
  "<sheetData>",
  // Header row (all shared strings — indices 0,1,2,3)
  '<row r="1">',
  '<c r="A1" t="s"><v>0</v></c>',
  '<c r="B1" t="s"><v>1</v></c>',
  '<c r="C1" t="s"><v>2</v></c>',
  '<c r="D1" t="s"><v>3</v></c>',
  "</row>",
  // Row 2: Alpha at depth 0 (col A)
  '<row r="2">',
  '<c r="A2" t="s"><v>4</v></c>',
  "</row>",
  // Row 3: Beta at depth 1 (col B)
  '<row r="3">',
  '<c r="B3" t="s"><v>5</v></c>',
  "</row>",
  // Row 4: Gamma at depth 2 (col C), note in D4 (shared string 7)
  '<row r="4">',
  '<c r="C4" t="s"><v>6</v></c>',
  '<c r="D4" t="s"><v>7</v></c>',
  "</row>",
  // Row 5: Delta at depth 1 (col B) — sibling of Beta
  '<row r="5">',
  '<c r="B5" t="s"><v>8</v></c>',
  "</row>",
  "</sheetData>",
  "</worksheet>",
].join("");

describe("fromXlsx — shared-strings fixture", () => {
  const getDoc = () => fromXlsx(makeXlsx(sharedSheet1Xml, sharedStringsXml));

  it("decodes the root topic from shared strings", () => {
    expect(getDoc().root.topic).toBe("Alpha");
    expect(getDoc().title).toBe("Alpha");
  });

  it("assigns depth-1 children correctly", () => {
    const { root } = getDoc();
    expect(root.children.map((c) => c.topic)).toEqual(["Beta", "Delta"]);
  });

  it("assigns depth-2 grandchild under Beta", () => {
    const { root } = getDoc();
    const beta = root.children[0];
    expect(beta.topic).toBe("Beta");
    expect(beta.children.map((c) => c.topic)).toEqual(["Gamma"]);
  });

  it("decodes the note from the shared-strings Notes column", () => {
    const { root } = getDoc();
    const gamma = root.children[0].children[0];
    expect(gamma.note).toBe("a note");
  });

  it("Delta has no children and no note", () => {
    const { root } = getDoc();
    const delta = root.children[1];
    expect(delta.topic).toBe("Delta");
    expect(delta.children).toHaveLength(0);
    expect(delta.note).toBeUndefined();
  });

  it("sets meta.source to 'xlsx'", () => {
    expect(getDoc().meta?.source).toBe("xlsx");
  });
});

// ---------------------------------------------------------------------------
// 3. Error cases
// ---------------------------------------------------------------------------

describe("fromXlsx — error cases", () => {
  it("throws when the zip contains no xl/worksheets/sheet1.xml", () => {
    const bad = zipSync({ "some-other-file.txt": strToU8("hello") });
    expect(() => fromXlsx(bad)).toThrow(/xl\/worksheets\/sheet1\.xml/);
  });

  it("throws when the bytes are not a valid zip", () => {
    expect(() => fromXlsx(new Uint8Array([0, 1, 2, 3]))).toThrow();
  });

  it("throws when the sheet has no data rows (only header)", () => {
    const headerOnly = [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
      "<sheetData>",
      '<row r="1"><c r="A1" t="inlineStr"><is><t>Level 1</t></is></c></row>',
      "</sheetData>",
      "</worksheet>",
    ].join("");
    expect(() => fromXlsx(makeXlsx(headerOnly))).toThrow(/No rows found/);
  });
});
