import { describe, expect, it } from "vitest";
import { buildNotesAppendix } from "../src/io/notesAppendix";
import type { MindMapDoc } from "../src/model/types";

// buildNotesAppendix is the pure print/PDF "Notes" section (#16): every noted topic, with its outline
// number + title and the note rendered from the safe markdown subset.

const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "Root",
  root: {
    id: "r",
    topic: "Root",
    children: [
      { id: "a", topic: "Alpha", note: "**bold** point", children: [] },
      {
        id: "b",
        topic: "Beta",
        children: [{ id: "b1", topic: "Beta one", note: "child note", children: [] }],
      },
      { id: "c", topic: "Gamma", children: [] }, // no note → skipped
    ],
  },
  floatingTopics: [{ id: "f", topic: "Legend", note: "floating note", children: [] }],
};

describe("buildNotesAppendix", () => {
  it("lists every noted topic with its outline number, title, and rendered note", () => {
    const html = buildNotesAppendix(doc);
    expect(html).toContain('<section class="mm-notes-appendix"><h2>Notes</h2>');
    expect(html).toContain("<h3>1 Alpha</h3>"); // outline number + title
    expect(html).toContain("<strong>bold</strong> point"); // note rendered via renderNote
    expect(html).toContain("Beta one</h3>");
    expect(html).toContain("floating note"); // floating topics included
    expect(html).not.toContain("Gamma"); // a note-less topic is omitted
  });

  it("returns an empty string when no topic carries a note", () => {
    const bare: MindMapDoc = {
      ...doc,
      root: { id: "r", topic: "R", children: [{ id: "x", topic: "X", children: [] }] },
      floatingTopics: [],
    };
    expect(buildNotesAppendix(bare)).toBe("");
  });

  it("escapes the topic title (no markup injection from a title)", () => {
    const evil: MindMapDoc = {
      ...doc,
      root: {
        id: "r",
        topic: "R",
        children: [{ id: "x", topic: "<img src=x>", note: "n", children: [] }],
      },
      floatingTopics: [],
    };
    const html = buildNotesAppendix(evil);
    expect(html).toContain("&lt;img src=x&gt;");
    expect(html).not.toContain("<img src=x>");
  });
});
