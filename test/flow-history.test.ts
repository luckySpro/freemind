import { describe, expect, it } from "vitest";
import { createHistory, record, redo, undo } from "../src/mindmap/flow/history";

describe("flow history (undo/redo snapshots)", () => {
  it("undo returns null on an empty stack", () => {
    expect(undo(createHistory<string>(), "a")).toBeNull();
    expect(redo(createHistory<string>(), "a")).toBeNull();
  });

  it("records edits and undoes/redoes in order", () => {
    let h = createHistory<string>();
    h = record(h, "v0"); // before editing to v1
    h = record(h, "v1"); // before editing to v2 (current = v2)
    const u1 = undo(h, "v2");
    expect(u1?.value).toBe("v1");
    const u2 = undo(u1?.history ?? h, "v1");
    expect(u2?.value).toBe("v0");
    expect(undo(u2?.history ?? h, "v0")).toBeNull();
    // redo back up
    const r1 = redo(u2?.history ?? h, "v0");
    expect(r1?.value).toBe("v1");
    const r2 = redo(r1?.history ?? h, "v1");
    expect(r2?.value).toBe("v2");
  });

  it("recording a new edit clears the redo branch", () => {
    let h = createHistory<string>();
    h = record(h, "v0");
    const u = undo(h, "v1");
    if (!u) throw new Error("expected undo");
    // now at v0 with v1 in future; a new edit (v0 -> v2) clears future
    const h2 = record(u.history, "v0");
    expect(h2.future).toEqual([]);
    expect(redo(h2, "v2")).toBeNull();
  });

  it("caps the past at the given depth", () => {
    let h = createHistory<number>();
    for (let i = 0; i < 10; i++) h = record(h, i, 3);
    expect(h.past).toEqual([7, 8, 9]);
  });
});
