import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { MindMapDoc, SavedView } from "../src/model/types";
import { useSavedViews } from "../src/savedViews";

// Hook-side of saved views (the pure ops live in savedViews.test.ts). Views now persist on the DOC
// (meta.savedViews) rather than in localStorage, so they travel with a .json/.mmst export and across
// machines. These drive the doc-backed reads/writes, the blank-name guard, and the one-time migration
// off the old per-map `mindmap-views:<id>` key.

const VP = { x: 1, y: 2, zoom: 1 } as const;
const body = { viewport: VP, drillId: null, criteria: null };
const legacyKey = (id: string) => `mindmap-views:${id}`;

const docOf = (id: string, views?: SavedView[]): MindMapDoc => ({
  schemaVersion: 1,
  id,
  title: "T",
  root: { id: "r", topic: "R", children: [] },
  ...(views ? { meta: { savedViews: views } } : {}),
});

/** Render the hook over a mutable doc, the way App does: writes go through `apply`, which swaps the
 *  doc and re-renders. */
function renderOverDoc(initial: MindMapDoc) {
  let doc = initial;
  const rendered = renderHook(() =>
    useSavedViews(doc, (views) => {
      doc = { ...doc, meta: { ...doc.meta, savedViews: views } };
    }),
  );
  return {
    ...rendered,
    get doc() {
      return doc;
    },
  };
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("useSavedViews (hook)", () => {
  it("reads the list off the doc", () => {
    const seeded: SavedView = { id: "v0", name: "Seeded", ...body };
    const { result } = renderOverDoc(docOf("m1", [seeded]));
    expect(result.current.list.map((v) => v.name)).toEqual(["Seeded"]);
  });

  it("is empty for a doc with no saved views", () => {
    const { result } = renderOverDoc(docOf("m1"));
    expect(result.current.list).toEqual([]);
  });

  it("add() writes through to the doc (and ignores a blank name)", () => {
    const h = renderOverDoc(docOf("m1"));
    act(() => h.result.current.add("   ", body)); // blank → no-op
    expect(h.doc.meta?.savedViews).toBeUndefined();
    act(() => h.result.current.add("  Overview  ", body)); // trimmed
    const stored = h.doc.meta?.savedViews ?? [];
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ name: "Overview", viewport: VP });
    expect(typeof stored[0].id).toBe("string");
    // and nothing leaks back into localStorage
    expect(localStorage.getItem(legacyKey("m1"))).toBeNull();
  });

  it("add() overwrites a same-named view; remove() drops by id", () => {
    const a: SavedView = { id: "a1", name: "A", ...body };
    const h = renderOverDoc(docOf("m1", [a]));
    act(() => h.result.current.add("A", { ...body, drillId: "n9" }));
    expect(h.doc.meta?.savedViews).toHaveLength(1);
    expect(h.doc.meta?.savedViews?.[0].drillId).toBe("n9");
    // The hook reads its list from the doc, so it has to see the new doc before the next command —
    // App re-renders on the doc change; here that's an explicit rerender.
    h.rerender();
    act(() => h.result.current.remove(h.doc.meta?.savedViews?.[0].id as string));
    expect(h.doc.meta?.savedViews).toHaveLength(0);
  });
});

describe("useSavedViews migration off localStorage", () => {
  it("folds legacy views into the doc once and clears the old key", () => {
    localStorage.setItem(legacyKey("m1"), JSON.stringify([{ id: "v0", name: "Old", ...body }]));
    const h = renderOverDoc(docOf("m1"));
    expect(h.doc.meta?.savedViews?.map((v) => v.name)).toEqual(["Old"]);
    expect(localStorage.getItem(legacyKey("m1"))).toBeNull();
  });

  it("keeps the doc's own view when a legacy view shares its name", () => {
    const mine: SavedView = { id: "keep", name: "Overview", ...body, drillId: "mine" };
    localStorage.setItem(
      legacyKey("m1"),
      JSON.stringify([{ id: "old", name: "Overview", ...body, drillId: "legacy" }]),
    );
    const h = renderOverDoc(docOf("m1", [mine]));
    expect(h.doc.meta?.savedViews).toHaveLength(1);
    expect(h.doc.meta?.savedViews?.[0].drillId).toBe("mine");
  });

  it("does nothing when there is no legacy key", () => {
    const h = renderOverDoc(docOf("m1"));
    expect(h.doc.meta?.savedViews).toBeUndefined();
  });

  it("survives corrupt or non-array legacy storage", () => {
    localStorage.setItem(legacyKey("bad"), "{not json");
    const a = renderOverDoc(docOf("bad"));
    expect(a.result.current.list).toEqual([]);
    localStorage.setItem(legacyKey("obj"), JSON.stringify({ not: "an array" }));
    const b = renderOverDoc(docOf("obj"));
    expect(b.result.current.list).toEqual([]);
  });
});
