import { describe, expect, it } from "vitest";
import { EDGE_PRESETS } from "../src/components/edgePresets";
import {
  addLink,
  deleteLink,
  setAccentColor,
  setLinkLabel,
  setLinkStyle,
} from "../src/mindmap/flow/ops";
import {
  BOUNDARY_FILL,
  BOUNDARY_STROKE,
  CROSSLINK_COLOR,
  resolveBoundaryStyle,
  resolveLinkStyle,
} from "../src/mindmap/flow/style";
import type { MindMapDoc } from "../src/model/types";

const base = (): MindMapDoc => ({
  schemaVersion: 1,
  id: "d",
  title: "Root",
  root: {
    id: "r",
    topic: "Root",
    children: [
      { id: "a", topic: "A", children: [] },
      { id: "b", topic: "B", children: [] },
    ],
  },
});

describe("map-wide accent fallback (#6)", () => {
  it("setAccentColor sets / clears meta.accentColor", () => {
    const on = setAccentColor(base(), "#2e86ab").doc;
    expect(on.meta?.accentColor).toBe("#2e86ab");
    expect(setAccentColor(on, "").doc.meta?.accentColor).toBeUndefined();
  });

  it("resolveLinkStyle: explicit colour > accent fallback > the purple default", () => {
    expect(resolveLinkStyle({}).color).toBe(CROSSLINK_COLOR);
    expect(resolveLinkStyle({}, "#2e86ab").color).toBe("#2e86ab");
    expect(resolveLinkStyle({ color: "#111111" }, "#2e86ab").color).toBe("#111111");
  });

  it("resolveBoundaryStyle: accent fallback tints the box; unstyled stays the historical default", () => {
    const def = resolveBoundaryStyle();
    expect(def.stroke).toBe(BOUNDARY_STROKE);
    expect(def.fill).toBe(BOUNDARY_FILL);
    const accented = resolveBoundaryStyle(undefined, "#2e86ab");
    expect(accented.stroke).toBe("#2e86ab");
    expect(accented.fill).not.toBe(BOUNDARY_FILL); // tinted from the accent
    // An explicit per-boundary colour still wins over the accent.
    expect(resolveBoundaryStyle("#ff0000", "#2e86ab").stroke).toBe("#ff0000");
  });
});

describe("cross-link ops", () => {
  it("adds a labelled link between two nodes", () => {
    const links = addLink(base(), "a", "b", "depends on").doc.links ?? [];
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ from: "a", to: "b", label: "depends on" });
    expect(links[0].id).toBeTruthy();
  });

  it("adds an unlabelled link with no label key", () => {
    const link = (addLink(base(), "a", "b").doc.links ?? [])[0];
    expect(link.from).toBe("a");
    expect("label" in link).toBe(false);
  });

  it("is a no-op for a self-link, an unknown node, or an exact duplicate", () => {
    const d = base();
    expect(addLink(d, "a", "a").doc).toBe(d);
    expect(addLink(d, "a", "nope").doc).toBe(d);
    const once = addLink(d, "a", "b").doc;
    expect(addLink(once, "a", "b").doc).toBe(once);
  });

  it("sets and clears a link label", () => {
    const d1 = addLink(base(), "a", "b").doc;
    const id = (d1.links ?? [])[0].id;
    expect(setLinkLabel(d1, id, "rel").doc.links?.[0]?.label).toBe("rel");
    const cleared = setLinkLabel(setLinkLabel(d1, id, "rel").doc, id, "").doc.links?.[0];
    expect(cleared && "label" in cleared).toBe(false);
  });

  it("deletes a link, clearing the array when it empties", () => {
    const d1 = addLink(base(), "a", "b").doc;
    const id = (d1.links ?? [])[0].id;
    expect(deleteLink(d1, id).doc.links).toBeUndefined();
  });

  it("is a no-op when setting/deleting an unknown link id", () => {
    const d = addLink(base(), "a", "b").doc;
    expect(setLinkLabel(d, "nope", "x").doc).toBe(d);
    expect(deleteLink(d, "nope").doc).toBe(d);
  });

  it("setLinkStyle sets an arrow override and drops the implicit 'to' default", () => {
    const d1 = addLink(base(), "a", "b").doc;
    const id = (d1.links ?? [])[0].id;
    expect(setLinkStyle(d1, id, { arrow: "both" }).doc.links?.[0]?.arrow).toBe("both");
    // "to" is the default → the field is dropped (lossless reset).
    const back = setLinkStyle(setLinkStyle(d1, id, { arrow: "both" }).doc, id, { arrow: "to" }).doc;
    const link = back.links?.[0];
    expect(link && "arrow" in link).toBe(false);
  });

  it("each edge preset applies cleanly in one setLinkStyle call (whole look at once)", () => {
    const d1 = addLink(base(), "a", "b").doc;
    const id = (d1.links ?? [])[0].id;
    for (const preset of EDGE_PRESETS) {
      const link = setLinkStyle(d1, id, preset.patch).doc.links?.[0];
      expect(link, preset.name).toBeDefined();
      // The non-default fields of the preset land on the link.
      if (preset.patch.dash && preset.patch.dash !== "dashed")
        expect(link?.dash, preset.name).toBe(preset.patch.dash);
      if (preset.patch.arrow && preset.patch.arrow !== "to")
        expect(link?.arrow, preset.name).toBe(preset.patch.arrow);
    }
  });
});
