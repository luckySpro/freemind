import { XMLValidator } from "fast-xml-parser";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildEngineeringDocx } from "../src/io/engineeringDocx";
import type { MindMapDoc } from "../src/model/types";

const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jbe0AAAAASUVORK5CYII=";
const map: MindMapDoc = {
  schemaVersion: 1,
  id: "engineering",
  title: "系统方案",
  root: {
    id: "root",
    topic: "系统方案",
    note: "背景说明",
    children: [
      {
        id: "design",
        topic: "设计 & 验证",
        note: `说明 **重点** 和 *备注*。\n\n![截图](${png})\n\n| 项目 | 结果 |\n| --- | --- |\n| 离线 | 通过 |\n\n\`\`\`go\nfmt.Println("ok")\n\`\`\``,
        children: [{ id: "storage", topic: "本地存储", children: [] }],
      },
    ],
  },
};

describe("engineering Word export", () => {
  it("embeds real headings, linked TOC entries, images, tables and code in a complete OPC package", async () => {
    const files = unzipSync(await buildEngineeringDocx(map));
    const xml = strFromU8(files["word/document.xml"]);
    expect(xml).toContain('w:pStyle w:val="Heading1"');
    expect(xml).toContain('w:pStyle w:val="Heading2"');
    expect(xml).toContain("1 设计 &amp; 验证");
    expect(xml).toContain("1.1 本地存储");
    expect(xml).toContain("TOC");
    expect(xml).toContain("section_1");
    expect(xml).toContain("背景说明");
    expect(xml).toContain("<w:tbl>");
    expect(xml).toContain("<w:drawing>");
    expect(xml).toContain("fmt.Println");
    expect(xml).not.toContain("data:image");
    expect(strFromU8(files["word/settings.xml"])).toContain("updateFields");
    const media = Object.keys(files).filter(
      (name) => name.startsWith("word/media/") && name.endsWith(".png"),
    );
    expect(media).toHaveLength(1);
    expect(Array.from(files[media[0]].slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    for (const [name, bytes] of Object.entries(files)) {
      if (name.endsWith(".xml") || name.endsWith(".rels"))
        expect(XMLValidator.validate(strFromU8(bytes)), name).toBe(true);
    }
  });

  it("keeps missing remote images visible as explicit placeholders without fetching", async () => {
    const doc = structuredClone(map);
    doc.root.children[0].note = "![远程截图](https://example.invalid/image.png)";
    const xml = strFromU8(unzipSync(await buildEngineeringDocx(doc))["word/document.xml"]);
    expect(xml).toContain("Image not embedded: 远程截图");
    expect(xml).not.toContain("example.invalid");
  });

  it("exports nested lists and keeps note headings out of the document outline", async () => {
    const doc = structuredClone(map);
    doc.root.children[0].note = "### 说明小标题\n\n- 条目\n  - 子条目\n\n1. 第一步\n2. 第二步";
    const xml = strFromU8(unzipSync(await buildEngineeringDocx(doc))["word/document.xml"]);
    expect(xml).toContain("说明小标题");
    expect(xml).toContain("子条目");
    expect(xml).toContain("第二步");
    expect(xml.match(/w:pStyle w:val="Heading/g)).toHaveLength(2);
  });
});
