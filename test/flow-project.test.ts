import { describe, expect, it } from "vitest";
import { project } from "../src/mindmap/flow/project";
import type { MindMapDoc } from "../src/model/types";

const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "Root",
  root: {
    id: "r",
    topic: "Root",
    children: [
      { id: "a", topic: "A", children: [{ id: "a1", topic: "A1", children: [] }] },
      { id: "b", topic: "B", collapsed: true, children: [{ id: "b1", topic: "B1", children: [] }] },
      { id: "c", topic: "C", side: "left", children: [] },
    ],
  },
  links: [{ id: "l1", from: "a", to: "c", label: "rel" }],
  floatingTopics: [
    { id: "f", topic: "Float", children: [{ id: "f1", topic: "F1", children: [] }] },
  ],
};

describe("flow project (model → React Flow)", () => {
  const { nodes, edges } = project(doc);
  const node = (id: string) => nodes.find((n) => n.id === id);

  it("emits the root flagged isRoot", () => {
    expect(node("r")?.data.isRoot).toBe(true);
  });

  it("omits descendants of a collapsed node but keeps the node (hasChildren)", () => {
    expect(node("b")).toBeDefined();
    expect(node("b")?.data.collapsed).toBe(true);
    expect(node("b")?.data.hasChildren).toBe(true);
    expect(node("b1")).toBeUndefined();
    // …but it carries the first hidden child titles for the collapsed-branch hover-peek.
    expect(node("b")?.data.childTitles).toEqual(["B1"]);
    expect(node("a")?.data.childTitles).toBeUndefined(); // not collapsed → no peek titles
  });

  it("projects one node per visible MapNode", () => {
    // r, a, a1, b (collapsed → b1 omitted), c, f, f1
    expect(nodes.map((n) => n.id).sort()).toEqual(["a", "a1", "b", "c", "f", "f1", "r"]);
  });

  it("emits a floating branch edge per parent→child", () => {
    const ra = edges.find((e) => e.id === "e:r:a");
    expect(ra?.type).toBe("branch");
    const rc = edges.find((e) => e.id === "e:r:c");
    expect(rc?.type).toBe("branch");
    expect(rc?.data?.crosslink).toBe(false);
  });

  it("renders a cross-link as a labelled crosslink edge", () => {
    const link = edges.find((e) => e.id === "l1");
    expect(link?.type).toBe("crosslink");
    expect(link?.label).toBe("rel");
    expect(link?.data?.crosslink).toBe(true);
  });

  it("carries a cross-link's per-link style (arrow/colour/width/dash/curve) into the edge data", () => {
    const styled = project({
      ...doc,
      links: [
        {
          id: "s",
          from: "a",
          to: "c",
          arrow: "both",
          color: "#ff0000",
          width: 3,
          dash: "dotted",
          curve: 40,
        },
      ],
    });
    const edge = styled.edges.find((e) => e.id === "s");
    expect(edge?.data).toMatchObject({
      arrow: "both",
      color: "#ff0000",
      width: 3,
      dash: "dotted",
      curve: 40,
    });
  });

  it("flags floating topics and gives each branch a palette colour", () => {
    expect(node("f")?.data.floating).toBe(true);
    expect(node("f1")?.data.floating).toBe(true);
    expect(node("a")?.data.floating).toBe(false);
    // sibling branches get distinct palette colours
    expect(node("a")?.data.branchColor).not.toBe(node("b")?.data.branchColor);
  });

  it("gives each floating root a palette colour (not a washed-out grey)", () => {
    expect(node("f")?.data.branchColor).not.toBe("#73726c"); // the old forced grey
    // it's one of the cycled palette colours, and its subtree inherits it
    expect(node("f")?.data.branchColor).toBe(node("f1")?.data.branchColor);
  });

  it("honours an explicit side and assigns the rest", () => {
    expect(node("c")?.data.side).toBe("left");
    expect(["left", "right"]).toContain(node("a")?.data.side);
  });

  it("omits outline numbers by default", () => {
    expect(node("a")?.data.number).toBeUndefined();
    expect(node("r")?.data.number).toBeUndefined();
  });

  it("attaches hierarchical outline numbers when numbered (root + floating excluded)", () => {
    const numbered = project(doc, undefined, true).nodes;
    const n = (id: string) => numbered.find((x) => x.id === id);
    expect(n("r")?.data.number).toBeUndefined(); // root isn't numbered
    expect(n("a")?.data.number).toBe("1");
    expect(n("a1")?.data.number).toBe("1.1");
    expect(n("c")?.data.number).toBe("3"); // third child, even with a collapsed sibling between
    expect(n("f")?.data.number).toBeUndefined(); // floating topics aren't in the outline
  });
});

describe("flow project — org-chart elbow stamping + task fields", () => {
  it("stamps elbow on branch edges for org layouts, not for side", () => {
    const org = project(doc, undefined, false, "org-down");
    expect(org.edges.find((e) => e.id === "e:r:a")?.data?.elbow).toBe(true);
    expect(org.edges.find((e) => e.id === "e:a:a1")?.data?.elbow).toBe(true);
    const side = project(doc, undefined, false, "side");
    expect(side.edges.find((e) => e.id === "e:r:a")?.data?.elbow).toBe(false);
  });

  it("keeps floating subtrees organic (no elbow) even in an org-chart map", () => {
    const org = project(doc, undefined, false, "org-down");
    expect(org.edges.find((e) => e.id === "e:f:f1")?.data?.elbow).toBe(false);
  });

  it("lets a per-branch layout override govern only its own subtree's connectors", () => {
    const odoc: MindMapDoc = {
      schemaVersion: 1,
      id: "o",
      title: "O",
      root: {
        id: "r",
        topic: "R",
        children: [
          {
            id: "a",
            topic: "A",
            layout: "org-down",
            children: [{ id: "a1", topic: "A1", children: [] }],
          },
          { id: "b", topic: "B", children: [{ id: "b1", topic: "B1", children: [] }] },
        ],
      },
    };
    const { edges } = project(odoc, undefined, false, "side");
    expect(edges.find((e) => e.id === "e:r:a")?.data?.elbow).toBe(false); // map is side
    expect(edges.find((e) => e.id === "e:a:a1")?.data?.elbow).toBe(true); // a's override → org
    expect(edges.find((e) => e.id === "e:b:b1")?.data?.elbow).toBe(false);
  });

  it("stamps the map connector style + per-branch colour (inherited) + dash on branch edges", () => {
    const cdoc: MindMapDoc = {
      schemaVersion: 1,
      id: "c",
      title: "C",
      meta: { connectorStyle: "elbow" },
      root: {
        id: "r",
        topic: "R",
        children: [
          {
            id: "a",
            topic: "A",
            branchColor: "#ff0000",
            lineDash: "dashed",
            children: [{ id: "a1", topic: "A1", children: [] }],
          },
        ],
      },
    };
    const { nodes, edges } = project(cdoc);
    const ra = edges.find((e) => e.id === "e:r:a");
    expect(ra?.data?.connectorStyle).toBe("elbow");
    expect(ra?.data?.dash).toBe("dashed");
    expect(ra?.data?.branchColor).toBe("#ff0000");
    // the override is inherited by the subtree (node data + the child's edge)
    expect(nodes.find((n) => n.id === "a1")?.data.branchColor).toBe("#ff0000");
    expect(edges.find((e) => e.id === "e:a:a1")?.data?.branchColor).toBe("#ff0000");
  });

  it("applies SmartRules actions (marker + branch colour) into the projected node data (#13)", () => {
    const rdoc: MindMapDoc = {
      schemaVersion: 1,
      id: "rr",
      title: "RR",
      // overdue rule auto-flags 🚩 and recolours the branch; manual branchColor must still win.
      rules: [
        {
          id: "rule1",
          kind: "tag",
          value: "risk",
          style: {},
          icons: ["🚩"],
          branchColor: "#e23b3b",
        },
      ],
      root: {
        id: "r",
        topic: "R",
        children: [
          { id: "auto", topic: "Auto", tags: ["risk"], icons: ["⭐"], children: [] },
          {
            id: "manual",
            topic: "Manual",
            tags: ["risk"],
            branchColor: "#0000ff",
            children: [],
          },
          { id: "plain", topic: "Plain", children: [] },
        ],
      },
    };
    const { nodes } = project(rdoc);
    const at = (id: string) => nodes.find((n) => n.id === id);
    // matching node: rule marker unioned after the node's own; rule branch colour applied.
    expect(at("auto")?.data.icons).toEqual(["⭐", "🚩"]);
    expect(at("auto")?.data.branchColor).toBe("#e23b3b");
    // a manual branchColor outranks the rule's; the marker is still applied.
    expect(at("manual")?.data.icons).toEqual(["🚩"]);
    expect(at("manual")?.data.branchColor).toBe("#0000ff");
    // a non-matching node is untouched (keeps its auto-palette colour, no rule marker).
    expect(at("plain")?.data.icons).toBeUndefined();
    expect(at("plain")?.data.branchColor).not.toBe("#e23b3b");
  });

  it("stamps the map branch-growth weight on every branch edge (#B1)", () => {
    const gdoc: MindMapDoc = {
      schemaVersion: 1,
      id: "g",
      title: "G",
      meta: { branchGrowth: "bold" },
      root: { id: "r", topic: "R", children: [{ id: "a", topic: "A", children: [] }] },
    };
    expect(project(gdoc).edges.find((e) => e.id === "e:r:a")?.data?.branchGrowth).toBe("bold");
    // absent meta → undefined (the historical default), not stamped as a value
    const plain: MindMapDoc = {
      schemaVersion: 1,
      id: "p",
      title: "P",
      root: { id: "r", topic: "R", children: [{ id: "a", topic: "A", children: [] }] },
    };
    expect(project(plain).edges.find((e) => e.id === "e:r:a")?.data?.branchGrowth).toBeUndefined();
  });

  it("stamps the fan size (parent's child count) on each branch edge so dense fans de-blob", () => {
    const fdoc: MindMapDoc = {
      schemaVersion: 1,
      id: "f",
      title: "F",
      root: {
        id: "r",
        topic: "R",
        children: [
          { id: "a", topic: "A", children: [] },
          { id: "b", topic: "B", children: [] },
          { id: "c", topic: "C", children: [] },
        ],
      },
    };
    const { edges } = project(fdoc);
    // root has 3 children → every root→child edge carries fanCount 3.
    expect(edges.find((e) => e.id === "e:r:a")?.data?.fanCount).toBe(3);
    expect(edges.find((e) => e.id === "e:r:c")?.data?.fanCount).toBe(3);
  });

  it("projects the task schedule fields the inline task-info line draws", () => {
    const tdoc: MindMapDoc = {
      schemaVersion: 1,
      id: "t",
      title: "T",
      root: {
        id: "r",
        topic: "R",
        children: [
          {
            id: "m",
            topic: "M",
            task: { start: "2026-03-03", durationDays: 5, resources: ["Ann", "Bo"] },
            children: [],
          },
        ],
      },
    };
    const m = project(tdoc).nodes.find((n) => n.id === "m");
    expect(m?.data.start).toBe("2026-03-03");
    expect(m?.data.durationDays).toBe(5);
    expect(m?.data.resources).toEqual(["Ann", "Bo"]);
  });

  it("stamps map typography (scale factor + family) on every node; defaults to 1× / undefined", () => {
    const base: MindMapDoc = {
      schemaVersion: 1,
      id: "ty",
      title: "T",
      root: { id: "r", topic: "R", children: [{ id: "a", topic: "A", children: [] }] },
    };
    const plain = project(base).nodes.find((n) => n.id === "a");
    expect(plain?.data.fontScale).toBe(1); // comfortable / unset → 1×
    expect(plain?.data.fontFamily).toBeUndefined();
    const typed = project({
      ...base,
      meta: { fontScale: "large", fontFamily: "Georgia, serif" },
    }).nodes;
    expect(typed.find((n) => n.id === "a")?.data.fontScale).toBe(1.2); // large
    expect(typed.find((n) => n.id === "r")?.data.fontScale).toBe(1.2); // applies to every node
    expect(typed.find((n) => n.id === "a")?.data.fontFamily).toBe("Georgia, serif");
    expect(project({ ...base, meta: { fontScale: "compact" } }).nodes[0].data.fontScale).toBe(0.85);
  });

  it("carries a node's locked flag through to its TopicData + draggable:false", () => {
    const ldoc: MindMapDoc = {
      schemaVersion: 1,
      id: "lk",
      title: "L",
      root: {
        id: "r",
        topic: "R",
        children: [
          { id: "p", topic: "Pinned", locked: true, children: [] },
          { id: "u", topic: "Unpinned", children: [] },
        ],
      },
    };
    const { nodes } = project(ldoc);
    const pinned = nodes.find((n) => n.id === "p");
    const free = nodes.find((n) => n.id === "u");
    expect(pinned?.data.locked).toBe(true);
    expect(pinned?.draggable).toBe(false);
    expect(free?.data.locked).toBeUndefined();
    expect(free?.draggable).toBeUndefined(); // undefined → inherits the global nodesDraggable
  });
});

describe("flow project — collapse-toggle side (tipLeft)", () => {
  // `c` is pinned side:"left"; in the two-sided map its subtree grows left, so its toggle is left.
  it("flags left-growing nodes in the two-sided layout", () => {
    const left = project(doc).nodes.find((n) => n.id === "c");
    expect(left?.data.side).toBe("left");
    expect(left?.data.tipLeft).toBe(true);
  });

  it("never flags tipLeft in an all-right layout (side is just a balance artifact there)", () => {
    const nodes = project(doc, undefined, false, "right").nodes;
    expect(nodes.every((n) => !n.data.tipLeft)).toBe(true);
  });

  it("flags every tree node tipLeft in an all-left layout (floating subtrees still grow right)", () => {
    const all = project(doc, undefined, false, "left").nodes;
    const tree = all.filter((n) => !n.data.isRoot && !n.data.floating);
    expect(tree.length).toBeGreaterThan(0);
    expect(tree.every((n) => n.data.tipLeft)).toBe(true);
    expect(all.find((n) => n.id === "f")?.data.tipLeft).toBeFalsy(); // floating → right tip
  });
});

describe("flow project — roll-up source title (I11)", () => {
  const rollupDoc: MindMapDoc = {
    schemaVersion: 1,
    id: "d2",
    title: "Plan",
    root: {
      id: "r",
      topic: "Plan",
      children: [
        { id: "m", topic: "Mirror", rollup: "src", children: [] },
        { id: "n", topic: "Plain", children: [] },
      ],
    },
  };

  it("resolves the bound source map's title onto the node data", () => {
    const { nodes } = project(
      rollupDoc,
      undefined,
      false,
      "side",
      new Map([["src", "Quarterly OKRs"]]),
    );
    expect(nodes.find((n) => n.id === "m")?.data.rollupTitle).toBe("Quarterly OKRs");
    // A node with no roll-up binding carries no title.
    expect(nodes.find((n) => n.id === "n")?.data.rollupTitle).toBeUndefined();
  });

  it("leaves rollupTitle undefined when the source map isn't in the library", () => {
    const { nodes } = project(rollupDoc, undefined, false, "side", new Map());
    expect(nodes.find((n) => n.id === "m")?.data.rollup).toBe("src"); // still bound…
    expect(nodes.find((n) => n.id === "m")?.data.rollupTitle).toBeUndefined(); // …but no title resolved
  });
});
