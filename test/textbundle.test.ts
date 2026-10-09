import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { fromTextBundle } from "../src/io/textbundle";
import type { MapNode } from "../src/model/types";

const pack = (path: string, md: string): Uint8Array => zipSync({ [path]: strToU8(md) });
const topics = (n: MapNode): string[] => [n.topic, ...n.children.flatMap(topics)];

describe("fromTextBundle", () => {
  it("reads text.md from a .textpack and builds a tree from the Markdown", () => {
    const doc = fromTextBundle(pack("text.md", "# Root\n\n## A\n\n## B\n"));
    expect(doc.root.topic).toBe("Root");
    expect(topics(doc.root)).toEqual(expect.arrayContaining(["Root", "A", "B"]));
  });

  it("finds the text file nested one folder deep (the .textbundle layout)", () => {
    const doc = fromTextBundle(pack("My Note.textbundle/text.markdown", "# Hi\n\n## One\n"));
    expect(topics(doc.root)).toEqual(expect.arrayContaining(["Hi", "One"]));
  });

  it("throws when the bundle carries no text file", () => {
    expect(() => fromTextBundle(pack("assets/info.json", "{}"))).toThrow();
  });
});
