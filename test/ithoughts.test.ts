import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { fromIthoughts } from "../src/io/ithoughts";

// Hand-authored mapdata.xml matching the iThoughts format:
//   • <iThoughts> root wrapper with <topics> child
//   • First <topic> = map centre (root), nested <topic>s = children
//   • `text` attribute = label, `uuid` = stable id
//   • `note` attribute = extended note
//   • `link` attribute = hyperlink
//   • <relationship> sibling inside <topics> for cross-links (end1-uuid / end2-uuid)
//   • Extra peer <topic> after the root = floating topic
const fixture = `<?xml version="1.0" encoding="UTF-8"?>
<iThoughts version="4.0" app="iThoughts" app-version="7.0">
  <topics>
    <topic uuid="root-1" text="Project Plan">
      <topic uuid="child-1" text="Research" note="Do background work" link="https://example.com/research">
        <topic uuid="grandchild-1" text="Literature review"/>
      </topic>
      <topic uuid="child-2" text="Design"/>
      <topic uuid="dangerous-1" text="BadLink" link="javascript:alert(1)"/>
    </topic>
    <relationship end1-uuid="child-1" end2-uuid="child-2" label="feeds into"/>
    <topic uuid="float-1" text="Legend" position="{400,200}"/>
  </topics>
</iThoughts>`;

const makeItmz = (xml: string) => zipSync({ "mapdata.xml": strToU8(xml) });

describe("iThoughts .itmz import", () => {
  it("builds the root topic and nested children", () => {
    const doc = fromIthoughts(makeItmz(fixture));
    expect(doc.title).toBe("Project Plan");
    expect(doc.root.topic).toBe("Project Plan");
    expect(doc.root.children.map((c) => c.topic)).toEqual(["Research", "Design", "BadLink"]);
    expect(doc.root.children[0].children.map((c) => c.topic)).toEqual(["Literature review"]);
  });

  it("carries notes and web hyperlinks", () => {
    const doc = fromIthoughts(makeItmz(fixture));
    const research = doc.root.children[0];
    expect(research.note).toBe("Do background work");
    expect(research.hyperlink).toBe("https://example.com/research");
  });

  it("drops dangerous-scheme hyperlinks (javascript:)", () => {
    const doc = fromIthoughts(makeItmz(fixture));
    const bad = doc.root.children[2];
    expect(bad.topic).toBe("BadLink");
    expect(bad.hyperlink).toBeUndefined();
  });

  it("maps <relationship> elements to cross-links using uuid→id resolution", () => {
    const doc = fromIthoughts(makeItmz(fixture));
    expect(doc.links?.length).toBe(1);
    const link = doc.links?.[0];
    expect(link?.label).toBe("feeds into");
    // Verify the from/to ids correspond to the Research and Design nodes.
    const researchId = doc.root.children[0].id;
    const designId = doc.root.children[1].id;
    expect(link?.from).toBe(researchId);
    expect(link?.to).toBe(designId);
  });

  it("treats extra top-level <topic> peers as floating topics", () => {
    const doc = fromIthoughts(makeItmz(fixture));
    expect(doc.floatingTopics?.map((f) => f.topic)).toEqual(["Legend"]);
  });

  it("sets meta.source to 'ithoughts' and schemaVersion to 1", () => {
    const doc = fromIthoughts(makeItmz(fixture));
    expect(doc.meta?.source).toBe("ithoughts");
    expect(doc.schemaVersion).toBe(1);
  });

  it("throws a descriptive error when mapdata.xml is missing from the zip", () => {
    const bad = zipSync({ "style.xml": strToU8("<style/>") });
    expect(() => fromIthoughts(bad)).toThrow(/mapdata\.xml/);
  });

  it("throws when given non-zip bytes", () => {
    expect(() => fromIthoughts(new Uint8Array([0, 1, 2, 3]))).toThrow();
  });

  it("handles a bare <topics> root without an <iThoughts> wrapper", () => {
    const bare = `<?xml version="1.0" encoding="UTF-8"?>
<topics>
  <topic uuid="r" text="Bare Root">
    <topic uuid="c" text="Child A"/>
  </topic>
</topics>`;
    const doc = fromIthoughts(makeItmz(bare));
    expect(doc.title).toBe("Bare Root");
    expect(doc.root.children.map((c) => c.topic)).toEqual(["Child A"]);
  });

  it("decodes \\n escape sequences in topic text", () => {
    const xml = `<iThoughts><topics><topic uuid="r" text="Line one\\nLine two"/></topics></iThoughts>`;
    const doc = fromIthoughts(makeItmz(xml));
    expect(doc.root.topic).toBe("Line one\nLine two");
  });

  it("collects floating topics from a <floating-topics> wrapper element", () => {
    const xml = `<iThoughts>
  <topics>
    <topic uuid="r" text="Root"/>
    <floating-topics>
      <topic uuid="f1" text="Floater A"/>
      <topic uuid="f2" text="Floater B"/>
    </floating-topics>
  </topics>
</iThoughts>`;
    const doc = fromIthoughts(makeItmz(xml));
    expect(doc.root.topic).toBe("Root");
    expect(doc.floatingTopics?.map((f) => f.topic)).toEqual(["Floater A", "Floater B"]);
  });

  it("silently skips relationships whose endpoints are not in the map", () => {
    const xml = `<iThoughts>
  <topics>
    <topic uuid="r" text="Root">
      <topic uuid="a" text="A"/>
    </topic>
    <relationship end1-uuid="a" end2-uuid="does-not-exist"/>
  </topics>
</iThoughts>`;
    const doc = fromIthoughts(makeItmz(xml));
    expect(doc.links).toBeUndefined();
  });
});
