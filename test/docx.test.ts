import { XMLValidator } from "fast-xml-parser";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildDocx } from "../src/io/docx";
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
        note: "Key note",
        children: [{ id: "a1", topic: "Alpha One", children: [] }],
      },
      { id: "b", topic: "Beta", children: [] },
    ],
  },
};

const documentOf = (d: MindMapDoc) => strFromU8(unzipSync(buildDocx(d))["word/document.xml"]);

describe("buildDocx", () => {
  it("packages the three required OPC parts", () => {
    const names = Object.keys(unzipSync(buildDocx(doc)));
    expect(names).toContain("[Content_Types].xml");
    expect(names).toContain("_rels/.rels");
    expect(names).toContain("word/document.xml");
  });

  it("emits well-formed XML for every part", () => {
    const files = unzipSync(buildDocx(doc));
    for (const name of Object.keys(files)) {
      expect(XMLValidator.validate(strFromU8(files[name]))).toBe(true);
    }
  });

  it("includes the title and every topic as paragraph text", () => {
    const xml = documentOf(doc);
    expect(xml).toContain("Plan"); // title
    expect(xml).toContain("Alpha"); // branch
    expect(xml).toContain("Alpha One"); // nested child
    expect(xml).toContain("Beta");
  });

  it("renders notes as italic paragraphs", () => {
    const xml = documentOf(doc);
    expect(xml).toContain("Key note");
    expect(xml).toContain("<w:i/>");
  });

  it("escapes XML metacharacters in topics", () => {
    const evil: MindMapDoc = {
      schemaVersion: 1,
      id: "e",
      title: "T",
      root: { id: "r", topic: "T", children: [{ id: "x", topic: "Tom & <Jerry>", children: [] }] },
    };
    const xml = documentOf(evil);
    expect(xml).toContain("Tom &amp; &lt;Jerry&gt;");
    expect(xml).not.toContain("<Jerry>");
  });

  it("is deterministic — the same map produces identical bytes", () => {
    expect(Buffer.from(buildDocx(doc)).equals(Buffer.from(buildDocx(doc)))).toBe(true);
  });
});
