import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { fromMind } from "../src/io/mindmeister";

// biome-ignore lint/suspicious/noExplicitAny: building arbitrary MindMeister JSON for fixtures
function makeMind(mapJson: any): Uint8Array {
  return zipSync({ "map.json": strToU8(JSON.stringify(mapJson)) });
}

// Realistic map.json matching the format confirmed by the mindmeister-to-freemind
// converter (https://github.com/p2c2e/mindmeister-to-freemind): `map_version` at
// root, `root` node, `title` for text, `children` array for sub-topics.
const fixture = {
  map_version: "2",
  title: "Strategy Map",
  root: {
    title: "Vision",
    note: "Our north star",
    link: "https://example.com/strategy",
    children: [
      {
        title: "Pillar A",
        children: [
          { title: "Initiative 1", children: [] },
          { title: "Initiative 2", children: [] },
        ],
      },
      {
        title: "Pillar B",
        link: "javascript:alert(1)", // must be dropped
        children: [],
      },
      {
        title: "Pillar C",
        note: { text: "A note in object form" }, // object-form note
        link: { url: "https://example.com/c" }, // object-form link
        children: [],
      },
    ],
  },
};

describe("MindMeister .mind import", () => {
  it("reads the root topic and nested tree", () => {
    const doc = fromMind(makeMind(fixture));
    expect(doc.title).toBe("Strategy Map");
    expect(doc.root.topic).toBe("Vision");
    expect(doc.root.children.map((c) => c.topic)).toEqual(["Pillar A", "Pillar B", "Pillar C"]);
    const pillarA = doc.root.children[0];
    expect(pillarA.children.map((c) => c.topic)).toEqual(["Initiative 1", "Initiative 2"]);
  });

  it("carries string notes and web links on the root node", () => {
    const doc = fromMind(makeMind(fixture));
    expect(doc.root.note).toBe("Our north star");
    expect(doc.root.hyperlink).toBe("https://example.com/strategy");
  });

  it("drops dangerous javascript: links", () => {
    const doc = fromMind(makeMind(fixture));
    const pillarB = doc.root.children[1];
    expect(pillarB.hyperlink).toBeUndefined();
  });

  it("accepts a note in { text } object form", () => {
    const doc = fromMind(makeMind(fixture));
    const pillarC = doc.root.children[2];
    expect(pillarC.note).toBe("A note in object form");
  });

  it("accepts a link in { url } object form", () => {
    const doc = fromMind(makeMind(fixture));
    const pillarC = doc.root.children[2];
    expect(pillarC.hyperlink).toBe("https://example.com/c");
  });

  it("sets meta.source to 'mindmeister'", () => {
    expect(fromMind(makeMind(fixture)).meta?.source).toBe("mindmeister");
  });

  it("tolerates a node using `text` instead of `title`", () => {
    const altFixture = {
      map_version: "2",
      root: {
        text: "Root via text key",
        children: [{ text: "Child via text key", children: [] }],
      },
    };
    const doc = fromMind(makeMind(altFixture));
    expect(doc.root.topic).toBe("Root via text key");
    expect(doc.root.children[0].topic).toBe("Child via text key");
  });

  it("tolerates `nodes` as a children-key alias", () => {
    const altFixture = {
      map_version: "2",
      root: {
        title: "Root",
        nodes: [{ title: "Child via nodes key", nodes: [] }],
      },
    };
    const doc = fromMind(makeMind(altFixture));
    expect(doc.root.children[0].topic).toBe("Child via nodes key");
  });

  it("falls back title from root.topic when no top-level title field", () => {
    const noTitle = { map_version: "2", root: { title: "Only Topic", children: [] } };
    expect(fromMind(makeMind(noTitle)).title).toBe("Only Topic");
  });

  it("throws when the zip has no map.json", () => {
    const badZip = zipSync({ "other.json": strToU8("{}") });
    expect(() => fromMind(badZip)).toThrow(/no map\.json/);
  });

  it("throws on bytes that are not a zip", () => {
    expect(() => fromMind(new Uint8Array([1, 2, 3, 4]))).toThrow();
  });

  it("assigns unique ids to every node", () => {
    const doc = fromMind(makeMind(fixture));
    const ids: string[] = [];
    const collect = (n: typeof doc.root): void => {
      ids.push(n.id);
      n.children.forEach(collect);
    };
    collect(doc.root);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith("mm"))).toBe(true);
  });

  it("accepts a link in { href } object form (fallback to href)", () => {
    const hrefFixture = {
      map_version: "2",
      root: {
        title: "Root",
        link: { href: "https://example.com/via-href" },
        children: [],
      },
    };
    const doc = fromMind(makeMind(hrefFixture));
    expect(doc.root.hyperlink).toBe("https://example.com/via-href");
  });

  it("accepts a note in { content } object form (fallback to content)", () => {
    const contentFixture = {
      map_version: "2",
      root: {
        title: "Root",
        note: { content: "Note via content field" },
        children: [],
      },
    };
    const doc = fromMind(makeMind(contentFixture));
    expect(doc.root.note).toBe("Note via content field");
  });

  it("prefers url over href when both exist in link object", () => {
    const preferUrlFixture = {
      map_version: "2",
      root: {
        title: "Root",
        link: { url: "https://example.com/url", href: "https://example.com/href" },
        children: [],
      },
    };
    const doc = fromMind(makeMind(preferUrlFixture));
    expect(doc.root.hyperlink).toBe("https://example.com/url");
  });

  it("prefers text over content when both exist in note object", () => {
    const preferTextFixture = {
      map_version: "2",
      root: {
        title: "Root",
        note: { text: "Note via text", content: "Note via content" },
        children: [],
      },
    };
    const doc = fromMind(makeMind(preferTextFixture));
    expect(doc.root.note).toBe("Note via text");
  });
});
