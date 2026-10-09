import { describe, expect, it } from "vitest";
import {
  resolveSelectedEdge,
  resolveSelectedNode,
  resolveSelectedOverlay,
} from "../src/mindmap/flow/selectionResolve";
import { CROSSLINK_COLOR, CROSSLINK_WIDTH } from "../src/mindmap/flow/style";
import type { MindMapDoc } from "../src/model/types";

// The pure "resolve a selection to the inspector payload" logic lifted out of FlowMindMap's fire*
// callbacks — the default-filling was previously only exercised through the canvas.

const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "R",
  root: {
    id: "r",
    topic: "Root",
    note: "a note",
    children: [
      {
        id: "a",
        topic: "A",
        callouts: [{ id: "co", text: "hello", color: "#abc", dx: 0, dy: 0 }],
        children: [],
      },
    ],
  },
  links: [
    {
      id: "l1",
      from: "r",
      to: "a",
      label: "rel",
      arrow: "both",
      color: "#f00",
      width: 3,
      dash: "dotted",
      curve: 5,
    },
    { id: "l2", from: "a", to: "r" }, // bare → defaults filled
  ],
  boundaries: [
    { id: "bd", nodeIds: ["a"], label: "grp", color: "#0f0", shape: "cloud", dash: "dashed" },
  ],
  summaries: [{ id: "sm", nodeIds: ["a"], label: "sum", color: "#00f" }],
};

describe("resolveSelectedNode", () => {
  it("returns the node with note defaulted, or null", () => {
    expect(resolveSelectedNode(doc, "r")).toEqual({ id: "r", topic: "Root", note: "a note" });
    expect(resolveSelectedNode(doc, "a")).toEqual({ id: "a", topic: "A", note: "" }); // no note → ""
    expect(resolveSelectedNode(doc, null)).toBeNull();
    expect(resolveSelectedNode(doc, "ghost")).toBeNull();
  });
});

describe("resolveSelectedEdge", () => {
  it("fills the inspector defaults for a bare link", () => {
    expect(resolveSelectedEdge(doc, "l2")).toEqual({
      id: "l2",
      label: "",
      arrow: "to",
      color: CROSSLINK_COLOR,
      width: CROSSLINK_WIDTH,
      dash: "dashed",
      curve: undefined,
      type: "relates-to",
      showTypes: false,
    });
  });
  it("preserves explicit values", () => {
    expect(resolveSelectedEdge(doc, "l1")).toEqual({
      id: "l1",
      label: "rel",
      arrow: "both",
      color: "#f00",
      width: 3,
      dash: "dotted",
      curve: 5,
      type: "relates-to",
      showTypes: false,
    });
  });
  it("returns null for a null or missing id", () => {
    expect(resolveSelectedEdge(doc, null)).toBeNull();
    expect(resolveSelectedEdge(doc, "ghost")).toBeNull();
  });
});

describe("resolveSelectedOverlay", () => {
  it("resolves a boundary with its shape + dash", () => {
    expect(resolveSelectedOverlay(doc, { kind: "boundary", id: "bd" })).toEqual({
      kind: "boundary",
      id: "bd",
      nodeId: undefined,
      label: "grp",
      deletable: true,
      color: "#0f0",
      shape: "cloud",
      dash: "dashed",
    });
  });
  it("resolves a summary (no shape/dash) and a callout via its owning node", () => {
    expect(resolveSelectedOverlay(doc, { kind: "summary", id: "sm" })).toMatchObject({
      kind: "summary",
      id: "sm",
      label: "sum",
      color: "#00f",
      deletable: true,
    });
    expect(resolveSelectedOverlay(doc, { kind: "callout", id: "co", nodeId: "a" })).toMatchObject({
      kind: "callout",
      id: "co",
      nodeId: "a",
      label: "hello",
      color: "#abc",
    });
  });
  it("returns null when the overlay (or its descriptor) is gone", () => {
    expect(resolveSelectedOverlay(doc, null)).toBeNull();
    expect(resolveSelectedOverlay(doc, { kind: "boundary", id: "ghost" })).toBeNull();
    expect(resolveSelectedOverlay(doc, { kind: "summary", id: "ghost" })).toBeNull();
    expect(resolveSelectedOverlay(doc, { kind: "callout", id: "ghost", nodeId: "a" })).toBeNull();
  });
  it("keeps an empty label when a boundary has none (bails only if the object is missing)", () => {
    const d: MindMapDoc = { ...doc, boundaries: [{ id: "bd2", nodeIds: ["a"] }] };
    expect(resolveSelectedOverlay(d, { kind: "boundary", id: "bd2" })).toMatchObject({ label: "" });
  });
});
