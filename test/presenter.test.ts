import { describe, expect, it } from "vitest";
import type { MindMapDoc } from "../src/model/types";
import { presenterContext } from "../src/present/presenter";
import { presentationSlides } from "../src/present/slides";

const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "Plan",
  root: {
    id: "r",
    topic: "Plan",
    note: "Intro note",
    children: [
      { id: "a", topic: "Alpha", note: "Alpha speaker notes", children: [] },
      { id: "b", topic: "Beta", children: [] },
      { id: "c", topic: "Gamma", note: "Gamma notes", children: [] },
    ],
  },
};

const slides = presentationSlides(doc); // overview, Alpha, Beta, Gamma (4 slides)

describe("presenterContext", () => {
  it("pulls notes from the current slide's node", () => {
    expect(presenterContext(slides, 0).notes).toBe("Intro note"); // overview = root note
    expect(presenterContext(slides, 1).notes).toBe("Alpha speaker notes");
    expect(presenterContext(slides, 3).notes).toBe("Gamma notes");
  });

  it("reports no notes when the node has none", () => {
    expect(presenterContext(slides, 2).notes).toBeUndefined(); // Beta has no note
  });

  it("prefers a custom deck's per-slide note over the node's own (#3)", () => {
    // A Slide with an override note (as resolveSlides produces for a custom deck).
    const withOverride = [{ ...slides[1], note: "Override" }];
    expect(presenterContext(withOverride, 0).notes).toBe("Override");
    // …and falls back to the node note when the slide carries none.
    expect(presenterContext([slides[1]], 0).notes).toBe("Alpha speaker notes");
  });

  it("peeks at the next slide's heading on the first/overview slide", () => {
    expect(presenterContext(slides, 0).nextHeading).toBe("Alpha");
  });

  it("peeks at the next slide's heading in the middle", () => {
    expect(presenterContext(slides, 1).nextHeading).toBe("Beta");
    expect(presenterContext(slides, 2).nextHeading).toBe("Gamma");
  });

  it("has no next heading on the last slide (end of map)", () => {
    expect(presenterContext(slides, 3).nextHeading).toBeUndefined();
  });

  it("lists every slide in the agenda and flags exactly the current one", () => {
    const ctx = presenterContext(slides, 2);
    expect(ctx.agenda.map((a) => a.heading)).toEqual(["Plan", "Alpha", "Beta", "Gamma"]);
    expect(ctx.agenda.map((a) => a.index)).toEqual([0, 1, 2, 3]);
    expect(ctx.agenda.filter((a) => a.current)).toHaveLength(1);
    expect(ctx.agenda.find((a) => a.current)?.index).toBe(2);
  });

  it("clamps an out-of-range index instead of throwing", () => {
    // Past the end clamps to the last slide; negative clamps to the first.
    expect(presenterContext(slides, 99).agenda.find((a) => a.current)?.index).toBe(3);
    expect(presenterContext(slides, 99).nextHeading).toBeUndefined();
    expect(presenterContext(slides, -5).agenda.find((a) => a.current)?.index).toBe(0);
  });

  it("handles a single-slide (childless) map", () => {
    const lonely: MindMapDoc = {
      schemaVersion: 1,
      id: "x",
      title: "Solo",
      root: { id: "r", topic: "Solo", note: "only note", children: [] },
    };
    const one = presentationSlides(lonely);
    const ctx = presenterContext(one, 0);
    expect(ctx.notes).toBe("only note");
    expect(ctx.nextHeading).toBeUndefined();
    expect(ctx.agenda).toHaveLength(1);
    expect(ctx.agenda[0].current).toBe(true);
  });
});
