import { describe, expect, it } from "vitest";
import {
  canvasShapeGeometry,
  containerLanes,
  dragBox,
  isContainer,
  nodesInside,
  resolveShapeStyle,
} from "../src/mindmap/flow/canvasShapes";
import { buildFlowSvg } from "../src/mindmap/flow/exportSvg";
import {
  addShape,
  deleteShape,
  setShapeColor,
  setShapeKind,
  setShapeLabel,
  setShapePos,
  setShapeSize,
} from "../src/mindmap/flow/ops";
import { moveShapeAndCapture } from "../src/mindmap/flow/shapeCapture";
import type { CanvasShape, MindMapDoc } from "../src/model/types";

const shape = (over: Partial<CanvasShape> = {}): CanvasShape => ({
  id: "s1",
  kind: "rect",
  pos: { x: 10, y: 20 },
  size: { w: 200, h: 100 },
  ...over,
});

const docWith = (shapes: CanvasShape[]): MindMapDoc => ({
  schemaVersion: 1,
  id: "d",
  title: "T",
  root: { id: "r", topic: "Root", children: [] },
  shapes,
});

describe("canvasShapeGeometry (item 23)", () => {
  it("rect → one rounded rect primitive at the shape's box", () => {
    const g = canvasShapeGeometry(shape({ kind: "rect" }));
    expect(g.bbox).toEqual({ x: 10, y: 20, w: 200, h: 100 });
    const rects = g.prims.filter((p) => p.t === "rect");
    expect(rects).toHaveLength(1);
    expect(rects[0]).toMatchObject({ x: 10, y: 20, w: 200, h: 100 });
  });

  it("ellipse → one ellipse centred in the box with half-extent radii", () => {
    const g = canvasShapeGeometry(shape({ kind: "ellipse" }));
    const e = g.prims.find((p) => p.t === "ellipse");
    expect(e).toMatchObject({ cx: 110, cy: 70, rx: 100, ry: 50 });
  });

  it("blockArrow + chevron → a single path primitive each", () => {
    expect(
      canvasShapeGeometry(shape({ kind: "blockArrow" })).prims.filter((p) => p.t === "path"),
    ).toHaveLength(1);
    expect(
      canvasShapeGeometry(shape({ kind: "chevron" })).prims.filter((p) => p.t === "path"),
    ).toHaveLength(1);
  });

  it("swimlane → outer rect + header line + (lanes-1) dividers + a label", () => {
    const g = canvasShapeGeometry(shape({ kind: "swimlane", lanes: 3, label: "Board" }));
    expect(g.prims.filter((p) => p.t === "rect")).toHaveLength(1);
    // header divider + 2 lane dividers = 3 lines
    expect(g.prims.filter((p) => p.t === "line")).toHaveLength(3);
    expect(g.prims.find((p) => p.t === "text")).toMatchObject({ s: "Board" });
  });

  it("matrix → outer rect + (cols-1) vertical + (rows-1) horizontal dividers", () => {
    const g = canvasShapeGeometry(shape({ kind: "matrix", lanes: 2, rows: 2 }));
    // 1 vertical + 1 horizontal divider
    expect(g.prims.filter((p) => p.t === "line")).toHaveLength(2);
  });

  it("resolveShapeStyle uses the override colour, else the default accent", () => {
    expect(resolveShapeStyle("#ff0000").stroke).toBe("#ff0000");
    expect(resolveShapeStyle().stroke).toBe("#8a84c6");
  });

  it("isContainer + containerLanes classify + clamp", () => {
    expect(isContainer("swimlane")).toBe(true);
    expect(isContainer("rect")).toBe(false);
    expect(containerLanes(shape({ lanes: 99 }))).toBe(12); // clamped
    expect(containerLanes(shape({ lanes: undefined }))).toBe(3); // default
  });
});

describe("dragBox — move + corner resize math (item 23)", () => {
  const box = { x: 100, y: 100, w: 200, h: 120 };

  it("move slides the whole box, no clamp", () => {
    expect(dragBox(box, "move", 30, -20)).toEqual({ x: 130, y: 80, w: 200, h: 120 });
  });

  it("se grows width + height from the top-left anchor", () => {
    expect(dragBox(box, "se", 40, 10)).toEqual({ x: 100, y: 100, w: 240, h: 130 });
  });

  it("nw moves the origin and shrinks toward the bottom-right anchor", () => {
    expect(dragBox(box, "nw", 20, 30)).toEqual({ x: 120, y: 130, w: 180, h: 90 });
  });

  it("ne + sw adjust the right corners correctly", () => {
    expect(dragBox(box, "ne", 10, 15)).toEqual({ x: 100, y: 115, w: 210, h: 105 });
    expect(dragBox(box, "sw", -10, 5)).toEqual({ x: 90, y: 100, w: 210, h: 125 });
  });

  it("clamps to the minimum grabbable size on a large shrink", () => {
    // Dragging se far past the origin can't shrink below the 40×30 minimum.
    expect(dragBox(box, "se", -500, -500)).toMatchObject({ w: 40, h: 30 });
  });

  it("keeps the opposite (anchor) corner fixed when the min-clamp engages (each corner)", () => {
    // A box already at the minimum: any INWARD corner drag can't shrink further and must leave the box
    // exactly where it was — the anchor corner never drifts. (Inward = toward the anchor.)
    const min = { x: 100, y: 100, w: 40, h: 30 };
    const same = { x: 100, y: 100, w: 40, h: 30 };
    expect(dragBox(min, "nw", 25, 25)).toEqual(same); // toward SE
    expect(dragBox(min, "ne", -25, 25)).toEqual(same); // toward SW
    expect(dragBox(min, "sw", 25, -25)).toEqual(same); // toward NE
    expect(dragBox(min, "se", -25, -25)).toEqual(same); // toward NW
  });

  it("pins the anchor corner from a larger box when dragged far past the minimum", () => {
    // box SE = (300, 220). Dragging nw far inward clamps the box to min but keeps SE at (300, 220).
    const r = dragBox({ x: 100, y: 100, w: 200, h: 120 }, "nw", 300, 300);
    expect(r).toEqual({ x: 260, y: 190, w: 40, h: 30 });
    expect(r.x + r.w).toBe(300); // right edge (anchor.x) unchanged
    expect(r.y + r.h).toBe(220); // bottom edge (anchor.y) unchanged
  });
});

describe("shape ops (item 23)", () => {
  it("addShape appends a shape centred on pos, defaults its size, and selects it", () => {
    const { doc, selectId } = addShape(docWith([]), "rect", { x: 100, y: 100 });
    expect(doc.shapes).toHaveLength(1);
    const s = doc.shapes?.[0];
    expect(s?.kind).toBe("rect");
    // centred on (100,100) with the 260×170 rect default
    expect(s?.pos).toEqual({ x: 100 - 130, y: 100 - 85 });
    expect(selectId).toBe(s?.id);
  });

  it("addShape seeds container defaults (swimlane lanes, matrix lanes+rows)", () => {
    expect(addShape(docWith([]), "swimlane").doc.shapes?.[0]).toMatchObject({ lanes: 3 });
    expect(addShape(docWith([]), "matrix").doc.shapes?.[0]).toMatchObject({ lanes: 2, rows: 2 });
  });

  it("does not mutate the input doc", () => {
    const before = docWith([]);
    addShape(before, "rect");
    expect(before.shapes).toEqual([]);
  });

  it("setShapePos / setShapeSize (min-clamped) move + resize", () => {
    const d0 = docWith([shape()]);
    expect(setShapePos(d0, "s1", 5, 6).doc.shapes?.[0].pos).toEqual({ x: 5, y: 6 });
    expect(setShapeSize(d0, "s1", 10, 5).doc.shapes?.[0].size).toEqual({ w: 40, h: 30 }); // clamped
  });

  it("setShapeColor / setShapeLabel clear on empty string", () => {
    const d0 = docWith([shape({ color: "#123456", label: "x" })]);
    expect(setShapeColor(d0, "s1", "").doc.shapes?.[0].color).toBeUndefined();
    expect(setShapeLabel(d0, "s1", "").doc.shapes?.[0].label).toBeUndefined();
  });

  it("setShapeKind swaps the kind; deleteShape removes by id", () => {
    const d0 = docWith([shape()]);
    expect(setShapeKind(d0, "s1", "ellipse").doc.shapes?.[0].kind).toBe("ellipse");
    expect(deleteShape(d0, "s1").doc.shapes).toEqual([]);
  });

  it("a missing id is a no-op returning the same doc", () => {
    const d0 = docWith([shape()]);
    expect(setShapePos(d0, "ghost", 0, 0).doc).toBe(d0);
    expect(deleteShape(d0, "ghost").doc).toBe(d0);
  });
});

describe("smart containers — capture + move (item 22)", () => {
  const container = shape({ kind: "swimlane", pos: { x: 0, y: 0 }, size: { w: 200, h: 200 } });
  // Topic A's centre (100,100) is inside the container; B's centre (500,500) is outside.
  const rects = [
    { id: "a", x: 80, y: 80, w: 40, h: 40 },
    { id: "b", x: 480, y: 480, w: 40, h: 40 },
  ];

  it("nodesInside captures topics whose centre falls inside the box", () => {
    expect(nodesInside(container, rects)).toEqual(["a"]);
    // A topic exactly on the edge counts; well outside does not.
    expect(nodesInside(container, [{ id: "e", x: 180, y: 180, w: 40, h: 40 }])).toEqual(["e"]); // centre (200,200) on corner
    expect(nodesInside(container, [{ id: "o", x: 201, y: 0, w: 40, h: 40 }])).toEqual([]);
  });

  const docWithNodes = (): MindMapDoc => ({
    schemaVersion: 1,
    id: "d",
    title: "T",
    root: {
      id: "r",
      topic: "Root",
      children: [
        { id: "a", topic: "A", pos: { x: 80, y: 80 }, children: [] },
        { id: "b", topic: "B", pos: { x: 480, y: 480 }, children: [] },
      ],
    },
    shapes: [container],
  });

  it("dragging a container carries its captured topics by the same delta (one step)", () => {
    // Move the container from (0,0) to (50,60): delta (+50,+60). Only A (inside) should follow.
    const { doc } = moveShapeAndCapture(docWithNodes(), "s1", 50, 60, rects);
    expect(doc.shapes?.[0].pos).toEqual({ x: 50, y: 60 });
    const a = doc.root.children.find((n) => n.id === "a");
    const b = doc.root.children.find((n) => n.id === "b");
    expect(a?.pos).toEqual({ x: 80 + 50, y: 80 + 60 }); // captured → moved
    expect(b?.pos).toEqual({ x: 480, y: 480 }); // outside → untouched
  });

  it("a plain (non-container) shape moves alone, capturing nothing", () => {
    const withRect: MindMapDoc = {
      ...docWithNodes(),
      shapes: [shape({ kind: "rect", pos: { x: 0, y: 0 }, size: { w: 200, h: 200 } })],
    };
    const { doc } = moveShapeAndCapture(withRect, "s1", 50, 60, rects);
    expect(doc.shapes?.[0].pos).toEqual({ x: 50, y: 60 });
    expect(doc.root.children.find((n) => n.id === "a")?.pos).toEqual({ x: 80, y: 80 }); // unmoved
  });

  it("a missing shape id is a no-op", () => {
    const d0 = docWithNodes();
    expect(moveShapeAndCapture(d0, "ghost", 5, 5, rects).doc).toBe(d0);
  });
});

describe("shape export (canvas == export, item 23)", () => {
  it("emits the shape's SVG in the exported map, framed to include it", () => {
    const doc = docWith([
      shape({ kind: "rect", pos: { x: 500, y: 500 }, size: { w: 100, h: 80 } }),
    ]);
    const svg = buildFlowSvg(doc, new Map(), ["#111"], {});
    // The rect lands in the export with its box, and the viewBox expands to include it.
    expect(svg).toContain('width="100"');
    expect(svg).toContain('height="80"');
    expect(svg).toMatch(/<rect[^>]*x="500"[^>]*y="500"/);
  });
});
