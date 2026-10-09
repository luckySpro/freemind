import { describe, expect, it } from "vitest";
import type { SlideRef } from "../src/model/types";
import { addSlide, removeSlide, reorderSlides, setSlideNote } from "../src/present/deckEdit";

const deck = (): SlideRef[] => [{ nodeId: "overview" }, { nodeId: "a" }, { nodeId: "b" }];

describe("reorderSlides", () => {
  it("moves an item and clamps the target into range", () => {
    expect(reorderSlides(deck(), 0, 2).map((s) => s.nodeId)).toEqual(["a", "b", "overview"]);
    expect(reorderSlides(deck(), 2, 0).map((s) => s.nodeId)).toEqual(["b", "overview", "a"]);
    // out-of-range target clamps to the ends
    expect(reorderSlides(deck(), 1, -5).map((s) => s.nodeId)).toEqual(["a", "overview", "b"]);
    expect(reorderSlides(deck(), 1, 99).map((s) => s.nodeId)).toEqual(["overview", "b", "a"]);
  });

  it("returns the same array reference for a no-op or out-of-range move", () => {
    const d = deck();
    expect(reorderSlides(d, 1, 1)).toBe(d);
    expect(reorderSlides(d, -1, 0)).toBe(d);
    expect(reorderSlides(d, 5, 0)).toBe(d);
  });
});

describe("addSlide / removeSlide", () => {
  it("appends a new slide ref", () => {
    expect(addSlide(deck(), "c").map((s) => s.nodeId)).toEqual(["overview", "a", "b", "c"]);
  });

  it("removes by index and ignores out-of-range", () => {
    expect(removeSlide(deck(), 1).map((s) => s.nodeId)).toEqual(["overview", "b"]);
    const d = deck();
    expect(removeSlide(d, 9)).toBe(d);
  });
});

describe("setSlideNote", () => {
  it("sets a note on one slide and leaves the rest untouched", () => {
    const next = setSlideNote(deck(), 1, "  speak  ");
    expect(next[1].note).toBe("  speak  "); // original (untrimmed) preserved when non-blank
    expect(next[0].note).toBeUndefined();
  });

  it("stores a blank note as undefined (falls back to the topic's own note)", () => {
    const withNote: SlideRef[] = [{ nodeId: "a", note: "old" }];
    expect(setSlideNote(withNote, 0, "   ")[0].note).toBeUndefined();
  });

  it("ignores an out-of-range index", () => {
    const d = deck();
    expect(setSlideNote(d, 9, "x")).toBe(d);
  });
});
