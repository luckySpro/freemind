import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildDocx, fromDocx } from "../src/io/docx";
import type { MindMapDoc } from "../src/model/types";

// ---------------------------------------------------------------------------
// Helper: make a minimal .docx ZIP from a hand-authored word/document.xml.
// ---------------------------------------------------------------------------
function makeDocx(documentXml: string): Uint8Array {
  return zipSync({ "word/document.xml": strToU8(documentXml) });
}

// Wrap body XML in a well-formed w:document (mirrors the exporter's shell).
const XMLNS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
function wrapDoc(bodyInner: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${XMLNS}><w:body>${bodyInner}</w:body></w:document>`;
}

// Quick helper: build a single w:p with a pStyle attribute.
function styledPara(styleVal: string, text: string): string {
  return `<w:p><w:pPr><w:pStyle w:val="${styleVal}"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

// Quick helper: build a w:p with a left-indent (twips).
function indentPara(left: number, text: string, italic = false): string {
  const rPr = italic ? "<w:rPr><w:i/></w:rPr>" : "";
  const pPr = `<w:pPr><w:ind w:left="${left}"/></w:pPr>`;
  return `<w:p>${pPr}<w:r>${rPr}<w:t>${text}</w:t></w:r></w:p>`;
}

// ---------------------------------------------------------------------------
// 1. Round-trip: buildDocx → fromDocx
// ---------------------------------------------------------------------------
describe("fromDocx – round-trip via buildDocx", () => {
  const source: MindMapDoc = {
    schemaVersion: 1,
    id: "orig",
    title: "Strategy",
    root: {
      id: "r",
      topic: "Strategy",
      children: [
        {
          id: "a",
          topic: "Alpha",
          note: "First note line\nSecond note line",
          children: [
            { id: "a1", topic: "Alpha One", children: [] },
            { id: "a2", topic: "Alpha Two", children: [] },
          ],
        },
        {
          id: "b",
          topic: "Beta",
          children: [{ id: "b1", topic: "Beta One", children: [] }],
        },
      ],
    },
  };

  it("reconstructs the root topic", () => {
    const back = fromDocx(buildDocx(source));
    expect(back.root.topic).toBe("Strategy");
    expect(back.title).toBe("Strategy");
  });

  it("reconstructs direct children", () => {
    const back = fromDocx(buildDocx(source));
    expect(back.root.children.map((c) => c.topic)).toEqual(["Alpha", "Beta"]);
  });

  it("reconstructs grandchildren", () => {
    const back = fromDocx(buildDocx(source));
    expect(back.root.children[0].children.map((c) => c.topic)).toEqual(["Alpha One", "Alpha Two"]);
    expect(back.root.children[1].children.map((c) => c.topic)).toEqual(["Beta One"]);
  });

  it("reconstructs a multi-line note on the right node", () => {
    const back = fromDocx(buildDocx(source));
    const alpha = back.root.children[0];
    expect(alpha.note).toContain("First note line");
    expect(alpha.note).toContain("Second note line");
  });

  it("sets meta.source to 'docx'", () => {
    expect(fromDocx(buildDocx(source)).meta?.source).toBe("docx");
  });
});

// ---------------------------------------------------------------------------
// 2. Real-Word-shape fixture: Heading styles (Title / Heading1 / Heading2)
// ---------------------------------------------------------------------------
describe("fromDocx – Heading-style Word document", () => {
  // Simulate the kind of document Word itself produces (named styles, no indent).
  const xml = wrapDoc(
    [
      styledPara("Title", "My Map"),
      styledPara("Heading1", "Section A"),
      styledPara("Heading2", "Sub A1"),
      styledPara("Heading2", "Sub A2"),
      styledPara("Heading1", "Section B"),
      styledPara("Heading2", "Sub B1"),
    ].join(""),
  );

  it("maps Title → root, Heading1 → depth 1, Heading2 → depth 2", () => {
    const doc = fromDocx(makeDocx(xml));
    expect(doc.root.topic).toBe("My Map");
    expect(doc.root.children.map((c) => c.topic)).toEqual(["Section A", "Section B"]);
  });

  it("nests Heading2 paragraphs under the preceding Heading1", () => {
    const doc = fromDocx(makeDocx(xml));
    expect(doc.root.children[0].children.map((c) => c.topic)).toEqual(["Sub A1", "Sub A2"]);
    expect(doc.root.children[1].children.map((c) => c.topic)).toEqual(["Sub B1"]);
  });

  it("Title style produces depth 0 (becomes root)", () => {
    const doc = fromDocx(makeDocx(xml));
    // The root should have no parent — it IS the root.
    expect(doc.root.topic).toBe("My Map");
  });
});

// ---------------------------------------------------------------------------
// 3. Indent-based document (no heading styles; depth via w:ind w:left)
// ---------------------------------------------------------------------------
describe("fromDocx – indented paragraphs", () => {
  // depth 0 = 0 twips, depth 1 = 360, depth 2 = 720
  const xml = wrapDoc(
    [
      indentPara(0, "Root Node"),
      indentPara(360, "Child 1"),
      indentPara(720, "Grandchild"),
      indentPara(360, "Child 2"),
    ].join(""),
  );

  it("computes depth from indent / 360", () => {
    const doc = fromDocx(makeDocx(xml));
    expect(doc.root.topic).toBe("Root Node");
    expect(doc.root.children.map((c) => c.topic)).toEqual(["Child 1", "Child 2"]);
    expect(doc.root.children[0].children.map((c) => c.topic)).toEqual(["Grandchild"]);
  });
});

// ---------------------------------------------------------------------------
// 4. w:t as object with xml:space attribute (fast-xml-parser shape)
// ---------------------------------------------------------------------------
describe("fromDocx – w:t as object with @_xml:space", () => {
  // fast-xml-parser returns { "#text": "…", "@_xml:space": "preserve" } when
  // xml:space is present; our exporter always emits this on every w:t.
  const xml = wrapDoc(
    `<w:p><w:r><w:t xml:space="preserve">Root</w:t></w:r></w:p>` +
      `<w:p><w:pPr><w:ind w:left="360"/></w:pPr><w:r><w:t xml:space="preserve">Child</w:t></w:r></w:p>`,
  );

  it("extracts text from w:t objects with xml:space attribute", () => {
    const doc = fromDocx(makeDocx(xml));
    expect(doc.root.topic).toBe("Root");
    expect(doc.root.children[0].topic).toBe("Child");
  });
});

// ---------------------------------------------------------------------------
// 5. Error cases
// ---------------------------------------------------------------------------
describe("fromDocx – error cases", () => {
  it("throws when the zip has no word/document.xml", () => {
    const zip = zipSync({ "x.txt": strToU8("hello") });
    expect(() => fromDocx(zip)).toThrow(/word\/document\.xml/);
  });

  it("throws when word/document.xml has no non-empty paragraphs", () => {
    const xml = wrapDoc("<w:p/><w:p><w:r><w:t/></w:r></w:p>");
    expect(() => fromDocx(makeDocx(xml))).toThrow(/No paragraphs/);
  });

  it("throws when the bytes are not a valid ZIP", () => {
    expect(() => fromDocx(new Uint8Array([1, 2, 3, 4]))).toThrow();
  });
});
