import { beforeEach, describe, expect, it } from "vitest";
import type { MapNode } from "../src/model/types";
import { getBranch, getBranches, setBranch, setBranches } from "../src/store/branchClipboard";

// The node test env has no localStorage; install a minimal in-memory Storage so the clipboard's real
// read/write path (and its JSON shape-guard) is exercised, not just the unavailable-storage fallback.
function makeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k: string) => m.get(k) ?? null,
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => void m.delete(k),
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

beforeEach(() => {
  globalThis.localStorage = makeStorage();
});

const node: MapNode = {
  id: "a",
  topic: "A",
  children: [{ id: "b", topic: "B", children: [] }],
};

describe("branchClipboard", () => {
  it("round-trips a copied branch across get/set", () => {
    expect(getBranch()).toBeNull();
    setBranch(node);
    const got = getBranch();
    expect(got?.topic).toBe("A");
    expect(got?.children[0]?.topic).toBe("B");
  });

  it("returns null for malformed or non-node content", () => {
    localStorage.setItem("mindmap-branch-clipboard", "{ not json");
    expect(getBranch()).toBeNull();
    localStorage.setItem("mindmap-branch-clipboard", JSON.stringify({ nope: 1 }));
    expect(getBranch()).toBeNull();
  });

  it("set is best-effort (no throw) when storage is unavailable", () => {
    Reflect.deleteProperty(globalThis, "localStorage");
    expect(() => setBranch(node)).not.toThrow();
    expect(getBranch()).toBeNull();
  });

  it("round-trips MULTIPLE copied branches and filters out malformed entries", () => {
    const b: MapNode = { id: "x", topic: "X", children: [] };
    setBranches([node, b]);
    const got = getBranches();
    expect(got.map((n) => n.topic)).toEqual(["A", "X"]);
    expect(getBranch()?.topic).toBe("A"); // single getter returns the first
  });

  it("reads the legacy single-node payload as a one-element array (back-compat)", () => {
    // Old format stored a bare node object, not an array.
    localStorage.setItem("mindmap-branch-clipboard", JSON.stringify(node));
    expect(getBranches().map((n) => n.topic)).toEqual(["A"]);
    expect(getBranch()?.topic).toBe("A");
  });

  it("getBranches is empty (not throwing) on malformed content", () => {
    localStorage.setItem("mindmap-branch-clipboard", "{ not json");
    expect(getBranches()).toEqual([]);
  });
});
