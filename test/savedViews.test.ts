import { describe, expect, it } from "vitest";
import { type SavedView, addView, removeView } from "../src/savedViews";

const view = (over: Partial<SavedView> = {}): SavedView => ({
  id: "v1",
  name: "Overview",
  viewport: { x: 0, y: 0, zoom: 1 },
  drillId: null,
  criteria: null,
  ...over,
});

describe("saved views (pure ops)", () => {
  it("addView appends a view", () => {
    expect(addView([], view()).map((v) => v.name)).toEqual(["Overview"]);
  });

  it("addView replaces an existing view with the same name (rename = overwrite)", () => {
    const list = [view({ id: "v1", name: "Overview" })];
    const next = addView(list, view({ id: "v2", name: "Overview", drillId: "n3" }));
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: "v2", drillId: "n3" });
  });

  it("addView keeps distinct names side by side", () => {
    const list = addView(addView([], view({ id: "a", name: "A" })), view({ id: "b", name: "B" }));
    expect(list.map((v) => v.name)).toEqual(["A", "B"]);
  });

  it("removeView drops by id", () => {
    const list = [view({ id: "a", name: "A" }), view({ id: "b", name: "B" })];
    expect(removeView(list, "a").map((v) => v.id)).toEqual(["b"]);
    expect(removeView(list, "missing")).toHaveLength(2);
  });
});
