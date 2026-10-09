import { afterEach, describe, expect, it } from "vitest";
import {
  __resetOpsClock,
  __setOpsClock,
  addCallout,
  deleteCallout,
  setCalloutColor,
  setCalloutText,
} from "../src/mindmap/flow/ops";
import type { MindMapDoc } from "../src/model/types";

afterEach(() => __resetOpsClock());

const base = (): MindMapDoc => ({
  schemaVersion: 1,
  id: "d",
  title: "Root",
  root: { id: "r", topic: "Root", children: [{ id: "a", topic: "A", children: [] }] },
});

// A map with a floating topic (which also renders callouts) to prove callout writes reach it.
const withFloating = (): MindMapDoc => ({
  schemaVersion: 1,
  id: "d",
  title: "Root",
  root: { id: "r", topic: "Root", children: [] },
  floatingTopics: [{ id: "f", topic: "Legend", children: [] }],
});

describe("callout ops", () => {
  it("adds a callout with default text and staggers repeats", () => {
    const d1 = addCallout(base(), "a").doc;
    const first = d1.root.children[0].callouts ?? [];
    expect(first).toHaveLength(1);
    expect(first[0].text).toBe("Note");
    const cs = addCallout(d1, "a").doc.root.children[0].callouts ?? [];
    expect(cs).toHaveLength(2);
    expect(cs[0].dy).not.toBe(cs[1].dy); // staggered so they don't stack
  });

  it("sets a callout's text", () => {
    const d1 = addCallout(base(), "a").doc;
    const id = d1.root.children[0].callouts?.[0].id ?? "";
    const d2 = setCalloutText(d1, "a", id, "Reviewed").doc;
    expect(d2.root.children[0].callouts?.[0].text).toBe("Reviewed");
  });

  it("deletes a callout, clearing the array when it empties", () => {
    const d1 = addCallout(base(), "a").doc;
    const id = d1.root.children[0].callouts?.[0].id ?? "";
    const d2 = deleteCallout(d1, "a", id).doc;
    expect(d2.root.children[0].callouts).toBeUndefined();
  });

  it("sets a callout's colour and bumps the host node's modifiedAt (parity with text)", () => {
    let now = 1000;
    __setOpsClock(() => {
      now += 1000; // distinct, monotonic stamps so the touch is observable
      return now;
    });
    const d1 = addCallout(base(), "a").doc;
    const id = d1.root.children[0].callouts?.[0].id ?? "";
    const before = d1.root.children[0].modifiedAt;
    const d2 = setCalloutColor(d1, "a", id, "#ff0000").doc;
    expect(d2.root.children[0].callouts?.[0].color).toBe("#ff0000");
    expect(d2.root.children[0].modifiedAt).not.toBe(before); // touched, like setCalloutText does
    // "" clears the override.
    expect(
      setCalloutColor(d2, "a", id, "").doc.root.children[0].callouts?.[0].color,
    ).toBeUndefined();
  });

  it("adds, edits, colours and deletes a callout on a FLOATING topic (not just the tree)", () => {
    const d1 = addCallout(withFloating(), "f").doc;
    const cid = d1.floatingTopics?.[0].callouts?.[0].id ?? "";
    expect(cid).not.toBe("");
    const d2 = setCalloutText(d1, "f", cid, "Key").doc;
    expect(d2.floatingTopics?.[0].callouts?.[0].text).toBe("Key");
    const d3 = setCalloutColor(d2, "f", cid, "#0a0").doc;
    expect(d3.floatingTopics?.[0].callouts?.[0].color).toBe("#0a0");
    const d4 = deleteCallout(d3, "f", cid).doc;
    expect(d4.floatingTopics?.[0].callouts).toBeUndefined();
  });

  it("is a no-op for an unknown node or callout id", () => {
    const d = base();
    expect(addCallout(d, "nope").doc).toBe(d);
    expect(setCalloutText(d, "a", "missing", "y").doc).toBe(d);
    expect(setCalloutColor(d, "a", "missing", "#fff").doc).toBe(d);
    expect(deleteCallout(d, "a", "missing").doc).toBe(d);
  });
});
