import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { fromXmind } from "../src/io/xmind";

// Hand-authored minimal legacy XMind content.xml fixture.
// Schema (confirmed from tobyqin/xmindparser xreader.py):
//   <xmap-content xmlns:xlink="...">
//     <sheet id="s1">
//       <title>Sheet 1</title>
//       <topic id="root">
//         <title>Central</title>
//         <children>
//           <topics type="attached">
//             <topic id="c1">
//               <title>Child One</title>
//               <notes><plain>A note here</plain></notes>
//               <xlink:href attribute on the topic element -> web link>
//             </topic>
//             <topic id="c2">
//               <title>Child Two</title>
//             </topic>
//           </topics>
//         </children>
//       </topic>
//     </sheet>
//   </xmap-content>

const LEGACY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<xmap-content xmlns="urn:xmind:xmap:xmlns:content:2.0"
              xmlns:xlink="http://www.w3.org/1999/xlink"
              version="2.0">
  <sheet id="s1">
    <title>My Legacy Sheet</title>
    <topic id="root">
      <title>Central Topic</title>
      <children>
        <topics type="attached">
          <topic id="c1" xlink:href="https://example.com">
            <title>Child One</title>
            <notes>
              <plain>A note here</plain>
            </notes>
            <labels>
              <label>tag-alpha</label>
              <label>tag-beta</label>
            </labels>
            <marker-refs>
              <marker-ref marker-id="priority-1"/>
              <marker-ref marker-id="flag-red"/>
            </marker-refs>
          </topic>
          <topic id="c2" xlink:href="javascript:alert(1)">
            <title>Child Two</title>
          </topic>
        </topics>
        <topics type="detached">
          <topic id="f1">
            <title>Floating Note</title>
          </topic>
        </topics>
      </children>
    </topic>
    <relationships>
      <relationship id="rel1" end1="c1" end2="c2">
        <title>depends on</title>
      </relationship>
    </relationships>
  </sheet>
</xmap-content>`;

function makeLegacyXmind(xml: string): Uint8Array {
  return zipSync({ "content.xml": strToU8(xml) });
}

describe("XMind legacy content.xml import", () => {
  it("parses root topic title and sheet title", () => {
    const doc = fromXmind(makeLegacyXmind(LEGACY_XML));
    expect(doc.title).toBe("My Legacy Sheet");
    expect(doc.root.topic).toBe("Central Topic");
  });

  it("maps attached child topics into children array", () => {
    const doc = fromXmind(makeLegacyXmind(LEGACY_XML));
    expect(doc.root.children).toHaveLength(2);
    expect(doc.root.children.map((c) => c.topic)).toEqual(["Child One", "Child Two"]);
  });

  it("carries notes from <notes><plain>", () => {
    const doc = fromXmind(makeLegacyXmind(LEGACY_XML));
    expect(doc.root.children[0].note).toBe("A note here");
    expect(doc.root.children[1].note).toBeUndefined();
  });

  it("carries a safe xlink:href as hyperlink", () => {
    const doc = fromXmind(makeLegacyXmind(LEGACY_XML));
    expect(doc.root.children[0].hyperlink).toBe("https://example.com");
  });

  it("drops dangerous-scheme xlink:href (javascript:)", () => {
    const doc = fromXmind(makeLegacyXmind(LEGACY_XML));
    expect(doc.root.children[1].hyperlink).toBeUndefined();
  });

  it("carries <labels><label> elements as tags", () => {
    const doc = fromXmind(makeLegacyXmind(LEGACY_XML));
    expect(doc.root.children[0].tags).toEqual(["tag-alpha", "tag-beta"]);
    expect(doc.root.children[1].tags).toBeUndefined();
  });

  it("sets meta.source to 'xmind'", () => {
    const doc = fromXmind(makeLegacyXmind(LEGACY_XML));
    expect(doc.meta?.source).toBe("xmind");
  });

  it("falls back to root topic text when sheet has no <title>", () => {
    const noSheetTitle = LEGACY_XML.replace("<title>My Legacy Sheet</title>", "");
    const doc = fromXmind(makeLegacyXmind(noSheetTitle));
    expect(doc.title).toBe("Central Topic");
  });

  it("carries <marker-refs> as emoji markers", () => {
    const doc = fromXmind(makeLegacyXmind(LEGACY_XML));
    expect(doc.root.children[0].icons).toEqual(["1️⃣", "🚩"]);
    expect(doc.root.children[1].icons).toBeUndefined();
  });

  it("maps detached topics to floatingTopics and relationships to cross-links", () => {
    const doc = fromXmind(makeLegacyXmind(LEGACY_XML));
    expect(doc.floatingTopics?.map((f) => f.topic)).toEqual(["Floating Note"]);
    expect(doc.links).toHaveLength(1);
    const [link] = doc.links ?? [];
    expect(link.label).toBe("depends on");
    expect(link.from).toBe(doc.root.children[0].id);
    expect(link.to).toBe(doc.root.children[1].id);
  });

  it("still prefers content.json when both are present in the zip", () => {
    const both = zipSync({
      "content.xml": strToU8(LEGACY_XML),
      "content.json": strToU8(
        JSON.stringify([{ title: "JSON Sheet", rootTopic: { title: "JSON Root" } }]),
      ),
    });
    const doc = fromXmind(both);
    expect(doc.root.topic).toBe("JSON Root");
    expect(doc.title).toBe("JSON Sheet");
  });
});
