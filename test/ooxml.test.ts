import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { escapeXml, zipOoxml } from "../src/io/ooxml";

// Shared OOXML infra used by the .docx / .pptx / .xlsx exporters. Exercised indirectly by
// each format's test; these pin the cross-cutting contract directly so it can't drift.
describe("escapeXml", () => {
  it("escapes the three element-content metacharacters", () => {
    expect(escapeXml("a & b < c > d")).toBe("a &amp; b &lt; c &gt; d");
  });

  it("escapes raw ampersands literally (no special-casing existing entities)", () => {
    expect(escapeXml("&amp;")).toBe("&amp;amp;");
  });

  it("leaves quotes untouched — it's an element-content escape, not an attribute one", () => {
    expect(escapeXml(`she said "hi" — it's fine`)).toBe(`she said "hi" — it's fine`);
  });
});

describe("zipOoxml", () => {
  const parts = {
    "[Content_Types].xml": "<types/>",
    "word/document.xml": "<w:document><w:body/></w:document>",
  };

  it("produces a real ZIP (PK magic) whose parts round-trip", () => {
    const zip = zipOoxml(parts);
    expect(zip[0]).toBe(0x50); // 'P'
    expect(zip[1]).toBe(0x4b); // 'K'
    const back = unzipSync(zip);
    expect(strFromU8(back["[Content_Types].xml"])).toBe("<types/>");
    expect(strFromU8(back["word/document.xml"])).toBe("<w:document><w:body/></w:document>");
  });

  it("is deterministic — identical input yields byte-identical output (pinned mtime)", () => {
    expect(zipOoxml(parts)).toEqual(zipOoxml(parts));
  });

  it("stores binary parts (embedded media) verbatim alongside XML parts (item 1)", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const zip = zipOoxml({ "[Content_Types].xml": "<types/>", "ppt/media/image1.png": png });
    const back = unzipSync(zip);
    expect(strFromU8(back["[Content_Types].xml"])).toBe("<types/>");
    expect(back["ppt/media/image1.png"]).toEqual(png); // bytes not UTF-8 mangled
  });
});
