import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber } from "pdf-lib";
import { expect, it } from "vitest";
import { addEngineeringPdfNavigation, addPdfSectionLink } from "../src/io/engineeringPdfNavigation";

it("round trips Unicode hierarchical bookmarks and direct TOC links", async () => {
  const pdf = await PDFDocument.create();
  const toc = pdf.addPage();
  const body = pdf.addPage();
  const sections = [
    { title: "1 系统设计", level: 1, page: body, y: 700 },
    { title: "1.1 保存 / 設計", level: 2, page: body, y: 600 },
    { title: "1.1.1 深层", level: 9, page: body, y: 500 },
    { title: "2 検証", level: 1, page: body, y: 400 },
  ];
  addEngineeringPdfNavigation(pdf, sections);
  addPdfSectionLink(pdf, toc, [48, 500, 500, 520], sections[2]);
  const loaded = await PDFDocument.load(await pdf.save());
  const root = loaded.catalog.lookup(PDFName.of("Outlines"), PDFDict);
  const first = root.lookup(PDFName.of("First"), PDFDict);
  const second = first.lookup(PDFName.of("Next"), PDFDict);
  const child = first.lookup(PDFName.of("First"), PDFDict);
  const grandchild = child.lookup(PDFName.of("First"), PDFDict);
  expect(root.lookup(PDFName.of("Count"), PDFNumber).asNumber()).toBe(4);
  expect(first.lookup(PDFName.of("Count"), PDFNumber).asNumber()).toBe(2);
  expect(first.lookup(PDFName.of("Title"), PDFHexString).decodeText()).toBe("1 系统设计");
  expect(second.lookup(PDFName.of("Title"), PDFHexString).decodeText()).toBe("2 検証");
  expect(grandchild.lookup(PDFName.of("Title"), PDFHexString).decodeText()).toBe("1.1.1 深层");
  expect(second.get(PDFName.of("Prev"))).toEqual(root.get(PDFName.of("First")));
  expect(child.get(PDFName.of("Parent"))).toEqual(root.get(PDFName.of("First")));
  expect(grandchild.get(PDFName.of("Parent"))).toEqual(first.get(PDFName.of("First")));
  const link = loaded.getPages()[0].node.Annots()?.lookup(0, PDFDict);
  expect(link).toBeDefined();
  expect(link?.lookup(PDFName.of("Dest"), PDFArray).get(0)).toEqual(loaded.getPages()[1].ref);
  expect(link?.lookup(PDFName.of("Dest"), PDFArray).lookup(3, PDFNumber).asNumber()).toBe(500);
  expect(link?.has(PDFName.of("A"))).toBe(false);
});
