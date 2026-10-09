import { describe, expect, it } from "vitest";
import type { MindMapDoc } from "../src/model/types";
import {
  OVERVIEW_SLIDE_ID,
  deckRows,
  hasCustomDeck,
  presentationSlides,
  resolveSlides,
  slideKey,
} from "../src/present/slides";

const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "Plan",
  root: {
    id: "r",
    topic: "Plan",
    children: [
      { id: "a", topic: "Alpha", children: [{ id: "a1", topic: "Alpha One", children: [] }] },
      { id: "b", topic: "Beta", children: [] },
    ],
  },
};

describe("presentationSlides", () => {
  it("opens with an overview, then one slide per top-level branch", () => {
    const slides = presentationSlides(doc);
    expect(slides.map((s) => s.heading)).toEqual(["Plan", "Alpha", "Beta"]);
    expect(slides[0].isOverview).toBe(true);
    expect(slides[1].isOverview).toBe(false);
    expect(slides[1].node.children.map((c) => c.topic)).toEqual(["Alpha One"]);
  });

  it("produces a single overview slide for a childless map", () => {
    const lonely: MindMapDoc = {
      schemaVersion: 1,
      id: "x",
      title: "Solo",
      root: { id: "r", topic: "Solo", children: [] },
    };
    expect(presentationSlides(lonely).map((s) => s.heading)).toEqual(["Solo"]);
  });
});

describe("resolveSlides (#3)", () => {
  it("falls back to the auto deck when no custom deck is set", () => {
    expect(resolveSlides(doc).map((s) => s.heading)).toEqual(["Plan", "Alpha", "Beta"]);
  });

  it("honours a custom deck: order, the overview sentinel, and per-slide notes", () => {
    const custom: MindMapDoc = {
      ...doc,
      meta: {
        slides: [
          { nodeId: "b" },
          { nodeId: "overview", note: "Welcome" },
          { nodeId: "a1", note: "Detail" },
        ],
      },
    };
    const slides = resolveSlides(custom);
    expect(slides.map((s) => s.heading)).toEqual(["Beta", "Plan", "Alpha One"]);
    expect(slides[1].isOverview).toBe(true);
    expect(slides[1].note).toBe("Welcome");
    expect(slides[2].note).toBe("Detail");
  });

  it("skips refs whose topic no longer resolves, and an all-invalid deck falls back to auto", () => {
    const partlyStale: MindMapDoc = {
      ...doc,
      meta: { slides: [{ nodeId: "a" }, { nodeId: "ghost" }] },
    };
    expect(resolveSlides(partlyStale).map((s) => s.heading)).toEqual(["Alpha"]);

    const allStale: MindMapDoc = { ...doc, meta: { slides: [{ nodeId: "ghost" }] } };
    expect(resolveSlides(allStale).map((s) => s.heading)).toEqual(["Plan", "Alpha", "Beta"]);
  });
});

describe("slideKey (item 1)", () => {
  it("keys the overview slide by the sentinel and a branch slide by its node id", () => {
    const [overview, alpha] = presentationSlides(doc);
    expect(slideKey(overview)).toBe(OVERVIEW_SLIDE_ID);
    expect(slideKey(alpha)).toBe("a");
  });
});

describe("deckRows + hasCustomDeck (#3)", () => {
  it("seeds from the auto deck (overview + top branches) when none is custom", () => {
    expect(hasCustomDeck(doc)).toBe(false);
    const rows = deckRows(doc);
    expect(rows.map((r) => r.ref.nodeId)).toEqual(["overview", "a", "b"]);
    expect(rows.map((r) => r.heading)).toEqual(["Plan", "Alpha", "Beta"]);
  });

  it("returns the custom deck's refs + resolved headings, skipping stale ids", () => {
    const custom: MindMapDoc = {
      ...doc,
      meta: { slides: [{ nodeId: "a1", note: "n" }, { nodeId: "ghost" }] },
    };
    expect(hasCustomDeck(custom)).toBe(true);
    const rows = deckRows(custom);
    expect(rows.map((r) => r.heading)).toEqual(["Alpha One"]);
    expect(rows[0].ref.note).toBe("n");
  });
});
