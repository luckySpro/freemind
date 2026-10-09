import { describe, expect, it } from "vitest";
import type { MapNode, MindMapDoc } from "../src/model/types";
import {
  backlinksFor,
  crossMapBacklinksFor,
  dropWhereInBox,
  mapLinks,
  markerTagIndex,
  outgoingLinksFor,
  outlineDropWhere,
  outlineNumbers,
  outlineRows,
} from "../src/outline";

const root: MapNode = {
  id: "r",
  topic: "Root",
  children: [
    {
      id: "a",
      topic: "Alpha",
      note: "has a note",
      children: [{ id: "a1", topic: "Alpha One", children: [] }],
    },
    { id: "b", topic: "Beta", note: "   ", children: [] },
  ],
};

describe("outlineRows", () => {
  it("flattens depth-first with depth and note flags", () => {
    expect(outlineRows(root)).toEqual([
      { id: "r", topic: "Root", depth: 0, hasNote: false },
      { id: "a", topic: "Alpha", depth: 1, hasNote: true },
      { id: "a1", topic: "Alpha One", depth: 2, hasNote: false },
      { id: "b", topic: "Beta", depth: 1, hasNote: false }, // whitespace-only note ≠ note
    ]);
  });
});

const tagged: MapNode = {
  id: "r",
  topic: "Root",
  icons: ["🔴"],
  children: [
    {
      id: "a",
      topic: "Alpha",
      icons: ["⭐", "🔴"],
      tags: ["urgent"],
      children: [{ id: "a1", topic: "Alpha One", tags: ["urgent", "later"], children: [] }],
    },
    { id: "b", topic: "Beta", children: [] },
  ],
};

describe("markerTagIndex", () => {
  it("groups markers + tags by key, sorted, each with the carrying nodes (deep)", () => {
    const { markers, tags } = markerTagIndex(tagged);
    expect(markers).toEqual([
      { key: "⭐", hits: [{ id: "a", topic: "Alpha" }] },
      {
        key: "🔴",
        hits: [
          { id: "r", topic: "Root" },
          { id: "a", topic: "Alpha" },
        ],
      },
    ]);
    expect(tags).toEqual([
      {
        key: "later",
        hits: [{ id: "a1", topic: "Alpha One" }],
      },
      {
        key: "urgent",
        hits: [
          { id: "a", topic: "Alpha" },
          { id: "a1", topic: "Alpha One" },
        ],
      },
    ]);
  });

  it("includes floating topics and returns empty groups for a bare map", () => {
    const floating: MapNode[] = [{ id: "f", topic: "Legend", icons: ["📌"], children: [] }];
    const { markers } = markerTagIndex(tagged, floating);
    expect(markers.find((e) => e.key === "📌")).toEqual({
      key: "📌",
      hits: [{ id: "f", topic: "Legend" }],
    });
    expect(markerTagIndex({ id: "x", topic: "Bare", children: [] })).toEqual({
      markers: [],
      tags: [],
    });
  });
});

describe("outlineDropWhere", () => {
  it("maps the pointer's vertical position to before / child / after", () => {
    expect(outlineDropWhere(0)).toBe("before");
    expect(outlineDropWhere(0.1)).toBe("before");
    expect(outlineDropWhere(0.5)).toBe("child"); // the broad middle nests as a child
    expect(outlineDropWhere(0.9)).toBe("after");
    expect(outlineDropWhere(1)).toBe("after");
  });
});

describe("dropWhereInBox (canvas drag-reorder, #8)", () => {
  it("maps a drop point in a box to before / child / after", () => {
    // box top=100, height=40 → before <110, child 110..130, after >130.
    expect(dropWhereInBox(104, 100, 40, false)).toBe("before");
    expect(dropWhereInBox(120, 100, 40, false)).toBe("child");
    expect(dropWhereInBox(136, 100, 40, false)).toBe("after");
  });

  it("collapses before/after to child on the root (it has no parent to be a sibling of)", () => {
    expect(dropWhereInBox(104, 100, 40, true)).toBe("child");
    expect(dropWhereInBox(136, 100, 40, true)).toBe("child");
    expect(dropWhereInBox(120, 100, 40, true)).toBe("child");
  });

  it("treats a zero-height box as a child drop", () => {
    expect(dropWhereInBox(100, 100, 0, false)).toBe("child");
  });
});

describe("outlineNumbers", () => {
  it("numbers the tree hierarchically, leaving the root unnumbered", () => {
    const nums = outlineNumbers(tagged);
    expect(nums.has("r")).toBe(false); // the root (central topic) gets no number
    expect(nums.get("a")).toBe("1");
    expect(nums.get("a1")).toBe("1.1");
    expect(nums.get("b")).toBe("2");
  });

  it("returns an empty map for a childless root", () => {
    expect(outlineNumbers({ id: "x", topic: "Bare", children: [] }).size).toBe(0);
  });

  it("renders the legal-outline scheme (I, I.A, II) by level", () => {
    const nums = outlineNumbers(tagged, "outline");
    expect(nums.get("a")).toBe("I"); // depth 0 → upper Roman
    expect(nums.get("a1")).toBe("I.A"); // depth 1 → upper alpha
    expect(nums.get("b")).toBe("II");
  });

  it("cycles outline glyphs by depth (I, A, 1, a, i) and handles wide/deep counts", () => {
    // A 6-level-deep chain exercises the depth cycle and the wrap back to Roman at level 5.
    let node: MapNode = { id: "n6", topic: "L6", children: [] };
    for (let d = 5; d >= 1; d--) node = { id: `n${d}`, topic: `L${d}`, children: [node] };
    const root: MapNode = { id: "r", topic: "R", children: [node] };
    const nums = outlineNumbers(root, "outline");
    expect(nums.get("n1")).toBe("I");
    expect(nums.get("n2")).toBe("I.A");
    expect(nums.get("n3")).toBe("I.A.1");
    expect(nums.get("n4")).toBe("I.A.1.a");
    expect(nums.get("n5")).toBe("I.A.1.a.i");
    expect(nums.get("n6")).toBe("I.A.1.a.i.I"); // level 5 wraps back to upper Roman
  });
});

const linkDoc = (): MindMapDoc => ({
  schemaVersion: 1,
  id: "d",
  title: "Root",
  root: {
    id: "r",
    topic: "Root",
    children: [
      { id: "a", topic: "Alpha", hyperlink: "#node=b", children: [] }, // → b (hyperlink)
      { id: "b", topic: "Beta", hyperlink: "#node=b", children: [] }, // self-link → excluded
      { id: "c", topic: "Gamma", hyperlink: "#map=other", children: [] }, // map link → ignored
      { id: "e", topic: "Epsilon", hyperlink: "https://x.test", children: [] }, // external → ignored
    ],
  },
  floatingTopics: [{ id: "f", topic: "Float", hyperlink: "#node=b", children: [] }], // → b (hyperlink)
  links: [
    { id: "l1", from: "c", to: "b", label: "blocks" }, // relationship pointing AT b
    { id: "l2", from: "b", to: "a" }, // outgoing from b → NOT a backlink to b
  ],
});

describe("backlinksFor", () => {
  it("collects #node= hyperlinks + relationship edges that point AT the target (tree + floating)", () => {
    // Sorted by topic, then kind: Alpha (hyperlink) < Float (hyperlink) < Gamma (relationship).
    expect(backlinksFor(linkDoc(), "b")).toEqual([
      { id: "a", topic: "Alpha", kind: "hyperlink" },
      { id: "f", topic: "Float", kind: "hyperlink" },
      { id: "c", topic: "Gamma", kind: "relationship", label: "blocks" },
    ]);
  });

  it("ignores #map= / external hyperlinks, self-links, and outgoing edges; [] when nothing points in", () => {
    expect(backlinksFor(linkDoc(), "e")).toEqual([]); // nothing points at Epsilon
    // Only the b→a edge points at Alpha (no label); the #map= / external links never count.
    expect(backlinksFor(linkDoc(), "a")).toEqual([
      { id: "b", topic: "Beta", kind: "relationship" },
    ]);
  });
});

describe("crossMapBacklinksFor", () => {
  const docs = (): MindMapDoc[] => [
    {
      schemaVersion: 1,
      id: "target",
      title: "Target",
      root: { id: "tr", topic: "Target root", children: [] },
    },
    {
      schemaVersion: 1,
      id: "src1",
      title: "Roadmap",
      root: {
        id: "s1",
        topic: "Roadmap",
        children: [
          { id: "n1", topic: "See target", hyperlink: "#map=target", children: [] }, // whole-map
          { id: "n2", topic: "See topic", hyperlink: "#map=target&node=tx", children: [] }, // node
          { id: "n3", topic: "Other", hyperlink: "#map=elsewhere", children: [] }, // other map
        ],
      },
      floatingTopics: [{ id: "n4", topic: "Float ref", hyperlink: "#map=target", children: [] }],
    },
    {
      schemaVersion: 1,
      id: "src2",
      title: "Archive",
      root: {
        id: "s2",
        topic: "Archive",
        children: [{ id: "m1", topic: "Old ref", hyperlink: "#map=target", children: [] }],
      },
    },
  ];

  it("collects every other map's #map= reference to the target (whole-map + node-specific)", () => {
    const hits = crossMapBacklinksFor(docs(), "target");
    // Sorted by source map title (Archive < Roadmap), then topic.
    expect(hits.map((h) => [h.sourceMapTitle, h.topic, h.targetNodeId])).toEqual([
      ["Archive", "Old ref", undefined],
      ["Roadmap", "Float ref", undefined],
      ["Roadmap", "See target", undefined],
      ["Roadmap", "See topic", "tx"],
    ]);
  });

  it("skips the target map itself and returns [] when nothing links in", () => {
    expect(crossMapBacklinksFor(docs(), "elsewhere").map((h) => h.topic)).toEqual(["Other"]);
    expect(crossMapBacklinksFor([docs()[0]], "target")).toEqual([]); // only the target present
  });
});

describe("outgoingLinksFor", () => {
  it("collects the node's own #node= hyperlink target + relationship edges FROM it", () => {
    expect(outgoingLinksFor(linkDoc(), "a")).toEqual([
      { id: "b", topic: "Beta", kind: "hyperlink" }, // Alpha's #node=b
    ]);
    expect(outgoingLinksFor(linkDoc(), "c")).toEqual([
      { id: "b", topic: "Beta", kind: "relationship", label: "blocks" }, // c→b edge
    ]);
  });

  it("excludes self-links, #map= / external hyperlinks, and incoming edges", () => {
    // Beta's own hyperlink is a self-link (excluded); only the b→a relationship is outgoing.
    expect(outgoingLinksFor(linkDoc(), "b")).toEqual([
      { id: "a", topic: "Alpha", kind: "relationship" },
    ]);
    expect(outgoingLinksFor(linkDoc(), "e")).toEqual([]); // external hyperlink ignored
  });
});

describe("mapLinks", () => {
  it("flattens relationships + in-map #node= hyperlinks (both ends resolved), sorted by source", () => {
    expect(mapLinks(linkDoc())).toEqual([
      { fromId: "a", fromTopic: "Alpha", toId: "b", toTopic: "Beta", kind: "hyperlink" },
      { fromId: "b", fromTopic: "Beta", toId: "a", toTopic: "Alpha", kind: "relationship" },
      { fromId: "f", fromTopic: "Float", toId: "b", toTopic: "Beta", kind: "hyperlink" },
      {
        fromId: "c",
        fromTopic: "Gamma",
        toId: "b",
        toTopic: "Beta",
        kind: "relationship",
        label: "blocks",
      },
    ]);
  });

  it("skips self-links, #map= / external hyperlinks, and dangling edges", () => {
    const doc = { ...linkDoc(), links: [{ id: "d1", from: "a", to: "zzz" }] }; // target doesn't exist
    // Only the two #node=b hyperlinks survive (Alpha, Float); the dangling relationship is dropped.
    expect(mapLinks(doc).map((l) => `${l.fromId}->${l.toId}`)).toEqual(["a->b", "f->b"]);
  });
});

// A topic's `hyperlinks` extras participate in every link scan exactly like the primary `hyperlink`.
describe("multiple hyperlinks per topic", () => {
  // Alpha carries a primary #node=b PLUS extras: another #node=c and a #map=other&node=x.
  const multiDoc = (): MindMapDoc => ({
    schemaVersion: 1,
    id: "d",
    title: "Root",
    root: {
      id: "r",
      topic: "Root",
      children: [
        {
          id: "a",
          topic: "Alpha",
          hyperlink: "#node=b",
          hyperlinks: ["#node=c", "#map=other&node=x"],
          children: [],
        },
        { id: "b", topic: "Beta", children: [] },
        { id: "c", topic: "Gamma", children: [] },
      ],
    },
  });

  it("backlinksFor sees a target reached only via an extra link", () => {
    expect(backlinksFor(multiDoc(), "c")).toEqual([{ id: "a", topic: "Alpha", kind: "hyperlink" }]);
  });

  it("outgoingLinksFor lists every distinct #node= target (primary + extras)", () => {
    expect(outgoingLinksFor(multiDoc(), "a")).toEqual([
      { id: "b", topic: "Beta", kind: "hyperlink" },
      { id: "c", topic: "Gamma", kind: "hyperlink" },
    ]);
  });

  it("mapLinks flattens both the primary and the extra in-map jump", () => {
    expect(mapLinks(multiDoc()).map((l) => `${l.fromId}->${l.toId}`)).toEqual(["a->b", "a->c"]);
  });

  it("crossMapBacklinksFor picks up a #map= reference carried in an extra", () => {
    const hits = crossMapBacklinksFor(
      [multiDoc(), { ...multiDoc(), id: "other", title: "Other" }],
      "other",
    );
    expect(hits.map((h) => [h.topic, h.targetNodeId])).toEqual([["Alpha", "x"]]);
  });
});
