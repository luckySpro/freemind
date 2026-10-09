import { describe, expect, it } from "vitest";
import { project } from "../src/mindmap/flow/project";
import { fromFlow } from "../src/mindmap/flow/sync";
import type { MapNode, MindMapDoc } from "../src/model/types";

// fromFlow is the inverse of project(): rebuild the canonical doc from React Flow nodes +
// edges. The headline guarantee is the round trip — `fromFlow(project(doc)) ≈ doc` — with
// canonical-only fields (task, side) preserved by id and a collapsed node's omitted children
// restored from the previous doc.

const n = (
  id: string,
  topic: string,
  extra: Partial<MapNode> = {},
  children: MapNode[] = [],
): MapNode => ({ id, topic, children, ...extra });

const PALETTE = ["#111", "#222", "#333"];
const roundTrip = (d: MindMapDoc): MindMapDoc => {
  const { nodes, edges } = project(d, PALETTE);
  return fromFlow(nodes, edges, d);
};

// A doc exercising every canonical feature: notes, icons, tags, hyperlink, explicit side, a
// styled node, a node image, a task (canonical-only), a collapsed node hiding a child,
// labelled + unlabelled cross-links, a boundary, and a nested floating topic.
const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "Root",
  root: n("r", "Root", {}, [
    n(
      "a",
      "Alpha",
      { note: "a note", icons: ["star"], hyperlink: "https://x.test/", side: "right" },
      [n("a1", "Alpha One", { collapsed: true }, [n("a1x", "Hidden", {}, [])])],
    ),
    n("b", "Beta", {
      tags: ["t1"],
      style: { background: "#eef" },
      side: "left",
      task: { priority: 1 },
    }),
    n("c", "Gamma", {
      image: { url: "data:abc", width: 100, height: 50 },
      rollup: "src-map",
      attachments: [{ name: "spec.pdf", dataUrl: "data:application/pdf;base64,AA==", size: 3 }],
    }),
  ]),
  links: [
    { id: "l1", from: "a", to: "b", label: "rel" },
    { id: "l2", from: "c", to: "a" },
  ],
  boundaries: [{ id: "bd1", nodeIds: ["a", "a1"], label: "Group" }],
  floatingTopics: [n("f1", "Legend", { note: "keep" }, [n("f1a", "Child", {}, [])])],
};

const simpleDoc: MindMapDoc = {
  schemaVersion: 1,
  id: "s",
  title: "Root",
  root: n("r", "Root", {}, [n("a", "Alpha", {}, [])]),
};

describe("flow fromFlow (React Flow → model)", () => {
  it("round-trips a full doc exactly (project → fromFlow ≈ identity)", () => {
    expect(roundTrip(doc)).toEqual(doc);
  });

  it("preserves canonical-only task data by id", () => {
    const back = roundTrip(doc);
    expect(back.root.children.find((c) => c.id === "b")?.task).toEqual({ priority: 1 });
  });

  it("carries per-node timestamps by id, and never invents them for a timestamp-free doc", () => {
    // A node with timestamps round-trips them...
    const stamped: MindMapDoc = {
      schemaVersion: 1,
      id: "ts",
      title: "Root",
      root: n("r", "Root", {}, [n("a", "Alpha", { createdAt: 111, modifiedAt: 222 }, [])]),
    };
    const a = roundTrip(stamped).root.children.find((c) => c.id === "a");
    expect(a?.createdAt).toBe(111);
    expect(a?.modifiedAt).toBe(222);
    // ...and a timestamp-free node stays timestamp-free (the exact-equality round-trip above relies
    // on fromFlow never stamping).
    const back = roundTrip(simpleDoc).root.children[0];
    expect(back.createdAt).toBeUndefined();
    expect(back.modifiedAt).toBeUndefined();
  });

  it("preserves an explicit node side, and omits it where there was none", () => {
    const back = roundTrip(doc);
    expect(back.root.children.find((c) => c.id === "a")?.side).toBe("right");
    expect(back.root.children.find((c) => c.id === "b")?.side).toBe("left");
    expect(back.root.children.find((c) => c.id === "c")?.side).toBeUndefined();
  });

  it("restores a collapsed node's omitted children from the previous doc", () => {
    const back = roundTrip(doc);
    const a1 = back.root.children.find((c) => c.id === "a")?.children.find((c) => c.id === "a1");
    expect(a1?.collapsed).toBe(true);
    expect(a1?.children.map((c) => c.id)).toEqual(["a1x"]);
  });

  it("round-trips cross-links, keeping a label and omitting an absent one", () => {
    const back = roundTrip(doc);
    expect(back.links).toEqual([
      { id: "l1", from: "a", to: "b", label: "rel" },
      { id: "l2", from: "c", to: "a" },
    ]);
  });

  it("round-trips a nested floating topic (with its note)", () => {
    const back = roundTrip(doc);
    expect(back.floatingTopics?.[0].topic).toBe("Legend");
    expect(back.floatingTopics?.[0].note).toBe("keep");
    expect(back.floatingTopics?.[0].children.map((c) => c.id)).toEqual(["f1a"]);
  });

  it("round-trips the boundary unchanged when all members survive", () => {
    expect(roundTrip(doc).boundaries).toEqual([
      { id: "bd1", nodeIds: ["a", "a1"], label: "Group" },
    ]);
  });

  it("prunes a boundary member that no longer exists (and drops an emptied boundary)", () => {
    const withGhost: MindMapDoc = {
      ...simpleDoc,
      boundaries: [
        { id: "keep", nodeIds: ["a", "ghost"], label: "G" },
        { id: "gone", nodeIds: ["ghost"] },
      ],
    };
    const back = roundTrip(withGhost);
    expect(back.boundaries).toEqual([{ id: "keep", nodeIds: ["a"], label: "G" }]);
  });

  it("preserves sibling order", () => {
    const back = roundTrip(doc);
    expect(back.root.children.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("tracks a renamed root as the new title", () => {
    const { nodes, edges } = project(simpleDoc, PALETTE);
    const root = nodes.find((nn) => nn.data.isRoot);
    if (root) root.data.topic = "Renamed";
    expect(fromFlow(nodes, edges, simpleDoc).title).toBe("Renamed");
  });

  it("strips a dangerous-scheme hyperlink on capture (XSS guard)", () => {
    const { nodes, edges } = project(simpleDoc, PALETTE);
    const a = nodes.find((nn) => nn.id === "a");
    if (a) a.data.hyperlink = "javascript:alert(1)";
    const back = fromFlow(nodes, edges, simpleDoc);
    expect(back.root.children.find((c) => c.id === "a")?.hyperlink).toBeUndefined();
  });

  it("a brand-new node (unknown id) carries no stale task or side", () => {
    const { nodes, edges } = project(simpleDoc, PALETTE);
    nodes.push({
      id: "fresh",
      type: "topic",
      position: { x: 0, y: 0 },
      data: {
        topic: "Fresh",
        isRoot: false,
        depth: 1,
        branchColor: "#000",
        side: "right",
        collapsed: false,
        hasChildren: false,
        floating: false,
      },
    });
    edges.push({
      id: "e:r:fresh",
      source: "r",
      target: "fresh",
      type: "branch",
      data: { depth: 1, branchColor: "#000", crosslink: false },
    });
    const fresh = fromFlow(nodes, edges, simpleDoc).root.children.find((c) => c.id === "fresh");
    expect(fresh?.topic).toBe("Fresh");
    expect(fresh?.task).toBeUndefined();
    expect(fresh?.side).toBeUndefined();
  });

  it("carries node rollup + attachments by id (model-only fields survive the round-trip)", () => {
    const c = roundTrip(doc).root.children.find((ch) => ch.id === "c");
    expect(c?.rollup).toBe("src-map");
    expect(c?.attachments).toEqual([
      { name: "spec.pdf", dataUrl: "data:application/pdf;base64,AA==", size: 3 },
    ]);
  });

  it("preserves callouts by id", () => {
    const d: MindMapDoc = {
      schemaVersion: 1,
      id: "co",
      title: "Root",
      root: n("r", "Root", {}, [
        n("a", "A", { callouts: [{ id: "c1", text: "Hi", dx: 40, dy: -20 }] }),
      ]),
    };
    expect(roundTrip(d).root.children[0].callouts).toEqual([
      { id: "c1", text: "Hi", dx: 40, dy: -20 },
    ]);
  });

  it("round-trips a rich-text topic (topicRich)", () => {
    const d: MindMapDoc = {
      schemaVersion: 1,
      id: "rt",
      title: "Root",
      root: n("r", "Root", {}, [n("a", "Bold A", { topicRich: "<b>Bold</b> A" })]),
    };
    expect(roundTrip(d).root.children[0].topicRich).toBe("<b>Bold</b> A");
  });

  it("preserves free-canvas positions (pos) by id + the freeform flag", () => {
    const d: MindMapDoc = {
      schemaVersion: 1,
      id: "fc",
      title: "Root",
      meta: { freeform: true },
      root: n("r", "Root", { pos: { x: 5, y: 6 } }, [n("a", "A", { pos: { x: 30, y: 40 } })]),
    };
    const back = roundTrip(d);
    expect(back.meta?.freeform).toBe(true);
    expect(back.root.pos).toEqual({ x: 5, y: 6 });
    expect(back.root.children[0].pos).toEqual({ x: 30, y: 40 });
  });

  it("leaves links / boundaries / floatingTopics undefined when there are none", () => {
    const back = roundTrip(simpleDoc);
    expect(back.links).toBeUndefined();
    expect(back.boundaries).toBeUndefined();
    expect(back.floatingTopics).toBeUndefined();
  });
});
