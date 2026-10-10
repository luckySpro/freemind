import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { engineeringSections } from "../src/io/engineeringDocument";
import { buildEngineeringDocx } from "../src/io/engineeringDocx";
import type { MapNode, MindMapDoc } from "../src/model/types";

const node = (id: string, children: MapNode[] = []): MapNode => ({ id, topic: id, children });
const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "shared",
  title: "Report",
  root: { ...node("root", [node("A", [node("A1"), node("A2")]), node("B")]), note: "Overview" },
};

describe("shared engineering document chapters", () => {
  it("uses preorder, sibling numbering and stable bookmarks without a root chapter", async () => {
    const sections = engineeringSections(doc);
    expect(sections.map(({ title, level, bookmark }) => ({ title, level, bookmark }))).toEqual([
      { title: "1 A", level: 1, bookmark: "section_1" },
      { title: "1.1 A1", level: 2, bookmark: "section_2" },
      { title: "1.2 A2", level: 2, bookmark: "section_3" },
      { title: "2 B", level: 1, bookmark: "section_4" },
    ]);
    expect(sections[0].node).toBe(doc.root.children[0]);
    const xml = strFromU8(unzipSync(await buildEngineeringDocx(doc))["word/document.xml"]);
    expect(xml).toContain("Overview");
    for (const section of sections) {
      expect(xml).toContain(section.title);
      expect(xml).toContain(`w:name="${section.bookmark}"`);
    }
    expect(xml.match(/w:pStyle w:val="Heading/g)).toHaveLength(sections.length);
  });

  it("clamps outline depth to nine while retaining the complete chapter number", () => {
    let nested = node("leaf");
    for (let depth = 0; depth < 10; depth++) nested = node(`level${depth}`, [nested]);
    const deep = { ...doc, root: node("root", [nested]) };
    const sections = engineeringSections(deep);
    expect(sections.map((section) => section.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 9]);
    expect(sections[10].title).toBe(`${Array(11).fill(1).join(".")} leaf`);
    expect(engineeringSections({ ...doc, root: node("root") })).toEqual([]);
  });
});
