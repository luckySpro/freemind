import { describe, expect, it } from "vitest";
import { fromMindMup } from "../src/io/mindmup";

// biome-ignore lint/suspicious/noExplicitAny: building arbitrary MindMup JSON for fixtures
function makeMup(obj: any): string {
  return JSON.stringify(obj);
}

// Realistic .mup fixture: root with ideas keyed by rank strings.
// Ranks "2" and "1" are intentionally out of insertion order to verify
// that the importer sorts children by numeric rank (1 before 2).
const fixture = {
  id: 1,
  title: "Strategy",
  formatVersion: 2,
  ideas: {
    "2": {
      id: 3,
      title: "Child B",
      ideas: {},
    },
    "1": {
      id: 2,
      title: "Child A",
      ideas: {
        "1": { id: 5, title: "Grandchild", ideas: {} },
      },
    },
    "-1": {
      id: 4,
      title: "Left side",
      ideas: {},
    },
  },
};

describe("MindMup .mup import", () => {
  it("reads the root topic and title", () => {
    const doc = fromMindMup(makeMup(fixture));
    expect(doc.title).toBe("Strategy");
    expect(doc.root.topic).toBe("Strategy");
  });

  it("orders children by ascending numeric rank (not insertion order)", () => {
    const doc = fromMindMup(makeMup(fixture));
    // Ranks: -1 → 1 → 2 (numeric ascending)
    expect(doc.root.children.map((c) => c.topic)).toEqual(["Left side", "Child A", "Child B"]);
  });

  it("recurses into grandchildren", () => {
    const doc = fromMindMup(makeMup(fixture));
    const childA = doc.root.children[1]; // rank "1" → second after rank "-1"
    expect(childA.children.map((c) => c.topic)).toEqual(["Grandchild"]);
  });

  it("carries a note from attr.note.text", () => {
    const withNote = {
      id: 1,
      title: "Root",
      formatVersion: 2,
      ideas: {
        "1": {
          id: 2,
          title: "Annotated",
          attr: { note: { text: "a note" } },
          ideas: {},
        },
      },
    };
    const doc = fromMindMup(makeMup(withNote));
    expect(doc.root.children[0].note).toBe("a note");
  });

  it("omits note when attr.note.text is empty or absent", () => {
    const doc = fromMindMup(makeMup(fixture));
    // None of the fixture nodes carry a note
    expect(doc.root.note).toBeUndefined();
    expect(doc.root.children[0].note).toBeUndefined();
  });

  it("carries a safe hyperlink from attr.link.url", () => {
    const withLink = {
      id: 1,
      title: "Root",
      formatVersion: 2,
      ideas: {
        "1": {
          id: 2,
          title: "Linked",
          attr: { link: { url: "https://example.com/page" } },
          ideas: {},
        },
      },
    };
    const doc = fromMindMup(makeMup(withLink));
    expect(doc.root.children[0].hyperlink).toBe("https://example.com/page");
  });

  it("drops a dangerous javascript: hyperlink", () => {
    const withEvil = {
      id: 1,
      title: "Root",
      formatVersion: 2,
      ideas: {
        "1": {
          id: 2,
          title: "Evil",
          attr: { link: { url: "javascript:alert(1)" } },
          ideas: {},
        },
      },
    };
    const doc = fromMindMup(makeMup(withEvil));
    expect(doc.root.children[0].hyperlink).toBeUndefined();
  });

  it("drops a dangerous data: hyperlink", () => {
    const withData = {
      id: 1,
      title: "Root",
      formatVersion: 2,
      ideas: {
        "1": {
          id: 2,
          title: "DataLink",
          attr: { link: { url: "data:text/html,<script>alert(1)</script>" } },
          ideas: {},
        },
      },
    };
    const doc = fromMindMup(makeMup(withData));
    expect(doc.root.children[0].hyperlink).toBeUndefined();
  });

  it("sets meta.source to 'mindmup'", () => {
    const doc = fromMindMup(makeMup(fixture));
    expect(doc.meta?.source).toBe("mindmup");
  });

  it("sets schemaVersion to 1", () => {
    const doc = fromMindMup(makeMup(fixture));
    expect(doc.schemaVersion).toBe(1);
  });

  it("every node gets a unique string id prefixed with 'mup'", () => {
    const doc = fromMindMup(makeMup(fixture));
    const ids: string[] = [];
    const collect = (n: typeof doc.root): void => {
      ids.push(n.id);
      n.children.forEach(collect);
    };
    collect(doc.root);
    expect(ids.every((id) => id.startsWith("mup"))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("children is always an array (never undefined) even on leaf nodes", () => {
    const doc = fromMindMup(makeMup(fixture));
    const childB = doc.root.children[2]; // rank "2", no ideas entries
    expect(Array.isArray(childB.children)).toBe(true);
    expect(childB.children).toHaveLength(0);
  });

  it("accepts a document without formatVersion if it has title", () => {
    const noVersion = { title: "Bare root", ideas: {} };
    const doc = fromMindMup(makeMup(noVersion));
    expect(doc.title).toBe("Bare root");
  });

  it("falls back title to 'Imported MindMup map' when title is absent", () => {
    const noTitle = { formatVersion: 2, ideas: {} };
    const doc = fromMindMup(makeMup(noTitle));
    expect(doc.title).toBe("Imported MindMup map");
  });

  it("throws on invalid JSON", () => {
    expect(() => fromMindMup("not json {{")).toThrow(/not valid JSON/i);
  });

  it("throws when the JSON has no title, ideas, or formatVersion", () => {
    expect(() => fromMindMup('{"foo":"bar"}')).toThrow(/missing title/i);
  });

  it("throws on an empty object", () => {
    expect(() => fromMindMup("{}")).toThrow();
  });

  it("throws on a JSON array (not a MindMup document)", () => {
    expect(() => fromMindMup("[1, 2, 3]")).toThrow();
  });

  it("tolerates a node with no `ideas` key (treats as leaf)", () => {
    const noIdeas = {
      id: 1,
      title: "Root",
      formatVersion: 2,
      ideas: {
        "1": { id: 2, title: "Leaf — no ideas field" },
      },
    };
    const doc = fromMindMup(makeMup(noIdeas));
    expect(doc.root.children[0].topic).toBe("Leaf — no ideas field");
    expect(doc.root.children[0].children).toEqual([]);
  });
});
