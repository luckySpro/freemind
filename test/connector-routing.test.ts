import { describe, expect, it } from "vitest";
import {
  type AttachSide,
  type Box,
  attachSideFor,
  axisForLayoutKind,
  bowToClear,
  branchEndpoints,
  computeAxisByParent,
} from "../src/mindmap/flow/floating";
import { computeLayout, estimateSizeOf } from "../src/mindmap/flow/layout";
import { project } from "../src/mindmap/flow/project";
import type { MapNode, MindMapDoc } from "../src/model/types";

// Obstacle-aware branch routing: a tapered branch bows AROUND any node box its straight path would
// otherwise pass behind. Pure geometry shared by the canvas (FlowMindMap stashes the bow on
// data.attachBow) and the SVG exporter (canvas == export). Core contract: bowToClear returns EITHER a
// bow that fully clears every nearby box, OR 0 (leave the branch straight) — it never returns a bow that
// displaces the branch yet still crosses a box.

const box = (cx: number, cy: number, w = 100, h = 30): Box => ({ cx, cy, w, h });
const withId = (boxes: Box[]): { id: string; box: Box }[] =>
  boxes.map((b, i) => ({ id: `o${i}`, box: b }));

// Deterministic PRNG (mulberry32) so the fuzz case is reproducible — no Math.random flake.
function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deepest penetration (>0 = inside) of the BOWED centerline cubic into `o`, sampled densely along the
// curve at margin 0 — i.e. a TRUE box overlap, independent of bowToClear's internal sampling/margin.
function maxPenetration(parent: Box, child: Box, side: AttachSide, o: Box, bow: number): number {
  const { sx, sy, tx, ty } = branchEndpoints(parent, child, side);
  const horizontal = side === "left" || side === "right";
  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.hypot(dx, dy) || 1;
  const cnx = -dy / len;
  const cny = dx / len;
  const c1x = (horizontal ? sx + dx * 0.5 : sx) + cnx * bow;
  const c1y = (horizontal ? sy : sy + dy * 0.5) + cny * bow;
  const c2x = (horizontal ? tx - dx * 0.5 : tx) + cnx * bow;
  const c2y = (horizontal ? ty : ty - dy * 0.5) + cny * bow;
  let pen = Number.NEGATIVE_INFINITY;
  // A deliberately dense oracle (far finer than bowToClear's own sampler) so this catches any aliasing
  // where the implementation's coarser sampling would step over a short box.
  for (let i = 0; i <= 800; i++) {
    const t = i / 800;
    const u = 1 - t;
    const px = u * u * u * sx + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * tx;
    const py = u * u * u * sy + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ty;
    pen = Math.max(pen, Math.min(o.w / 2 - Math.abs(px - o.cx), o.h / 2 - Math.abs(py - o.cy)));
  }
  return pen;
}

// The contract, checked: with the returned bow, either it's 0 (straight) or EVERY obstacle is cleared
// (true overlap <= 0). Returns the bow so callers can additionally assert it did / didn't move.
function bowAndAssertClearOrStraight(
  parent: Box,
  child: Box,
  side: AttachSide,
  obstacles: Box[],
): number {
  const others = withId(obstacles);
  const bow = bowToClear(parent, child, side, others, "src", "tgt");
  if (bow !== 0) {
    for (const o of others) {
      expect(
        maxPenetration(parent, child, side, o.box, bow),
        `bow=${bow} displaced the branch but it still crosses ${o.id}`,
      ).toBeLessThanOrEqual(0);
    }
  }
  return bow;
}

describe("obstacle-aware branch routing", () => {
  it("0 with a clear path; a non-zero bow that clears a single blocking box", () => {
    const parent = box(400, 200, 90, 28);
    const child = box(120, 70, 120, 26); // up-left of the parent → "left" side
    expect(bowToClear(parent, child, "left", [], "src", "tgt")).toBe(0);

    const blocker = box(270, 150, 110, 28); // squarely on the straight branch path
    expect(maxPenetration(parent, child, "left", blocker, 0)).toBeGreaterThan(0); // un-bowed hits it
    const bow = bowAndAssertClearOrStraight(parent, child, "left", [blocker]);
    expect(bow).not.toBe(0); // a clearing bow exists → it must bow, not give up
  });

  it("endpoint nodes are excluded — a branch never bows around its own parent/child box", () => {
    const parent = box(400, 200, 90, 28);
    const child = box(120, 200, 120, 26);
    // Pass the endpoint boxes themselves as `others`; with srcId/tgtId they are skipped → no bow.
    const others = [
      { id: "src", box: parent },
      { id: "tgt", box: child },
    ];
    expect(bowToClear(parent, child, "left", others, "src", "tgt")).toBe(0);
  });

  // --- Regression cases from the adversarial review of the first (buggy) implementation. ---

  it("a box wider than the branch → stays straight (graceful), never half-displaced", () => {
    // The first impl committed to dir = -sign(box centre) and ran out of 8 fixed steps, returning a bow
    // that left the branch STILL inside the box (displaced-AND-crossing — the worst outcome). For a box
    // far wider than the branch is long no bow ≤ maxBow clears it gracefully, so the rework falls back to
    // 0 — straight (still crossing this 200px box) but never half-displaced.
    const parent = box(308.4, 280, 103, 34);
    const child = box(151.9, 393.3, 99, 38);
    const obstacle = box(242.8, 305.2, 200, 36);
    expect(maxPenetration(parent, child, "left", obstacle, 0)).toBeGreaterThan(0); // straight crosses it
    expect(bowToClear(parent, child, "left", withId([obstacle]), "src", "tgt")).toBe(0); // graceful straight
  });

  it("victim outside the straight chord bbox is not routed through (inflated pre-filter)", () => {
    // The first impl pre-filtered obstacles by the STRAIGHT chord bbox, so a box the BOW swept into was
    // never probed. Here a trigger grazes from above and a victim sits below the chord.
    const parent = box(400, 200, 90, 28);
    const child = box(120, 200, 120, 26);
    const trigger = box(230, 184, 60, 28);
    const victim = box(300, 250, 120, 60);
    // Contract: whatever bow it returns, it must not leave the branch crossing EITHER box.
    bowAndAssertClearOrStraight(parent, child, "left", [trigger, victim]);
  });

  it("opposite-side corridor: cleared or straight, never displaced into a wall", () => {
    // Two boxes straddle the chord. Whatever bow it picks, the branch must not end up crossing EITHER
    // box — the first impl, locked to one direction, drove the curve into the far wall.
    const parent = box(500, 200, 90, 28);
    const child = box(80, 195, 120, 26);
    const top = box(290, 176, 120, 30);
    const bot = box(290, 220, 120, 30);
    bowAndAssertClearOrStraight(parent, child, "left", [top, bot]);
  });

  it("sampler aliasing: a short box between samples is not stepped over (dense sampler)", () => {
    // The 22-point sampler stepped over this 30px-tall box and accepted bow=-248 that still crossed it
    // by ~6px. The dense oracle below catches that; the contract must hold with the densified sampler.
    const parent = box(472, 514, 43, 46);
    const child = box(666, 198, 96, 42);
    const obstacles = [
      box(496.1, 473.1, 88, 30),
      box(561.6, 284.3, 35, 78),
      box(362.7, 574.6, 39, 78),
    ];
    bowAndAssertClearOrStraight(parent, child, "top", obstacles);
  });

  it("a box covering a branch endpoint can't be cleared → stays straight (no wild bow)", () => {
    // The cubic always passes through the fixed endpoints, so a box over the child entry can never be
    // cleared by any bow. Must fall back to 0, not fling a huge useless displacement.
    const parent = box(400, 200, 90, 28);
    const child = box(120, 70, 120, 26);
    const onEntry = box(173, 74, 80, 40); // sits on the child's entry anchor
    expect(bowToClear(parent, child, "left", withId([onEntry]), "src", "tgt")).toBe(0);
  });

  it("fuzz: clear-or-straight holds over thousands of random layouts (no displaced-crossing)", () => {
    const rand = rng(0x1a2b3c4d);
    const sides: AttachSide[] = ["left", "right", "top", "bottom"];
    let bowed = 0;
    const offenders: string[] = [];
    for (let n = 0; n < 4000; n++) {
      const parent = box(
        100 + rand() * 600,
        100 + rand() * 600,
        40 + rand() * 80,
        28 + rand() * 30,
      );
      const child = box(100 + rand() * 600, 100 + rand() * 600, 40 + rand() * 90, 28 + rand() * 30);
      const side = sides[Math.floor(rand() * 4)];
      const obstacles: Box[] = [];
      const k = Math.floor(rand() * 4);
      for (let j = 0; j < k; j++)
        obstacles.push(
          box(100 + rand() * 600, 100 + rand() * 600, 35 + rand() * 110, 28 + rand() * 60),
        );
      const others = withId(obstacles);
      const bow = bowToClear(parent, child, side, others, "src", "tgt");
      if (bow === 0) continue;
      bowed++;
      for (const o of others) {
        // > 0.01 (not 0) absorbs floating-point boundary noise; a real displaced-crossing is several px.
        if (maxPenetration(parent, child, side, o.box, bow) > 0.01)
          offenders.push(`n=${n} side=${side} bow=${bow.toFixed(1)} still crosses ${o.id}`);
      }
    }
    expect(offenders.slice(0, 8)).toEqual([]); // a returned bow NEVER leaves a branch crossing a box
    expect(bowed).toBeGreaterThan(100); // and the fuzz genuinely exercises the bow path
  });

  it("the screenshot tree: every branch is clear-or-straight against all non-endpoint boxes", () => {
    let seq = 0;
    const node = (topic: string, children: MapNode[] = []): MapNode => ({
      id: `${topic.replace(/\W+/g, "_")}_${seq++}`,
      topic,
      children,
    });
    const doc: MindMapDoc = {
      schemaVersion: 1,
      id: "doc",
      title: "Areas of Focus",
      root: node("Areas of Focus", [
        node("ERHVERV", [
          node("BESTSELLER A/S", [
            node("Retail Circle", [
              node("Retail Expansion", [node("RE-a"), node("RE-b")]),
              node("Retail Operations", [node("RO-a"), node("RO-b")]),
              node("Improving capabilities", [node("IC-a"), node("IC-b")]),
              node("Selling tickets"),
              node("Employee satisfaction"),
              node("Budget adherence"),
            ]),
            node("Enablement", [
              node("License Management", [node("LM-a"), node("LM-b")]),
              node("Internal Communication", [node("ICm-a"), node("ICm-b")]),
              node("Financial Management"),
              node("IT Security"),
            ]),
          ]),
          node("Censor på uni", [node("Eksamen"), node("Vejledning")]),
          node("EAAA"),
        ]),
      ]),
    };

    const kind = "left" as const;
    const { nodes, edges } = project(doc, undefined, false, kind);
    const size = estimateSizeOf(nodes);
    const pos = computeLayout(nodes, edges, size, kind);
    const boxOf = (id: string): Box | null => {
      const p = pos.get(id);
      if (!p) return null;
      const s = size(id);
      return { cx: p.x + s.width / 2, cy: p.y + s.height / 2, w: s.width, h: s.height };
    };
    const allBoxes = nodes
      .map((n) => ({ id: n.id, box: boxOf(n.id) }))
      .filter((b): b is { id: string; box: Box } => b.box !== null);
    const axis = computeAxisByParent(edges, boxOf, axisForLayoutKind(kind));

    let bowed = 0;
    const offenders: string[] = [];
    for (const e of edges) {
      if (e.data?.crosslink) continue;
      const pb = boxOf(e.source);
      const cb = boxOf(e.target);
      if (!pb || !cb) continue;
      const side = attachSideFor(pb, cb, axis.get(e.source) ?? "h");
      const bow = bowToClear(pb, cb, side, allBoxes, e.source, e.target);
      if (bow !== 0) {
        bowed++;
        for (const b of allBoxes) {
          if (b.id === e.source || b.id === e.target) continue;
          if (maxPenetration(pb, cb, side, b.box, bow) > 0) {
            offenders.push(`${e.source} → ${e.target} (bow ${bow}) still hits ${b.id}`);
          }
        }
      }
    }
    // No branch is displaced-and-still-crossing anywhere in the tree. Post the orientation-axis fix
    // (Fix A) the tree has no grazes — including the ERHVERV→EAAA-behind-"Censor på uni" crossing that
    // the old axis produced — so bowed is 0: the obstacle-router is a dormant safety net here, not a
    // constant transform. (If a future denser layout DOES graze, the offenders assertion guards it.)
    expect(offenders).toEqual([]);
    expect(bowed).toBe(0);
  });
});
