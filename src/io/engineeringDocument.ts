import type { MapNode, MindMapDoc } from "../model/types";

export interface EngineeringSection {
  node: MapNode;
  title: string;
  level: number;
  bookmark: string;
}

/** Shared chapter order for Word and PDF. The root remains the cover/overview. */
export function engineeringSections(doc: MindMapDoc): EngineeringSection[] {
  const sections: EngineeringSection[] = [];
  const walk = (nodes: MapNode[], path: number[]) => {
    nodes.forEach((node, position) => {
      const numbers = [...path, position + 1];
      sections.push({
        node,
        title: `${numbers.join(".")} ${node.topic}`,
        level: Math.min(numbers.length, 9),
        bookmark: `section_${sections.length + 1}`,
      });
      walk(node.children, numbers);
    });
  };
  walk(doc.root.children, []);
  return sections;
}
