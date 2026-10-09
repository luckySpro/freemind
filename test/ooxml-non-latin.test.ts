// Non-Latin text must survive the OOXML exporters intact.
//
// This is the part of the "OOXML font" backlog item that is actually verifiable here. Whether
// PowerPoint substitutes a CJK font for Calibri is a rendering decision inside Office that no test in
// this repo can observe — both apps do glyph fallback, and the empty `<a:ea>`/`<a:cs>` theme slots are
// what Office's own stock theme ships, so that half of the item was overstated.
//
// What CAN break here, silently and completely, is the bytes: these writers build XML by string
// concatenation and hand it to fflate, so a mis-encoded string or an escaper that mangles astral-plane
// characters would produce a file that opens to mojibake or refuses to open at all. Nothing covered
// that — every fixture in pptx.test.ts and xlsx.test.ts is ASCII.
//
// The scripts below are chosen to cover the ways this goes wrong: CJK (3-byte UTF-8), Arabic and Hebrew
// (RTL, so also a check that nothing tries to "fix" direction), Cyrillic and Greek (inside Calibri, so
// they must be untouched), and an emoji (a SURROGATE PAIR — the case a naive per-charCode escaper
// splits down the middle).
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildPptx } from "../src/io/pptx";
import { buildXlsx } from "../src/io/xlsx";
import type { MindMapDoc } from "../src/model/types";

const SCRIPTS = [
  "日本語のトピック", // CJK
  "العربية", // Arabic (RTL)
  "עברית", // Hebrew (RTL)
  "Кириллица", // Cyrillic
  "Ελληνικά", // Greek
  "🎯 emoji", // astral plane / surrogate pair
  'quotes "and" <angles> & ampersand', // the escaper's own job, alongside the above
];

const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "日本語のマップ",
  root: {
    id: "r",
    topic: "🎯 ルート",
    children: SCRIPTS.map((topic, i) => ({ id: `n${i}`, topic, children: [] })),
  },
};

/** Concatenated text of every XML part in a zip, decoded as UTF-8. */
function xmlText(bytes: Uint8Array): string {
  const zip = unzipSync(bytes);
  return Object.entries(zip)
    .filter(([name]) => name.endsWith(".xml"))
    .map(([, part]) => strFromU8(part))
    .join("\n");
}

describe("OOXML exports carry non-Latin text intact", () => {
  it("PPTX keeps every script, and escapes markup without touching the rest", () => {
    const xml = xmlText(buildPptx(doc));
    for (const s of SCRIPTS.slice(0, 6)) expect(xml).toContain(s);
    // The markup characters are escaped; the words around them survive.
    expect(xml).toContain("&amp; ampersand");
    expect(xml).toContain("&lt;angles&gt;");
    // …and the raw forms are not sitting in the text, which would corrupt the part.
    expect(xml).not.toContain("<angles>");
  });

  it("XLSX keeps every script too", () => {
    const xml = xmlText(buildXlsx(doc));
    for (const s of SCRIPTS.slice(0, 6)) expect(xml).toContain(s);
    expect(xml).toContain("&amp; ampersand");
  });

  it("does not split the emoji's surrogate pair", () => {
    // A per-charCode escaper would emit a lone high surrogate here, which is not well-formed XML.
    const xml = xmlText(buildPptx(doc));
    expect(xml).toContain("🎯");
    expect(xml).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    expect(xml).not.toMatch(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
  });
});
