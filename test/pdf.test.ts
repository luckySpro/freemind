// @vitest-environment jsdom
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildMapPdf } from "../src/io/pdf";

// Direct PDF export (item 7): the map is rasterised to a PNG (elsewhere) then embedded here on a
// page of the chosen size/orientation. We feed a tiny real PNG and assert the produced PDF is valid
// and sized as requested.

// A 2×2 red PNG (valid PNG bytes), base64-decoded to a Uint8Array.
const PNG_2x2 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGP8z8Dwn4EIwDiqEAAoyQMH2kY6pQAAAABJRU5ErkJggg==";
function pngBytes(): Uint8Array {
  const bin = atob(PNG_2x2);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

describe("buildMapPdf", () => {
  it("produces a valid one-page PDF sized exactly to the image in 'fit' mode", async () => {
    const bytes = await buildMapPdf(pngBytes(), { pageSize: "fit" }, 2, 2);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    const { width, height } = pdf.getPage(0).getSize();
    expect(width).toBe(2);
    expect(height).toBe(2);
  });

  it("uses A4 landscape dimensions when asked", async () => {
    const bytes = await buildMapPdf(pngBytes(), { pageSize: "a4", orientation: "landscape" }, 2, 2);
    const pdf = await PDFDocument.load(bytes);
    const { width, height } = pdf.getPage(0).getSize();
    // A4 portrait is 595×842; landscape swaps them.
    expect(Math.round(width)).toBe(842);
    expect(Math.round(height)).toBe(595);
  });

  it("uses Letter portrait dimensions by default page size", async () => {
    const bytes = await buildMapPdf(pngBytes(), { pageSize: "letter" }, 2, 2);
    const pdf = await PDFDocument.load(bytes);
    const { width, height } = pdf.getPage(0).getSize();
    expect(Math.round(width)).toBe(612);
    expect(Math.round(height)).toBe(792);
  });
});
