// Type declarations for the JS book-diagram module, so the TS test gets real
// types instead of implicit `any`.

export const BRANCH_PALETTE: string[];

export interface DiagramDef {
  caption: string;
  alt: string;
  model: { root: string; children: string[] };
}

export const DIAGRAMS: Record<string, DiagramDef>;

export function hasDiagram(name: string): boolean;
export function diagramCaption(name: string): string;

export interface DiagramNode {
  cx: number;
  cy: number;
  w: number;
  h: number;
  label: string;
  root: boolean;
  color: string;
}

export interface DiagramEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

export interface DiagramLayout {
  width: number;
  height: number;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export function diagramLayout(name: string): DiagramLayout;
export function diagramSvg(name: string): string;
