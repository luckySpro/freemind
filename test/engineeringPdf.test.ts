import { readFileSync, writeFileSync } from "node:fs";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import { buildEngineeringPdf } from "../src/io/engineeringPdf";
import type { MindMapDoc } from "../src/model/types";

const font = new Uint8Array(readFileSync("src/assets/fonts/NotoSansCJKsc-Regular.ttf"));
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jbe0AAAAASUVORK5CYII=";
const map: MindMapDoc = {
  schemaVersion: 1,
  id: "pdf-qa",
  title: "工程方案 · 工程方案 · 設計資料",
  root: {
    id: "root",
    topic: "工程方案",
    note: "项目背景与需求说明。繁體中文與日本語の資料。",
    children: [
      {
        id: "design",
        topic: "设计与验证",
        note: `说明 **重点**、*备注* 和 ~~旧方案~~，以及 [参考](https://example.invalid)。\n\n![截图](${png})\n\n| 项目 | 结果 |\n| --- | --- |\n| 离线 | 通过 |\n\n- 条目\n  - 子条目\n\n1. 第一步\n2. 第二步\n\n> 引用资料\n\n### 备注小标题\n\n\`\`\`go\nfmt.Println("ok")\n\`\`\`\n\n---`,
        children: [{ id: "storage", topic: "本地存储", children: [] }],
      },
      {
        id: "review",
        topic: "验收记录",
        note: Array.from(
          { length: 70 },
          (_, i) => `| 检查 ${i + 1} | 中文・繁體・日本語：保存与验证，开箱即用。 |`,
        )
          .join("\n")
          .replace(/^/, "| 编号 | 记录 |\n| --- | --- |\n"),
        children: [],
      },
    ],
  },
};

// Embedding/compressing the full CJK font takes ~18s on the shared CI runner.
// Allow headroom for the multi-page fixture while still detecting hangs.
describe("engineering PDF export", () => {
  it("creates embedded CJK text, rich notes and image resources with linked TOC and real destinations", async () => {
    const bytes = await buildEngineeringPdf(map, font);
    if (process.env.FREEMIND_PDF_QA) writeFileSync(process.env.FREEMIND_PDF_QA, bytes);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(4);
    expect(pdf.getTitle()).toBe(map.title);
    const toc = pdf.getPage(1);
    const links = toc.node.lookup(PDFName.of("Annots"), PDFArray);
    expect(links.size()).toBe(3);
    for (let i = 0; i < links.size(); i++) {
      const dest = links.lookup(i, PDFDict).lookup(PDFName.of("Dest"), PDFArray);
      expect(pdf.getPages().some((page) => page.ref.toString() === dest.get(0).toString())).toBe(
        true,
      );
      expect(dest.lookup(3, PDFNumber).asNumber()).toBeGreaterThan(58);
    }
    expect(pdf.catalog.lookup(PDFName.of("Outlines"), PDFDict)).toBeDefined();
    const resources = pdf.getPage(2).node.Resources();
    expect(resources?.lookup(PDFName.of("Font"), PDFDict).keys().length).toBeGreaterThan(0);
    expect(resources?.lookup(PDFName.of("XObject"), PDFDict).keys().length).toBeGreaterThan(0);
  }, 60000);

  it("paginates a large contents list and oversized table rows without fetching remote images", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const doc = structuredClone(map);
    doc.root.children = Array.from({ length: 45 }, (_, i) => ({
      id: `n${i}`,
      topic: `章节 ${i + 1} ${"长标题".repeat(15)}`,
      note:
        i === 0
          ? `![远程](https://example.invalid/a.png)\n\n![无效](data:image/png;base64,AA==)\n\n| 字段 | 数据 |\n| --- | --- |\n| 测试 | ${"长记录 ".repeat(1200)} |`
          : "验证记录",
      children: [],
    }));
    const pdf = await PDFDocument.load(await buildEngineeringPdf(doc, font));
    expect(pdf.getPageCount()).toBeGreaterThan(10);
    let links = 0;
    for (const page of pdf.getPages()) links += page.node.Annots()?.size() ?? 0;
    expect(links).toBe(45);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  }, 60000);
});
