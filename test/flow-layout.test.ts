import { describe, expect, it } from "vitest";
import { computeLayout } from "../src/mindmap/flow/layout";
import { project } from "../src/mindmap/flow/project";
import type { MindMapDoc } from "../src/model/types";

const size = () => ({ width: 100, height: 40 });

const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "R",
  root: {
    id: "r",
    topic: "R",
    children: [
      { id: "a", topic: "A", side: "right", children: [{ id: "a1", topic: "A1", children: [] }] },
      { id: "b", topic: "B", side: "left", children: [] },
      { id: "c", topic: "C", side: "right", children: [] },
    ],
  },
};

describe("flow layout (two-sided tidy tree)", () => {
  const { nodes, edges } = project(doc);
  const pos = computeLayout(nodes, edges, size);

  it("positions every node with finite coordinates", () => {
    for (const n of nodes) {
      const p = pos.get(n.id);
      expect(p).toBeDefined();
      expect(Number.isFinite(p?.x)).toBe(true);
      expect(Number.isFinite(p?.y)).toBe(true);
    }
  });

  it("splits right children to the right of the root and left children to the left", () => {
    const r = pos.get("r");
    if (!r) throw new Error("no root position");
    expect(pos.get("a")?.x ?? 0).toBeGreaterThan(r.x);
    expect(pos.get("c")?.x ?? 0).toBeGreaterThan(r.x);
    expect(pos.get("b")?.x ?? 0).toBeLessThan(r.x);
  });

  it("places a grandchild further out than its parent", () => {
    expect(pos.get("a1")?.x ?? 0).toBeGreaterThan(pos.get("a")?.x ?? 0);
  });

  it("separates two same-side siblings vertically", () => {
    expect(pos.get("a")?.y).not.toBe(pos.get("c")?.y);
  });
});

describe("flow layout (alternate kinds)", () => {
  const { nodes, edges } = project(doc);
  const allFinite = (m: ReturnType<typeof computeLayout>) =>
    [...m.values()].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

  it("org-down places children below the root and deeper rows lower", () => {
    const pos = computeLayout(nodes, edges, size, "org-down");
    expect(allFinite(pos)).toBe(true);
    const ry = pos.get("r")?.y ?? 0;
    expect(pos.get("a")?.y ?? 0).toBeGreaterThan(ry);
    expect(pos.get("a1")?.y ?? 0).toBeGreaterThan(pos.get("a")?.y ?? 0);
  });

  it("org-up mirrors org-down (children above the root)", () => {
    const pos = computeLayout(nodes, edges, size, "org-up");
    expect(allFinite(pos)).toBe(true);
    expect(pos.get("a")?.y ?? 0).toBeLessThan(pos.get("r")?.y ?? 0);
  });

  it("radial scatters depth-1 nodes off the centre at a similar radius", () => {
    const pos = computeLayout(nodes, edges, size, "radial");
    expect(allFinite(pos)).toBe(true);
    const r = pos.get("r");
    if (!r) throw new Error("no root");
    const dist = (id: string) => {
      const p = pos.get(id);
      if (!p) return 0;
      return Math.hypot(p.x - r.x, p.y - r.y);
    };
    expect(dist("a")).toBeGreaterThan(50);
    // a and c are both depth-1 → roughly the same ring
    expect(Math.abs(dist("a") - dist("c"))).toBeLessThan(dist("a"));
  });

  it("timeline and fishbone produce finite positions for every node", () => {
    expect(allFinite(computeLayout(nodes, edges, size, "timeline"))).toBe(true);
    expect(allFinite(computeLayout(nodes, edges, size, "fishbone"))).toBe(true);
  });

  it("brace lays out as a left-to-right tree (children right of root, deeper further right)", () => {
    const pos = computeLayout(nodes, edges, size, "brace");
    expect(allFinite(pos)).toBe(true);
    const rx = pos.get("r")?.x ?? 0;
    expect(pos.get("a")?.x ?? 0).toBeGreaterThan(rx);
    expect(pos.get("c")?.x ?? 0).toBeGreaterThan(rx);
    expect(pos.get("a1")?.x ?? 0).toBeGreaterThan(pos.get("a")?.x ?? 0);
  });

  it("per-branch layout: a branch with a layout override uses its own kind, not the map's", () => {
    const odoc: MindMapDoc = {
      schemaVersion: 1,
      id: "o",
      title: "R",
      root: {
        id: "r",
        topic: "R",
        children: [
          {
            id: "ov",
            topic: "Override",
            layout: "org-down", // children should go BELOW, siblings spread horizontally
            children: [
              { id: "ov1", topic: "C1", children: [] },
              { id: "ov2", topic: "C2", children: [] },
            ],
          },
          { id: "sib", topic: "Sibling", children: [] },
        ],
      },
    };
    const p = project(odoc);
    const pos = computeLayout(p.nodes, p.edges, size, "side"); // map = two-sided (horizontal)
    expect(allFinite(pos)).toBe(true);
    const ov = pos.get("ov");
    const c1 = pos.get("ov1");
    const c2 = pos.get("ov2");
    if (!ov || !c1 || !c2) throw new Error("missing positions");
    // org-down: both children below the override root...
    expect(c1.y).toBeGreaterThan(ov.y);
    expect(c2.y).toBeGreaterThan(ov.y);
    // ...on the same row (≈ equal y) and spread horizontally (distinct x) — the override's shape,
    // not the map's "side" shape (which would stack them vertically in one column).
    expect(Math.abs(c1.y - c2.y)).toBeLessThan(30);
    expect(c1.x).not.toBe(c2.x);
  });

  it("per-branch layout composes when overrides nest (org-down branch containing a grid branch)", () => {
    const odoc: MindMapDoc = {
      schemaVersion: 1,
      id: "nest",
      title: "R",
      root: {
        id: "r",
        topic: "R",
        children: [
          {
            id: "ov",
            topic: "Override",
            layout: "org-down",
            children: [
              {
                id: "g",
                topic: "Grid",
                layout: "grid", // a nested override inside the org-down subtree
                children: [
                  { id: "g1", topic: "G1", children: [] },
                  { id: "g2", topic: "G2", children: [] },
                  { id: "g3", topic: "G3", children: [] },
                  { id: "g4", topic: "G4", children: [] },
                ],
              },
              { id: "sib", topic: "Sib", children: [] },
            ],
          },
        ],
      },
    };
    const p = project(odoc);
    const pos = computeLayout(p.nodes, p.edges, size, "side");
    expect(allFinite(pos)).toBe(true); // the deep depth-rebase doesn't NaN
    // org-down at the outer override: its children sit below it
    expect(pos.get("g")?.y ?? 0).toBeGreaterThan(pos.get("ov")?.y ?? 0);
    // grid at the inner override: its 4 children span two columns and two rows
    const gx = new Set(["g1", "g2", "g3", "g4"].map((id) => pos.get(id)?.x));
    const gy = new Set(["g1", "g2", "g3", "g4"].map((id) => pos.get(id)?.y));
    expect(gx.size).toBe(2);
    expect(gy.size).toBe(2);
  });

  it("freeform places nodes at their own pos, with a beside-parent fallback for pos-less nodes", () => {
    const fdoc: MindMapDoc = {
      schemaVersion: 1,
      id: "f",
      title: "F",
      meta: { freeform: true },
      root: {
        id: "r",
        topic: "R",
        pos: { x: 100, y: 100 },
        children: [
          { id: "a", topic: "A", pos: { x: 300, y: 140 }, children: [] },
          { id: "b", topic: "B", children: [] }, // no pos → fallback beside the root
        ],
      },
    };
    const p = project(fdoc);
    const pos = computeLayout(p.nodes, p.edges, size, "freeform");
    expect(pos.get("r")).toEqual({ x: 100, y: 100 }); // verbatim pos (top-left)
    expect(pos.get("a")).toEqual({ x: 300, y: 140 });
    // b lacks pos → beside its parent: root x(100) + width(100) + 48 = 248, same y
    expect(pos.get("b")).toEqual({ x: 248, y: 100 });
  });

  it("grid tiles the root's branches and keeps each branch's subtree below it", () => {
    // 4 branches → a 2×2 matrix (SWOT-shaped)
    const swot: MindMapDoc = {
      schemaVersion: 1,
      id: "g",
      title: "SWOT",
      root: {
        id: "r",
        topic: "SWOT",
        children: [
          { id: "s", topic: "Strengths", children: [{ id: "s1", topic: "S1", children: [] }] },
          { id: "w", topic: "Weaknesses", children: [] },
          { id: "o", topic: "Opportunities", children: [] },
          { id: "t", topic: "Threats", children: [] },
        ],
      },
    };
    const p = project(swot);
    const pos = computeLayout(p.nodes, p.edges, size, "grid");
    expect(allFinite(pos)).toBe(true);
    const xs = ["s", "w", "o", "t"].map((id) => pos.get(id)?.x ?? 0);
    const ys = ["s", "w", "o", "t"].map((id) => pos.get(id)?.y ?? 0);
    // two distinct columns and two distinct rows → a 2×2 grid
    expect(new Set(xs).size).toBe(2);
    expect(new Set(ys).size).toBe(2);
    // the root sits above every quadrant (title on top)
    const ry = pos.get("r")?.y ?? 0;
    for (const y of ys) expect(y).toBeGreaterThan(ry);
    // a branch's child stays within its cell (below the branch)
    expect(pos.get("s1")?.y ?? 0).toBeGreaterThan(pos.get("s")?.y ?? 0);
  });

  it("swimlane lays the root's branches out as one row of lanes (#7)", () => {
    const lanes: MindMapDoc = {
      schemaVersion: 1,
      id: "sl",
      title: "Lanes",
      root: {
        id: "r",
        topic: "Lanes",
        children: [
          { id: "a", topic: "A", children: [{ id: "a1", topic: "A1", children: [] }] },
          { id: "b", topic: "B", children: [] },
          { id: "c", topic: "C", children: [] },
          { id: "d", topic: "D", children: [] },
        ],
      },
    };
    const p = project(lanes);
    const pos = computeLayout(p.nodes, p.edges, size, "swimlane");
    expect(allFinite(pos)).toBe(true);
    const lane = ["a", "b", "c", "d"];
    const xs = lane.map((id) => pos.get(id)?.x ?? 0);
    const ys = lane.map((id) => pos.get(id)?.y ?? 0);
    // four lanes → four distinct columns, all level-1 headers on a single row (one y).
    expect(new Set(xs).size).toBe(4);
    expect(new Set(ys.map((y) => Math.round(y))).size).toBe(1);
    // columns are ordered left→right and each lane's child sits under its header.
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);
    expect(pos.get("a1")?.y ?? 0).toBeGreaterThan(pos.get("a")?.y ?? 0);
  });
});

describe("flow layout (per-subtree columns + height-proportional gaps + fishbone diagonal)", () => {
  // Two right-side branches, each with one child. Per-subtree columns mean a1's offset from `a`
  // depends only on `a`'s own width, not on the wide sibling (a global per-depth grid would push both).
  const colDoc: MindMapDoc = {
    schemaVersion: 1,
    id: "col",
    title: "R",
    root: {
      id: "r",
      topic: "R",
      children: [
        { id: "a", topic: "A", side: "right", children: [{ id: "a1", topic: "A1", children: [] }] },
        {
          id: "wide",
          topic: "Wide",
          side: "right",
          children: [{ id: "w1", topic: "W1", children: [] }],
        },
      ],
    },
  };
  const colP = project(colDoc);
  const sizeWith = (wideW: number) => (id: string) =>
    id === "wide" ? { width: wideW, height: 40 } : { width: 100, height: 40 };
  const gapAtoA1 = (wideW: number) => {
    const pos = computeLayout(colP.nodes, colP.edges, sizeWith(wideW), "right");
    return (pos.get("a1")?.x ?? 0) - (pos.get("a")?.x ?? 0);
  };

  it("per-subtree columns: a wide sibling doesn't push an unrelated branch's column out", () => {
    expect(gapAtoA1(320)).toBeCloseTo(gapAtoA1(100)); // a→a1 spacing is independent of 'wide'
  });

  it("height-proportional gaps: taller siblings sit further apart", () => {
    const gapAt = (h: number) => {
      const pos = computeLayout(colP.nodes, colP.edges, () => ({ width: 100, height: h }), "right");
      return Math.abs((pos.get("a")?.y ?? 0) - (pos.get("wide")?.y ?? 0));
    };
    expect(gapAt(200)).toBeGreaterThan(gapAt(40)); // not a single global uniform slot
  });

  it("fishbone: sub-causes step diagonally outward along the bone (not straight down)", () => {
    const fdoc: MindMapDoc = {
      schemaVersion: 1,
      id: "fb",
      title: "R",
      root: {
        id: "r",
        topic: "R",
        children: [{ id: "a", topic: "A", children: [{ id: "a1", topic: "A1", children: [] }] }],
      },
    };
    const p = project(fdoc);
    const pos = computeLayout(p.nodes, p.edges, () => ({ width: 100, height: 40 }), "fishbone");
    const a = pos.get("a");
    const a1 = pos.get("a1");
    if (!a || !a1) throw new Error("missing fishbone positions");
    expect(a1.x).toBeLessThan(a.x); // further along the bone (leftward)
    expect(Math.abs(a1.y)).toBeGreaterThan(Math.abs(a.y)); // and further from the spine → diagonal
  });

  it("fishbone places sub-causes at ANY depth (depth ≥3 no longer collapse to the origin)", () => {
    const fdoc: MindMapDoc = {
      schemaVersion: 1,
      id: "fb3",
      title: "R",
      root: {
        id: "r",
        topic: "R",
        children: [
          {
            id: "a",
            topic: "A",
            children: [
              { id: "a1", topic: "A1", children: [{ id: "a1x", topic: "A1x", children: [] }] },
            ],
          },
        ],
      },
    };
    const p = project(fdoc);
    const pos = computeLayout(p.nodes, p.edges, () => ({ width: 100, height: 40 }), "fishbone");
    const a1 = pos.get("a1");
    const a1x = pos.get("a1x");
    if (!a1 || !a1x) throw new Error("depth-3 fishbone node was not placed");
    expect(Number.isFinite(a1x.x) && Number.isFinite(a1x.y)).toBe(true);
    expect(a1x.x !== 0 || a1x.y !== 0).toBe(true); // not stacked on the spine head at the origin
    expect(a1x.x).toBeLessThan(a1.x); // continues further out along the same bone than its parent
  });
});

describe("flow layout (band reservation → no box overlaps)", () => {
  // Reproduces the imported-map bug (an .mmap with wide leaf branches next to multi-child branches):
  // under d3's contour packing + a per-subtree major axis, a WIDE depth-1 leaf reached into an
  // adjacent branch's depth-2 column and collided (d3 only guards same-depth pairs, assuming a uniform
  // major column per depth — which the per-subtree major breaks). Band reservation gives every subtree
  // a disjoint breadth band, so no two boxes overlap at any depth while the per-subtree columns stay.
  const WIDE = new Set(["w1", "w2", "w3"]);
  const sizeOf = (id: string) => ({ width: WIDE.has(id) ? 320 : 100, height: 44 });
  const kids = (p: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `${p}${i}`, topic: `${p}${i}`, children: [] }));
  // Wide leaves interleaved with branches that fan out several children — the SSF shape.
  const doc: MindMapDoc = {
    schemaVersion: 1,
    id: "ov",
    title: "R",
    root: {
      id: "r",
      topic: "R",
      children: [
        { id: "w1", topic: "Wide leaf one", side: "right", children: [] },
        { id: "p", topic: "Parent", side: "right", children: kids("c", 3) },
        { id: "w2", topic: "Wide leaf two", side: "right", children: [] },
        { id: "q", topic: "Parent two", side: "right", children: kids("d", 4) },
        { id: "w3", topic: "Wide leaf three", side: "right", children: [] },
      ],
    },
  };
  const { nodes, edges } = project(doc);

  const rectsFor = (kind: Parameters<typeof computeLayout>[3]) => {
    const pos = computeLayout(nodes, edges, sizeOf, kind);
    return nodes.map((n) => {
      const p = pos.get(n.id);
      if (!p) throw new Error(`no position for ${n.id}`);
      const s = sizeOf(n.id);
      return { id: n.id, x: p.x, y: p.y, w: s.width, h: s.height };
    });
  };
  const firstOverlap = (rects: ReturnType<typeof rectsFor>) => {
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox > 1 && oy > 1) return `${a.id} ∩ ${b.id}`;
      }
    }
    return null;
  };

  it("two-sided: no two topic boxes overlap", () => {
    expect(firstOverlap(rectsFor("side"))).toBeNull();
  });

  it("single-sided (right): no two topic boxes overlap", () => {
    expect(firstOverlap(rectsFor("right"))).toBeNull();
  });
});
