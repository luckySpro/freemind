import { describe, expect, it } from "vitest";
import {
  MAP_LINK_PREFIX,
  NODE_LINK_PREFIX,
  buildMapLink,
  classifyLink,
} from "../src/mindmap/contract";

describe("classifyLink", () => {
  it("recognises an in-map topic jump (#node=)", () => {
    expect(classifyLink(`${NODE_LINK_PREFIX}abc123`)).toEqual({ kind: "node", id: "abc123" });
  });

  it("recognises an in-app map link (#map=)", () => {
    expect(classifyLink(`${MAP_LINK_PREFIX}map-7`)).toEqual({ kind: "map", id: "map-7" });
  });

  it("treats anything else as an external URL", () => {
    expect(classifyLink("https://example.test/x")).toEqual({
      kind: "external",
      url: "https://example.test/x",
    });
    expect(classifyLink("")).toEqual({ kind: "external", url: "" });
  });

  it("handles an empty target id gracefully", () => {
    expect(classifyLink(NODE_LINK_PREFIX)).toEqual({ kind: "node", id: "" });
  });

  it("recognises a cross-map topic link (#map=…&node=…)", () => {
    expect(classifyLink(`${MAP_LINK_PREFIX}m7&node=n3`)).toEqual({
      kind: "map",
      id: "m7",
      nodeId: "n3",
    });
    // A bare map link still classifies with no target node (backward-compatible).
    expect(classifyLink(`${MAP_LINK_PREFIX}m7`)).toEqual({ kind: "map", id: "m7" });
  });
});

describe("buildMapLink", () => {
  it("builds bare and node-targeted map links, round-tripping through classifyLink", () => {
    expect(buildMapLink("m7")).toBe(`${MAP_LINK_PREFIX}m7`);
    expect(buildMapLink("m7", "n3")).toBe(`${MAP_LINK_PREFIX}m7&node=n3`);
    expect(classifyLink(buildMapLink("m7", "n3"))).toEqual({ kind: "map", id: "m7", nodeId: "n3" });
  });
});
