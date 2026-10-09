import { describe, expect, it } from "vitest";
import {
  type Box,
  attachSideFor,
  axisForLayoutKind,
  branchEndpoints,
  branchGrowthFactor,
  branchRender,
  branchWidths,
  childrenAxis,
  computeAxisByParent,
  crosslinkBezier,
  elbowPath,
  fanTrunkFactor,
  sideEndpoints,
  taperedRibbonPath,
} from "../src/mindmap/flow/floating";
import { boundaryPath, dashArray } from "../src/mindmap/flow/geometry";

// The organic branch connectors: one shared origin per parent-side, enter-from-near-end, overlap-touch,
// chunky taper. Pure geometry shared by the canvas (BranchEdge) + the SVG exporter (canvas == export).

const box = (cx: number, cy: number, w = 100, h = 30): Box => ({ cx, cy, w, h });

describe("branch geometry", () => {
  it("childrenAxis: horizontal when children spread sideways, vertical when stacked", () => {
    const p = box(0, 0);
    expect(childrenAxis(p, [box(200, -50), box(200, 0), box(200, 50)])).toBe("h");
    expect(childrenAxis(p, [box(-20, 200), box(0, 200), box(20, 200)])).toBe("v");
  });

  it("attachSideFor resolves the side along the dominant axis", () => {
    const p = box(0, 0);
    expect(attachSideFor(p, box(200, 10), "h")).toBe("right");
    expect(attachSideFor(p, box(-200, 10), "h")).toBe("left");
    expect(attachSideFor(p, box(10, 200), "v")).toBe("bottom");
    expect(attachSideFor(p, box(10, -200), "v")).toBe("top");
  });

  it("axisForLayoutKind pins the fan axis to the layout orientation", () => {
    expect(axisForLayoutKind("side")).toBe("h");
    expect(axisForLayoutKind("left")).toBe("h");
    expect(axisForLayoutKind("right")).toBe("h");
    expect(axisForLayoutKind("org-down")).toBe("v");
    expect(axisForLayoutKind("org-up")).toBe("v");
    // Layouts without a fixed orientation keep inferring per parent.
    expect(axisForLayoutKind("radial")).toBeUndefined();
    expect(axisForLayoutKind("timeline")).toBeUndefined();
  });

  it("computeAxisByParent: the orientation hint overrides the inferred axis", () => {
    // Two children far apart vertically but close horizontally — their subtrees stacked them, so the
    // spread is read as "v" (this is what made a child in a horizontal map enter "from below").
    const boxes: Record<string, Box> = { p: box(0, 0), a: box(120, -300), b: box(120, 300) };
    const rect = (id: string): Box | undefined => boxes[id];
    const edges = [
      { source: "p", target: "a" },
      { source: "p", target: "b" },
    ];
    expect(computeAxisByParent(edges, rect).get("p")).toBe("v"); // inferred (pre-fix)
    expect(computeAxisByParent(edges, rect, "h").get("p")).toBe("h"); // orientation-forced → left/right
  });

  it("branchEndpoints: ONE origin on the parent's near side + each child entered at its near end", () => {
    const parent = box(400, 200, 90, 28);
    const top = box(150, 40, 120, 26);
    const mid = box(150, 200, 120, 26);
    const bot = box(150, 360, 120, 26);
    const eTop = branchEndpoints(parent, top, "left");
    const eMid = branchEndpoints(parent, mid, "left");
    const eBot = branchEndpoints(parent, bot, "left");
    // Every sibling shares the same origin (the trunk), at the parent's left edge, tucked inside it.
    expect(eTop.sx).toBe(eMid.sx);
    expect(eMid.sx).toBe(eBot.sx);
    expect(eTop.sy).toBe(200);
    expect(eTop.sx).toBeGreaterThan(400 - 90 / 2); // inside the left edge (overlap-to-touch)
    // Target sits on the child's near (right) edge, tucked inside.
    expect(eMid.tx).toBeLessThan(150 + 120 / 2);
    // Enter from the near end: the top child connects near its lower edge, the bottom near its upper.
    expect(eTop.ty).toBeGreaterThan(40); // below the top child's centre → its near (lower) end
    expect(eBot.ty).toBeLessThan(360); // above the bottom child's centre → its near (upper) end
    expect(eMid.ty).toBe(200); // a level child enters at its mid
  });

  it("taperedRibbonPath is a closed filled ribbon", () => {
    const d = taperedRibbonPath(0, 0, -200, -100, "left", 6, 1.5);
    expect(d.startsWith("M ")).toBe(true);
    expect(d.trim().endsWith("Z")).toBe(true);
    expect(d).toBe(taperedRibbonPath(0, 0, -200, -100, "left", 6, 1.5)); // deterministic
  });

  it("taperedRibbonPath keeps width on an axis-aligned branch (no zero-area collapse)", () => {
    // 'right' side but the child sits straight below → dx===0; must fall back to the chord normal so
    // the ribbon doesn't degenerate to an invisible zero-area path.
    const d = taperedRibbonPath(133, 100, 133, 160, "right", 7.5, 2.4);
    const m = d.match(/^M ([\d.-]+) ([\d.-]+)/) as RegExpMatchArray;
    expect(Math.abs(Number(m[1]) - 133)).toBeGreaterThan(5); // start is offset off the spine
    // vertical-side mirror: 'bottom' with the child straight to the right → dy===0
    const v = taperedRibbonPath(100, 133, 160, 133, "bottom", 7.5, 2.4);
    const mv = v.match(/^M ([\d.-]+) ([\d.-]+)/) as RegExpMatchArray;
    expect(Math.abs(Number(mv[2]) - 133)).toBeGreaterThan(5);
  });

  it("boundaryPath: every shape is a closed path (cloud bumps, polygon corners, ellipse arcs)", () => {
    expect(boundaryPath("rect", 0, 0, 100, 60)).toBe("M 0 0 H 100 V 60 H 0 Z");
    expect(boundaryPath("roundRect", 0, 0, 100, 60)).toContain("A"); // rounded corners
    expect(boundaryPath("ellipse", 0, 0, 100, 60)).toContain("A"); // arcs
    expect(boundaryPath("polygon", 0, 0, 100, 60)).toContain("L"); // cut corners
    expect(boundaryPath("cloud", 0, 0, 100, 60)).toContain("Q"); // scalloped bumps
    for (const s of ["roundRect", "rect", "ellipse", "polygon", "cloud"] as const)
      expect(boundaryPath(s, 0, 0, 100, 60).trim().endsWith("Z"), s).toBe(true);
  });

  it("boundaryPath roundRect clamps its corner radius so a small box can't invert", () => {
    // rr is clamped to min(16, w/2, h/2); a 10×8 box stays within [0,10]×[0,8] with no backwards run.
    const d = boundaryPath("roundRect", 0, 0, 10, 8);
    expect(d).not.toMatch(/-\d/); // no negative coordinate (the un-clamped rr=16 produced H -6 / V -8)
    expect(d.trim().endsWith("Z")).toBe(true);
  });

  it("dashArray maps the dash styles", () => {
    expect(dashArray("solid")).toBe("");
    expect(dashArray("dashed")).toBe("6 5");
    expect(dashArray("dotted")).toBe("2 4");
    expect(dashArray(undefined)).toBe("");
  });

  it("branchWidths tapers thinner with depth (chunky main branches → fine sub-branches)", () => {
    expect(branchWidths(1).trunk).toBeGreaterThan(branchWidths(3).trunk);
    expect(branchWidths(1).trunk).toBeGreaterThan(branchWidths(1).tip);
  });

  it("branchGrowth scales branch widths (fine < regular < bold), regular == the historical default", () => {
    expect(branchGrowthFactor("regular")).toBe(1);
    expect(branchGrowthFactor(undefined)).toBe(1); // absent = regular
    expect(branchGrowthFactor("fine")).toBeLessThan(1);
    expect(branchGrowthFactor("bold")).toBeGreaterThan(1);
    // regular keeps today's numbers exactly (no behaviour change for existing maps)
    expect(branchWidths(1, "regular")).toEqual(branchWidths(1));
    // fine thins, bold thickens — both trunk + tip
    expect(branchWidths(1, "fine").trunk).toBeLessThan(branchWidths(1).trunk);
    expect(branchWidths(1, "bold").trunk).toBeGreaterThan(branchWidths(1).trunk);
    expect(branchWidths(1, "bold").tip).toBeGreaterThan(branchWidths(1, "fine").tip);
  });

  it("thins the trunk for dense fans so the shared origin doesn't blob (≤3 children unchanged)", () => {
    expect(fanTrunkFactor(undefined)).toBe(1);
    expect(fanTrunkFactor(3)).toBe(1); // ordinary fan — no change
    expect(fanTrunkFactor(5)).toBeLessThan(1); // dense fan — thinner trunk
    expect(fanTrunkFactor(9)).toBe(0.7); // clamped floor
    // trunk shrinks with fan size; tip (at the child) is untouched
    expect(branchWidths(1, "regular", 6).trunk).toBeLessThan(branchWidths(1, "regular", 2).trunk);
    expect(branchWidths(1, "regular", 6).tip).toBe(branchWidths(1, "regular", 2).tip);
    // a sparse fan (≤3) renders exactly as before this fix — no regression for ordinary maps
    expect(branchWidths(2, "regular", 3)).toEqual(branchWidths(2, "regular"));
  });

  it("branchRender applies branchGrowth to the tapered ribbon AND the uniform stroke (canvas == export)", () => {
    const p = box(0, 0, 100, 40);
    const c = box(200, 0, 100, 40);
    // Tapered ribbon: a bolder growth produces a visibly larger filled path string.
    const fine = branchRender(p, c, "right", { depth: 1, branchGrowth: "fine" });
    const bold = branchRender(p, c, "right", { depth: 1, branchGrowth: "bold" });
    expect(fine.d).not.toBe(bold.d);
    // Uniform stroke (elbow): the stroke width scales with growth.
    const elbowFine = branchRender(p, c, "right", {
      connectorStyle: "elbow",
      branchGrowth: "fine",
    });
    const elbowBold = branchRender(p, c, "right", {
      connectorStyle: "elbow",
      branchGrowth: "bold",
    });
    expect(elbowBold.width).toBeGreaterThan(elbowFine.width);
  });

  it("crosslinkBezier: a deterministic perpendicular-bow cubic shared canvas == export", () => {
    const { path } = crosslinkBezier(0, 0, 200, 100);
    // Control points are offset PERPENDICULAR to the chord (auto-bow), the same shape the live canvas
    // + the SVG exporter both emit (canvas == export) — byte-stable for a fixed input.
    expect(path).toBe("M 0 0 C 52.67 61.33 119.33 94.67 200 100");
    expect(crosslinkBezier(0, 0, 200, 100).path).toBe(path); // deterministic
  });

  it("branchRender: filled ribbon for organic; uniform stroke for elbow/curved/straight; dash → stroke", () => {
    const p = box(0, 0, 100, 40);
    const c = box(200, 0, 100, 40);
    const organic = branchRender(p, c, "right", { depth: 1 });
    expect(organic.fill).not.toBeNull(); // the chunky taper is a FILLED ribbon
    expect(organic.stroke).toBeNull();
    const elbow = branchRender(p, c, "right", { depth: 1, connectorStyle: "elbow" });
    expect(elbow.fill).toBeNull();
    expect(elbow.stroke).not.toBeNull();
    const straight = branchRender(p, c, "right", { connectorStyle: "straight" });
    expect(straight.d).toMatch(/^M [\d.]+ [\d.]+ L /); // a single line
    const curved = branchRender(p, c, "right", { connectorStyle: "curved" });
    expect(curved.d).toContain("C"); // a cubic
    // a dashed branch can't be a filled ribbon → falls back to a uniform stroked curve
    const dashed = branchRender(p, c, "right", { connectorStyle: "organic", dash: "dashed" });
    expect(dashed.fill).toBeNull();
    expect(dashed.stroke).not.toBeNull();
    expect(dashed.dash).toBe("6 4");
  });

  it("crosslinkBezier: bows perpendicular to the chord; `curve` overrides it (0 = straight)", () => {
    // Horizontal chord (0,0)→(200,0): the perpendicular is vertical, so the bow shows up in labelY.
    expect(crosslinkBezier(0, 0, 200, 0).labelY).not.toBe(0); // a gentle auto-bow by default
    expect(crosslinkBezier(0, 0, 200, 0, 0).labelY).toBe(0); // curve 0 → a straight line
    expect(Math.abs(crosslinkBezier(0, 0, 200, 0, 50).labelY)).toBeGreaterThan(20); // a bigger bow
    expect(crosslinkBezier(0, 0, 200, 0, 50).path).toContain("C");
  });

  it("elbowPath: a right-angle org-chart connector from parent-bottom-centre to child-top-centre", () => {
    const parent = box(0, 0, 100, 40); // centre (0,0) → bottom edge at y=20
    const child = box(60, 200, 100, 40); // below + offset → top edge at y=180
    const d = elbowPath(parent, child, "bottom");
    expect(d.startsWith("M 0 20")).toBe(true); // leaves the parent's bottom CENTRE
    expect(d.trimEnd().endsWith("60 180")).toBe(true); // ends at the child's top CENTRE
    expect(d).toContain("Q"); // routes via a rounded mid-bus, not one diagonal
    expect(elbowPath(parent, child, "bottom")).toBe(d); // deterministic
  });

  it("elbowPath: a horizontal-bus connector for a side attach (rounded, parent-right → child-left)", () => {
    const parent = box(0, 0, 100, 40); // right edge at x=50
    const child = box(260, 120, 100, 40); // to the right + below → left edge at x=210
    const d = elbowPath(parent, child, "right");
    expect(d.startsWith("M 50 0")).toBe(true); // leaves the parent's right CENTRE
    expect(d.trimEnd().endsWith("210 120")).toBe(true); // ends at the child's left CENTRE
    expect(d).toContain("Q"); // rounded vertical mid-bus
  });

  it("elbowPath: degenerates to square corners when the offset is tiny (r < 0.5)", () => {
    const parent = box(0, 0, 100, 40); // right edge x=50
    const child = box(50.5, 0.2, 0, 0); // barely offset → corner radius collapses
    const d = elbowPath(parent, child, "right");
    expect(d).not.toContain("Q"); // no rounded quad — just L segments
    expect(d.startsWith("M 50 0")).toBe(true);
  });

  it("sideEndpoints: near-edge centres on the parent's attach side", () => {
    const parent = box(0, 0, 100, 40);
    const child = box(260, 0, 100, 40);
    expect(sideEndpoints(parent, child, "right")).toMatchObject({ sx: 50, sy: 0, tx: 210, ty: 0 });
    expect(sideEndpoints(parent, child, "left")).toMatchObject({ sx: -50, tx: 310 });
    const below = box(0, 200, 100, 40);
    expect(sideEndpoints(parent, below, "bottom")).toMatchObject({ sy: 20, ty: 180 });
    expect(sideEndpoints(parent, below, "top")).toMatchObject({ sy: -20, ty: 220 });
  });
});
