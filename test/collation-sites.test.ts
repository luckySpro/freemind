// @vitest-environment jsdom
//
// The collation SITES, not the helper. `compareText` has its own unit tests in i18n.test.ts; this checks
// that a place which orders user text actually routes through it — because the failure mode is silent. A
// bare `.sort()` compiles, runs, and quietly strands å/æ/ö past z in every alphabet.
import { describe, expect, it } from "vitest";
import type { MapNode } from "../src/model/types";
import { markerTagIndex } from "../src/outline";

const node = (id: string, topic: string, extra: Partial<MapNode> = {}): MapNode => ({
  id,
  topic,
  children: [],
  ...extra,
});

describe("marker / tag index ordering", () => {
  const root = node("r", "Root", {
    children: [
      node("a", "A", { tags: ["zebra"] }),
      node("b", "B", { tags: ["Åben"] }),
      node("c", "C", { tags: ["banan"] }),
    ],
  });

  it("orders tag keys by the locale, not by code point", () => {
    // With English active `Å` collates as `A`, so it sorts FIRST. A bare .sort() puts it last, after `z`,
    // because U+00C5 is numerically past every ASCII letter — wrong for English and for Danish alike.
    const keys = markerTagIndex(root).tags.map((t) => t.key);
    expect(keys).toEqual(["Åben", "banan", "zebra"]);
  });

  it("differs from the codepoint order it replaced", () => {
    // Pins that this test is actually exercising the fix: if the site regressed to `.sort()`, the two
    // orders would agree and the assertion above would still pass for a purely-ASCII fixture.
    const keys = markerTagIndex(root).tags.map((t) => t.key);
    expect([...keys].sort()).toEqual(["banan", "zebra", "Åben"]);
    expect([...keys].sort()).not.toEqual(keys);
  });
});
