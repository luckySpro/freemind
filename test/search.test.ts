import { describe, expect, it } from "vitest";
import type { MapNode, MindMapDoc } from "../src/model/types";
import {
  findDocMatches,
  findMatches,
  fuzzyHit,
  replaceInTopic,
  searchLibrary,
} from "../src/search";

const root: MapNode = {
  id: "r",
  topic: "Plan",
  children: [
    {
      id: "a",
      topic: "Marketing",
      children: [{ id: "a1", topic: "market research", children: [] }],
    },
    { id: "b", topic: "Sales", note: "quota and pipeline notes", children: [] },
  ],
};

describe("findMatches", () => {
  it("matches topics case-insensitively in depth-first order", () => {
    expect(findMatches(root, "market")).toEqual(["a", "a1"]);
  });

  it("matches a node by its note when the topic doesn't match", () => {
    expect(findMatches(root, "pipeline")).toEqual(["b"]);
  });

  it("returns an empty list for a blank query", () => {
    expect(findMatches(root, "   ")).toEqual([]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(findMatches(root, "xyz")).toEqual([]);
  });

  it("matches a node by its tags, markers, hyperlink, callouts, attachments and resources", () => {
    const rich: MapNode = {
      id: "x",
      topic: "Topic",
      children: [
        { id: "tag", topic: "n1", tags: ["urgent"], children: [] },
        { id: "mark", topic: "n2", icons: ["flag-red"], children: [] },
        { id: "link", topic: "n3", hyperlink: "https://example.com/spec", children: [] },
        {
          id: "extra",
          topic: "n3b",
          hyperlink: "https://primary.test",
          hyperlinks: ["https://secondary.example.org/deep"],
          children: [],
        },
        {
          id: "call",
          topic: "n4",
          callouts: [{ id: "c", text: "remember the budget", dx: 0, dy: 0 }],
          children: [],
        },
        {
          id: "att",
          topic: "n5",
          attachments: [{ name: "contract.pdf", dataUrl: "data:,", size: 1 }],
          children: [],
        },
        { id: "res", topic: "n6", task: { resources: ["Alice"] }, children: [] },
      ],
    };
    expect(findMatches(rich, "urgent")).toEqual(["tag"]);
    expect(findMatches(rich, "flag-red")).toEqual(["mark"]);
    expect(findMatches(rich, "example.com")).toEqual(["link"]);
    expect(findMatches(rich, "secondary.example.org")).toEqual(["extra"]); // an additional hyperlink
    expect(findMatches(rich, "budget")).toEqual(["call"]);
    expect(findMatches(rich, "contract.pdf")).toEqual(["att"]);
    expect(findMatches(rich, "alice")).toEqual(["res"]);
  });
});

describe("findDocMatches", () => {
  it("searches the central tree and floating topics together", () => {
    const doc: MindMapDoc = {
      schemaVersion: 1,
      id: "d",
      title: "T",
      root,
      floatingTopics: [{ id: "f1", topic: "market legend", children: [] }],
    };
    expect(findDocMatches(doc, "market")).toEqual(["a", "a1", "f1"]);
  });

  it("works with no floating topics", () => {
    expect(findDocMatches({ schemaVersion: 1, id: "d", title: "T", root }, "pipeline")).toEqual([
      "b",
    ]);
  });
});

describe("searchLibrary", () => {
  const docs: MindMapDoc[] = [
    { schemaVersion: 1, id: "m1", title: "Q3 Plan", root },
    {
      schemaVersion: 1,
      id: "m2",
      title: "Roadmap",
      root: {
        id: "r2",
        topic: "Roadmap",
        children: [{ id: "x", topic: "Marketing push", children: [] }],
      },
      floatingTopics: [{ id: "f1", topic: "Legend: market codes", children: [] }],
    },
  ];

  it("returns hits across every map with map + node context", () => {
    const hits = searchLibrary(docs, "market");
    expect(hits.map((h) => [h.mapId, h.nodeId])).toEqual([
      ["m1", "a"],
      ["m1", "a1"],
      ["m2", "x"],
      ["m2", "f1"],
    ]);
    expect(hits[0].mapTitle).toBe("Q3 Plan");
    expect(hits[3].topic).toBe("Legend: market codes");
  });

  it("searches floating topics, not just the central tree", () => {
    const hits = searchLibrary(docs, "Legend");
    expect(hits).toEqual([
      { mapId: "m2", mapTitle: "Roadmap", nodeId: "f1", topic: "Legend: market codes", path: [] },
    ]);
  });

  it("matches notes too, case-insensitively", () => {
    expect(searchLibrary(docs, "PIPELINE").map((h) => h.nodeId)).toEqual(["b"]);
  });

  it("carries the ancestor breadcrumb path for each hit", () => {
    const byId = new Map(searchLibrary(docs, "market").map((h) => [h.nodeId, h.path]));
    expect(byId.get("a")).toEqual(["Plan"]); // Plan › Marketing
    expect(byId.get("a1")).toEqual(["Plan", "Marketing"]); // Plan › Marketing › market research
    expect(byId.get("f1")).toEqual([]); // a floating topic is its own root
  });

  it("includes a note snippet when the match is in the note (not the topic)", () => {
    const [hit] = searchLibrary(docs, "pipeline");
    expect(hit.nodeId).toBe("b");
    expect(hit.snippet).toContain("pipeline");
    // A topic match carries no snippet (the topic itself is the context).
    expect(searchLibrary(docs, "Sales")[0].snippet).toBeUndefined();
  });

  it("returns an empty list for a blank query", () => {
    expect(searchLibrary(docs, "  ")).toEqual([]);
  });
});

describe("replaceInTopic", () => {
  it("replaces every occurrence, case-insensitively", () => {
    expect(replaceInTopic("Marketing market", "market", "biz")).toBe("bizing biz");
  });

  it("returns the topic unchanged for a blank query", () => {
    expect(replaceInTopic("Plan", "   ", "x")).toBe("Plan");
  });

  it("treats the query as a literal (regex chars escaped)", () => {
    expect(replaceInTopic("a.b a.b", "a.b", "Z")).toBe("Z Z");
    expect(replaceInTopic("axb", "a.b", "Z")).toBe("axb");
  });
});

describe("fuzzyHit", () => {
  it("accepts an exact substring or a near-miss word, rejects unrelated", () => {
    expect(fuzzyHit("Marketing plan", "marketing")).toBe(true); // exact
    expect(fuzzyHit("Marketing plan", "markteing")).toBe(true); // transposition (dist 2)
    expect(fuzzyHit("Marketing plan", "finance")).toBe(false);
  });
});

describe("findDocMatches — fuzzy fallback", () => {
  const doc: MindMapDoc = { schemaVersion: 1, id: "d", title: "T", root };

  it("falls back to a typo-tolerant pass only when there's no exact hit", () => {
    expect(findDocMatches(doc, "markteing")).toEqual(["a"]); // typo of "Marketing", no exact hit
    expect(findDocMatches(doc, "market")).toEqual(["a", "a1"]); // exact hits short-circuit fuzzy
  });

  it("stays strict for very short queries (no fuzzy below 4 chars)", () => {
    expect(findDocMatches(doc, "mkt")).toEqual([]);
  });
});

describe("findDocMatches — scoped/operator search", () => {
  const doc: MindMapDoc = {
    schemaVersion: 1,
    id: "d",
    title: "T",
    root: {
      id: "r",
      topic: "Root",
      children: [
        { id: "a", topic: "Alpha", tags: ["urgent"], children: [] },
        { id: "b", topic: "Beta urgent", note: "draft only", children: [] },
        { id: "c", topic: "Gamma", icons: ["flag-red"], task: { priority: 1 }, children: [] },
        {
          id: "d1",
          topic: "Delta",
          task: { due: "2020-01-01" },
          children: [{ id: "d2", topic: "Deep", children: [] }],
        },
      ],
    },
  };
  const TODAY = "2020-06-01";

  it("filters by a tag operator (not just text)", () => {
    // "urgent" as plain text hits both the tag node and the topic; tag: narrows to the tagged one.
    expect(findDocMatches(doc, "urgent", TODAY)).toEqual(["a", "b"]);
    expect(findDocMatches(doc, "tag:urgent", TODAY)).toEqual(["a"]);
  });

  it("filters by marker and priority", () => {
    expect(findDocMatches(doc, "marker:flag-red", TODAY)).toEqual(["c"]);
    expect(findDocMatches(doc, "priority:1", TODAY)).toEqual(["c"]);
  });

  it("excludes terms and ANDs free text with operators", () => {
    expect(findDocMatches(doc, "urgent -draft", TODAY)).toEqual(["a"]);
  });

  it("filters by has: and due:", () => {
    expect(findDocMatches(doc, "has:task", TODAY)).toEqual(["c", "d1"]);
    expect(findDocMatches(doc, "due:overdue", TODAY)).toEqual(["d1"]);
    expect(findDocMatches(doc, "due:dated", TODAY)).toEqual(["d1"]);
  });

  it("filters by level/depth (root = 0)", () => {
    expect(findDocMatches(doc, "level:2", TODAY)).toEqual(["d2"]);
    expect(findDocMatches(doc, "level:>=2", TODAY)).toEqual(["d2"]);
  });
});
