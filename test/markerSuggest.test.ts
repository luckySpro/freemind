import { describe, expect, it } from "vitest";
import { suggestMarkers, suggestNewMarkers } from "../src/markerSuggest";

// suggestMarkers maps text cues in a topic to marker glyphs; suggestNewMarkers drops ones already on
// the node (what the inspector actually offers). Pure + deterministic.
describe("suggestMarkers", () => {
  it("maps word + symbol cues to markers (case-insensitive)", () => {
    expect(suggestMarkers("Ship the URGENT fix")).toContain("❗");
    expect(suggestMarkers("Why does this fail?")).toContain("❓");
    expect(suggestMarkers("This is a blocker / risk")).toContain("🚩");
    expect(suggestMarkers("Great idea — maybe")).toContain("💡");
    expect(suggestMarkers("Q3 goal")).toContain("🎯");
    expect(suggestMarkers("Done!")).toEqual(expect.arrayContaining(["✅", "❗"]));
  });

  it("returns nothing for plain text", () => {
    expect(suggestMarkers("A normal topic")).toEqual([]);
  });

  it("dedupes and keeps cue order", () => {
    // both "urgent" and "!" map to ❗ — only once
    expect(suggestMarkers("urgent!").filter((m) => m === "❗")).toHaveLength(1);
  });

  it("suggestNewMarkers omits markers the node already carries", () => {
    expect(suggestNewMarkers("urgent question", ["❗"])).toEqual(["❓"]);
    expect(suggestNewMarkers("urgent", ["❗"])).toEqual([]);
  });
});
