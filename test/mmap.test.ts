import { readFileSync } from "node:fs";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { parseMmap } from "../src/import/mmap";
import { toMmap } from "../src/io/mmap";
import type { MapNode, MindMapDoc } from "../src/model/types";

// Synthetic Document.xml shaped like a real MindManager export (namespace
// http://schemas.mindjet.com/MindManager/Application/2003). Field shapes match
// the bundled XSD: text in <ap:Text PlainText>, notes in
// <ap:NotesGroup><ap:NotesXhtmlData PreviewPlainText>, etc.
const DOCUMENT_XML = `<?xml version="1.0" encoding="utf-8"?>
<ap:Map xmlns:ap="http://schemas.mindjet.com/MindManager/Application/2003">
  <ap:OneTopic>
    <ap:Topic OId="1">
      <ap:Text PlainText="Q3 Retail Plan" />
      <ap:NotesGroup><ap:NotesXhtmlData PreviewPlainText="Autumn season plan" /></ap:NotesGroup>
      <ap:SubTopics>
        <ap:Topic OId="2">
          <ap:Text PlainText="Merchandising" />
          <ap:SubTopics>
            <ap:Topic OId="3"><ap:Text PlainText="Autumn drop" /></ap:Topic>
            <ap:Topic OId="4"><ap:Text PlainText="Markdown cadence" /></ap:Topic>
          </ap:SubTopics>
        </ap:Topic>
        <ap:Topic OId="5">
          <ap:Text PlainText="E-commerce" />
        </ap:Topic>
      </ap:SubTopics>
    </ap:Topic>
  </ap:OneTopic>
</ap:Map>`;

const MAP_OPEN = `<?xml version="1.0"?>
<ap:Map xmlns:ap="http://schemas.mindjet.com/MindManager/Application/2003">`;

function mmapOf(xml: string): Uint8Array {
  return zipSync({ "Document.xml": strToU8(xml) });
}

// Two-sided ("balance") map: MindManager records a main branch's side as the sign of its horizontal
// offset (CX) from the central topic — negative = left, positive = right. Deeper topics carry offsets
// too (layout nudges), which must NOT be read as a side. Shapes mirror a real export.
const TWO_SIDED_XML = `${MAP_OPEN}
  <ap:OneTopic>
    <ap:Topic OId="1">
      <ap:Text PlainText="Areas of Focus" />
      <ap:SubTopics>
        <ap:Topic OId="2">
          <ap:Text PlainText="Right branch" />
          <ap:Offset CX="2." CY="0." />
          <ap:SubTopics>
            <ap:Topic OId="4">
              <ap:Text PlainText="Deep nudged" />
              <ap:Offset CX="-2." CY="0." />
            </ap:Topic>
          </ap:SubTopics>
        </ap:Topic>
        <ap:Topic OId="3">
          <ap:Text PlainText="Left branch" />
          <ap:Offset CX="-2." CY="0." />
        </ap:Topic>
        <ap:Topic OId="5"><ap:Text PlainText="Auto branch" /></ap:Topic>
      </ap:SubTopics>
    </ap:Topic>
  </ap:OneTopic>
</ap:Map>`;

describe("parseMmap", () => {
  it("imports the two-sided arrangement: each main branch's side from its offset sign (depth-1 only)", () => {
    const { doc } = parseMmap(mmapOf(TWO_SIDED_XML));
    const [right, left, auto] = doc.root.children;
    expect(right.topic).toBe("Right branch");
    expect(right.side).toBe("right"); // CX > 0 → right half
    expect(left.side).toBe("left"); // CX < 0 → left half
    expect(auto.side).toBeUndefined(); // no offset → let the app auto-balance
    // A deeper topic's offset is a layout nudge, not a side — must stay unset.
    expect(right.children[0].topic).toBe("Deep nudged");
    expect(right.children[0].side).toBeUndefined();
  });

  it("extracts the topic tree from a synthetic .mmap", () => {
    const { doc } = parseMmap(mmapOf(DOCUMENT_XML));
    expect(doc.title).toBe("Q3 Retail Plan");
    expect(doc.root.topic).toBe("Q3 Retail Plan");
    expect(doc.root.children.map((c) => c.topic)).toEqual(["Merchandising", "E-commerce"]);
    expect(doc.root.children[0].children.map((c) => c.topic)).toEqual([
      "Autumn drop",
      "Markdown cadence",
    ]);
  });

  it("captures notes (NotesXhtmlData PreviewPlainText)", () => {
    const { doc } = parseMmap(mmapOf(DOCUMENT_XML));
    expect(doc.root.note).toBe("Autumn season plan");
  });

  it("throws a helpful error when the zip is not a MindManager map", () => {
    const notAMap = zipSync({ "readme.txt": strToU8("hello") });
    expect(() => parseMmap(notAMap)).toThrow(/Document\.xml not found/);
  });

  it("throws when a <Map> has no root <Topic>", () => {
    expect(() => parseMmap(mmapOf(`${MAP_OPEN}\n  <ap:OneTopic />\n</ap:Map>`))).toThrow(
      /no root <Topic>/,
    );
  });

  it("imports per-topic task info (priority/progress/dates/resources) without warning", () => {
    const { doc, warnings } = parseMmap(
      mmapOf(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1"><ap:Text PlainText="Scheduled work" />
    <ap:Task TaskPriority="urn:mindjet:Prio1" TaskPercentage="40"
             StartDate="2026-06-01T00:00:00" DeadlineDate="2026-06-21T09:30:00"
             Resources="Ann, Bob" />
  </ap:Topic></ap:OneTopic>
</ap:Map>`),
    );
    expect(doc.root.topic).toBe("Scheduled work");
    expect(doc.root.task).toEqual({
      priority: 1,
      progress: 0.4,
      start: "2026-06-01",
      due: "2026-06-21",
      resources: ["Ann", "Bob"],
    });
    // Task fields now land in the model (inspector / filter / Kanban already support them) — no warning.
    expect(warnings.some((w) => /task/i.test(w))).toBe(false);
  });

  it("imports the full notes XHTML body, not just the truncated preview", () => {
    const { doc } = parseMmap(
      mmapOf(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1"><ap:Text PlainText="Root" />
    <ap:NotesGroup><ap:NotesXhtmlData PreviewPlainText="First paragraph…">
      <html xmlns="http://www.w3.org/1999/xhtml"><body>
        <p>First paragraph.</p><p>Second paragraph.</p>
      </body></html>
    </ap:NotesXhtmlData></ap:NotesGroup>
  </ap:Topic></ap:OneTopic>
</ap:Map>`),
    );
    expect(doc.root.note).toBe("First paragraph.\nSecond paragraph.");
  });

  it("falls back to the notes PreviewPlainText when there is no XHTML body", () => {
    const { doc } = parseMmap(
      mmapOf(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1"><ap:Text PlainText="Root" />
    <ap:NotesGroup><ap:NotesXhtmlData PreviewPlainText="Just a preview" /></ap:NotesGroup>
  </ap:Topic></ap:OneTopic>
</ap:Map>`),
    );
    expect(doc.root.note).toBe("Just a preview");
  });

  it("imports user tags from TextLabels", () => {
    const { doc } = parseMmap(
      mmapOf(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1"><ap:Text PlainText="Root" />
    <ap:TextLabels>
      <ap:TextLabel TextLabelName="Marketing" />
      <ap:TextLabel TextLabelName="Q3" />
    </ap:TextLabels>
  </ap:Topic></ap:OneTopic>
</ap:Map>`),
    );
    expect(doc.root.tags).toEqual(["Marketing", "Q3"]);
  });

  it("imports explicit topic fill/line colour + font as node style (ARGB alpha-first → #rrggbb)", () => {
    const { doc } = parseMmap(
      mmapOf(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1">
    <ap:Text PlainText="Styled"><ap:Font Color="ffcc0000" Name="Georgia" Size="18" Bold="true" /></ap:Text>
    <ap:Color FillColor="ff96b3df" LineColor="ff333333" />
  </ap:Topic></ap:OneTopic>
</ap:Map>`),
    );
    expect(doc.root.style).toEqual({
      background: "#96b3df",
      border: "1px solid #333333",
      color: "#cc0000",
      fontFamily: "Georgia",
      fontSize: "18px",
      fontWeight: "bold",
    });
  });

  it("ignores a fully-transparent fill colour (alpha 00 → no style override)", () => {
    const { doc } = parseMmap(
      mmapOf(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1"><ap:Text PlainText="Plain" />
    <ap:Color FillColor="00ffffff" />
  </ap:Topic></ap:OneTopic>
</ap:Map>`),
    );
    expect(doc.root.style).toBeUndefined();
  });

  // --- Phase B/C ---------------------------------------------------------------------------------

  it("imports rich-text runs (FontRange) into topicRich, keeping the plain topic", () => {
    const { doc } = parseMmap(
      mmapOf(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1">
    <ap:Text PlainText="Hello world">
      <ap:FontRange From="0" To="5" Bold="true" />
      <ap:FontRange From="6" To="11" Color="ffcc0000" />
    </ap:Text>
  </ap:Topic></ap:OneTopic>
</ap:Map>`),
    );
    expect(doc.root.topic).toBe("Hello world");
    expect(doc.root.topicRich).toBe(
      `<strong>Hello</strong> <span style="color: #cc0000">world</span>`,
    );
  });

  it("imports a geometric topic shape (SubTopicShape → style.shape)", () => {
    const { doc } = parseMmap(
      mmapOf(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1"><ap:Text PlainText="Oval one" />
    <ap:SubTopicShape SubTopicShape="urn:mindjet:Oval" />
  </ap:Topic></ap:OneTopic>
</ap:Map>`),
    );
    expect(doc.root.style?.shape).toBe("ellipse");
  });

  it("imports an embedded image from bin/ as a data URL (OneImage → mmarch://)", () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const { doc } = parseMmap(
      zipSync({
        "Document.xml": strToU8(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1"><ap:Text PlainText="Pic" />
    <ap:OneImage><ap:Image>
      <ap:ImageData ImageType="urn:mindjet:PngImage"><ap:Uri>mmarch://bin/img1.bin</ap:Uri></ap:ImageData>
      <ap:ImageSize Width="25.4" Height="25.4" />
    </ap:Image></ap:OneImage>
  </ap:Topic></ap:OneTopic>
</ap:Map>`),
        "bin/img1.bin": bytes,
      }),
    );
    expect(doc.root.image?.url).toBe(`data:image/png;base64,${btoa("\x01\x02\x03\x04\x05")}`);
    expect(doc.root.image?.width).toBe(96); // 25.4mm @96dpi = 96px
    expect(doc.root.image?.height).toBe(96);
  });

  it("skips a vector (EMF) image with no raster fallback, with a warning", () => {
    const { doc, warnings } = parseMmap(
      zipSync({
        "Document.xml": strToU8(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1"><ap:Text PlainText="Vector" />
    <ap:OneImage><ap:Image>
      <ap:ImageData ImageType="urn:mindjet:MetafileImage"><ap:Uri>mmarch://bin/v.bin</ap:Uri></ap:ImageData>
    </ap:Image></ap:OneImage>
  </ap:Topic></ap:OneTopic>
</ap:Map>`),
        "bin/v.bin": new Uint8Array([9, 9]),
      }),
    );
    expect(doc.root.image).toBeUndefined();
    expect(warnings.some((w) => /embedded image was skipped/i.test(w))).toBe(true);
  });

  it("imports an embedded attachment, recovering the real name from @FileName", () => {
    const bytes = new Uint8Array([65, 66, 67]); // "ABC"
    const { doc } = parseMmap(
      zipSync({
        "Document.xml": strToU8(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1"><ap:Text PlainText="Files" />
    <ap:AttachmentGroup>
      <ap:AttachmentData FileName="report.pdf" Type="urn:mindjet:File"><ap:Uri>mmarch://bin/att1.bin</ap:Uri></ap:AttachmentData>
    </ap:AttachmentGroup>
  </ap:Topic></ap:OneTopic>
</ap:Map>`),
        "bin/att1.bin": bytes,
      }),
    );
    expect(doc.root.attachments).toEqual([
      { name: "report.pdf", dataUrl: `data:application/pdf;base64,${btoa("ABC")}`, size: 3 },
    ]);
  });

  it("imports relationship styling (colour / width / dash / arrowheads)", () => {
    const { doc } = parseMmap(
      mmapOf(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1"><ap:Text PlainText="Root" />
    <ap:SubTopics>
      <ap:Topic OId="2"><ap:Text PlainText="A" /></ap:Topic>
      <ap:Topic OId="3"><ap:Text PlainText="B" /></ap:Topic>
    </ap:SubTopics>
  </ap:Topic></ap:OneTopic>
  <ap:Relationships><ap:Relationship>
    <ap:Color LineColor="ffff0000" />
    <ap:LineStyle LineWidth="3" LineDashStyle="urn:mindjet:Dash" />
    <ap:ConnectionGroup><ap:Connection><ap:ObjectReference OIdRef="2" /><ap:DefaultConnectionStyle ConnectionShape="urn:mindjet:NoArrow" /></ap:Connection></ap:ConnectionGroup>
    <ap:ConnectionGroup><ap:Connection><ap:ObjectReference OIdRef="3" /><ap:DefaultConnectionStyle ConnectionShape="urn:mindjet:Arrow" /></ap:Connection></ap:ConnectionGroup>
  </ap:Relationship></ap:Relationships>
</ap:Map>`),
    );
    expect(doc.links).toEqual([
      { id: "r1", from: "2", to: "3", color: "#ff0000", width: 3, dash: "dashed", arrow: "to" },
    ]);
  });

  it("imports boundary styling (colour / shape / dash)", () => {
    const { doc } = parseMmap(
      mmapOf(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1"><ap:Text PlainText="Root" />
    <ap:SubTopics><ap:Topic OId="2"><ap:Text PlainText="Grouped" />
      <ap:OneBoundary><ap:Boundary>
        <ap:Color LineColor="ff00ff00" />
        <ap:LineStyle LineDashStyle="urn:mindjet:Dot" />
        <ap:BoundaryShape BoundaryShape="urn:mindjet:CurvedRectangle" />
      </ap:Boundary></ap:OneBoundary>
    </ap:Topic></ap:SubTopics>
  </ap:Topic></ap:OneTopic>
</ap:Map>`),
    );
    expect(doc.boundaries).toEqual([
      { id: "b1", nodeIds: ["2"], color: "#00ff00", shape: "roundRect", dash: "dotted" },
    ]);
  });

  it("lifts a callout floating-topic onto its parent (not a floating branch)", () => {
    const { doc, warnings } = parseMmap(
      mmapOf(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1"><ap:Text PlainText="Root" />
    <ap:FloatingTopics><ap:Topic OId="7"><ap:Text PlainText="Note bubble" />
      <ap:CalloutFloatingTopicShape />
    </ap:Topic></ap:FloatingTopics>
  </ap:Topic></ap:OneTopic>
</ap:Map>`),
    );
    expect(doc.root.callouts).toEqual([{ id: "c1", text: "Note bubble", dx: 140, dy: 0 }]);
    expect(doc.floatingTopics).toBeUndefined(); // not double-imported as a floating branch
    expect(warnings.some((w) => /outside the central hierarchy/.test(w))).toBe(false);
  });

  it("imports the map background colour (StyleGroup>BackgroundFill)", () => {
    const { doc } = parseMmap(
      mmapOf(`${MAP_OPEN}
  <ap:StyleGroup><ap:BackgroundFill FillColor="ffeeeeee" /></ap:StyleGroup>
  <ap:OneTopic><ap:Topic OId="1"><ap:Text PlainText="Root" /></ap:Topic></ap:OneTopic>
</ap:Map>`),
    );
    expect(doc.meta?.background).toBe("#eeeeee");
  });

  it("generates an id for a topic that has no OId", () => {
    const { doc } = parseMmap(
      mmapOf(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic><ap:Text PlainText="No id here" /></ap:Topic></ap:OneTopic>
</ap:Map>`),
    );
    expect(doc.root.topic).toBe("No id here");
    expect(doc.root.id).toBeTruthy(); // a generated id, not undefined
  });

  it("reads a root <Topic> placed directly under <Map> (no <OneTopic>)", () => {
    const { doc } = parseMmap(
      mmapOf(`${MAP_OPEN}
  <ap:Topic OId="1"><ap:Text PlainText="Direct root" /></ap:Topic>
</ap:Map>`),
    );
    expect(doc.root.topic).toBe("Direct root");
  });

  it("falls back to the @Text attribute for topic text", () => {
    const { doc } = parseMmap(
      mmapOf(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1"><ap:Text Text="Via Text attr" /></ap:Topic></ap:OneTopic>
</ap:Map>`),
    );
    expect(doc.root.topic).toBe("Via Text attr");
  });

  it("tolerates a legacy <Notes><CDATA> note shape", () => {
    const { doc } = parseMmap(
      mmapOf(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1"><ap:Text PlainText="Root" />
    <ap:Notes><ap:CDATA Text="Legacy note text" /></ap:Notes>
  </ap:Topic></ap:OneTopic>
</ap:Map>`),
    );
    expect(doc.root.note).toBe("Legacy note text");
  });

  it("ignores an icon that has no IconType", () => {
    const { doc } = parseMmap(
      mmapOf(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1"><ap:Text PlainText="Root" />
    <ap:IconsGroup><ap:Icons><ap:Icon /></ap:Icons></ap:IconsGroup>
  </ap:Topic></ap:OneTopic>
</ap:Map>`),
    );
    expect(doc.root.icons).toBeUndefined(); // the empty icon is filtered out
  });

  it("imports MindManager stock icons as node.icons", () => {
    const { doc } = parseMmap(
      mmapOf(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1"><ap:Text PlainText="Root" />
    <ap:IconsGroup><ap:Icons>
      <ap:Icon xsi:type="ap:StockIcon" IconType="urn:mindjet:ThumbsUp" />
    </ap:Icons></ap:IconsGroup>
  </ap:Topic></ap:OneTopic>
</ap:Map>`),
    );
    expect(doc.root.icons).toEqual(["👍"]); // urn:mindjet:ThumbsUp -> emoji
  });

  it("imports topic hyperlinks", () => {
    const { doc } = parseMmap(
      mmapOf(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1"><ap:Text PlainText="Root" />
    <ap:Hyperlink Url="https://example.com/" Name="Example" />
  </ap:Topic></ap:OneTopic>
</ap:Map>`),
    );
    expect(doc.root.hyperlink).toBe("https://example.com/");
  });

  it("drops a dangerous-scheme hyperlink on import (XSS guard)", () => {
    // A malicious .mmap could smuggle a javascript:/data: hyperlink; the
    // importer must not store it (defense-in-depth alongside the export sanitiser).
    const { doc } = parseMmap(
      mmapOf(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1"><ap:Text PlainText="Root" />
    <ap:Hyperlink Url="javascript:alert(1)" Name="x" />
  </ap:Topic></ap:OneTopic>
</ap:Map>`),
    );
    expect(doc.root.hyperlink).toBeUndefined();
  });

  it("imports relationships as cross-links", () => {
    const { doc } = parseMmap(
      mmapOf(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1"><ap:Text PlainText="Root" />
    <ap:SubTopics>
      <ap:Topic OId="2"><ap:Text PlainText="A" /></ap:Topic>
      <ap:Topic OId="3"><ap:Text PlainText="B" /></ap:Topic>
    </ap:SubTopics>
  </ap:Topic></ap:OneTopic>
  <ap:Relationships><ap:Relationship>
    <ap:ConnectionGroup><ap:Connection><ap:ObjectReference OIdRef="2" /></ap:Connection></ap:ConnectionGroup>
    <ap:ConnectionGroup><ap:Connection><ap:ObjectReference OIdRef="3" /></ap:Connection></ap:ConnectionGroup>
  </ap:Relationship></ap:Relationships>
</ap:Map>`),
    );
    expect(doc.links).toEqual([{ id: "r1", from: "2", to: "3" }]);
  });

  it("imports a topic boundary over its subtree", () => {
    const { doc } = parseMmap(
      mmapOf(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1"><ap:Text PlainText="Root" />
    <ap:SubTopics>
      <ap:Topic OId="2"><ap:Text PlainText="Grouped" />
        <ap:OneBoundary><ap:Boundary /></ap:OneBoundary>
        <ap:SubTopics><ap:Topic OId="3"><ap:Text PlainText="Leaf" /></ap:Topic></ap:SubTopics>
      </ap:Topic>
    </ap:SubTopics>
  </ap:Topic></ap:OneTopic>
</ap:Map>`),
    );
    expect(doc.boundaries).toHaveLength(1);
    expect(doc.boundaries?.[0].nodeIds).toEqual(["2", "3"]);
  });

  it("imports map-level floating topics and warns they aren't drawn", () => {
    const { doc, warnings } = parseMmap(
      mmapOf(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1"><ap:Text PlainText="Root" /></ap:Topic></ap:OneTopic>
  <ap:FloatingTopics><ap:Topic OId="9"><ap:Text PlainText="Legend" /></ap:Topic></ap:FloatingTopics>
</ap:Map>`),
    );
    expect(doc.floatingTopics?.map((t) => t.topic)).toEqual(["Legend"]);
    // Plural-formed now, not the "topic(s)" hack — one Legend topic, so the singular arm. That `(s)`
    // was exactly the shape a plural message exists to replace: it cannot express a language with
    // more than two forms, and reads as a placeholder in any of them.
    expect(warnings.some((w) => /1 floating topic imported/.test(w))).toBe(true);
  });

  it("warns about topics it cannot reach", () => {
    // A topic buried in a relationship's own FloatingTopics — counted in the
    // source but not part of the importable hierarchy.
    const { warnings } = parseMmap(
      mmapOf(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1"><ap:Text PlainText="Root" /></ap:Topic></ap:OneTopic>
  <ap:Relationships><ap:Relationship>
    <ap:FloatingTopics><ap:Topic OId="9"><ap:Text PlainText="Orphan" /></ap:Topic></ap:FloatingTopics>
  </ap:Relationship></ap:Relationships>
</ap:Map>`),
    );
    expect(warnings.some((w) => /outside the central hierarchy/.test(w))).toBe(true);
  });

  it("throws when Document.xml parses but has no <Map> root element", () => {
    const noMap = `<?xml version="1.0"?><ap:Document xmlns:ap="http://schemas.mindjet.com/MindManager/Application/2003" />`;
    expect(() => parseMmap(mmapOf(noMap))).toThrow(/no <Map> root/);
  });

  it("imports a relationship's label when present", () => {
    const { doc } = parseMmap(
      mmapOf(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1"><ap:Text PlainText="Root" />
    <ap:SubTopics>
      <ap:Topic OId="2"><ap:Text PlainText="A" /></ap:Topic>
      <ap:Topic OId="3"><ap:Text PlainText="B" /></ap:Topic>
    </ap:SubTopics>
  </ap:Topic></ap:OneTopic>
  <ap:Relationships><ap:Relationship>
    <ap:Text PlainText="depends on" />
    <ap:ConnectionGroup><ap:Connection><ap:ObjectReference OIdRef="2" /></ap:Connection></ap:ConnectionGroup>
    <ap:ConnectionGroup><ap:Connection><ap:ObjectReference OIdRef="3" /></ap:Connection></ap:ConnectionGroup>
  </ap:Relationship></ap:Relationships>
</ap:Map>`),
    );
    expect(doc.links).toEqual([{ id: "r1", from: "2", to: "3", label: "depends on" }]);
  });

  it("defaults the map title when the root topic has no text", () => {
    const { doc } = parseMmap(
      mmapOf(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1" /></ap:OneTopic>
</ap:Map>`),
    );
    expect(doc.title).toBe("Imported map");
    expect(doc.root.topic).toBe("");
  });

  // One realistic map exercising every feature at once — the rich features are
  // each covered in isolation above, so this guards that they all decode together.
  // (Confirmed against real feature-rich MindManager exports, owner-validated 2026-06-19.)
  it("imports a map using every feature together", () => {
    const { doc, warnings } = parseMmap(
      mmapOf(`${MAP_OPEN}
  <ap:OneTopic>
    <ap:Topic OId="1">
      <ap:Text PlainText="Company Plan" />
      <ap:NotesGroup><ap:NotesXhtmlData PreviewPlainText="Top-level note" /></ap:NotesGroup>
      <ap:IconsGroup><ap:Icons><ap:Icon xsi:type="ap:StockIcon" IconType="urn:mindjet:Flag" /></ap:Icons></ap:IconsGroup>
      <ap:SubTopics>
        <ap:Topic OId="2">
          <ap:Text PlainText="Strategy" />
          <ap:Hyperlink Url="https://plan.example/" Name="Plan" />
          <ap:OneBoundary><ap:Boundary /></ap:OneBoundary>
          <ap:SubTopics>
            <ap:Topic OId="3"><ap:Text PlainText="Grow EU" />
              <ap:NotesGroup><ap:NotesXhtmlData PreviewPlainText="Expand into EU" /></ap:NotesGroup>
            </ap:Topic>
            <ap:Topic OId="4"><ap:Text PlainText="Cut costs" />
              <ap:IconsGroup><ap:Icons><ap:Icon xsi:type="ap:StockIcon" IconType="urn:mindjet:Priority1" /></ap:Icons></ap:IconsGroup>
            </ap:Topic>
          </ap:SubTopics>
        </ap:Topic>
        <ap:Topic OId="5"><ap:Text PlainText="Ops" /></ap:Topic>
      </ap:SubTopics>
    </ap:Topic>
  </ap:OneTopic>
  <ap:Relationships><ap:Relationship>
    <ap:ConnectionGroup><ap:Connection><ap:ObjectReference OIdRef="3" /></ap:Connection></ap:ConnectionGroup>
    <ap:ConnectionGroup><ap:Connection><ap:ObjectReference OIdRef="5" /></ap:Connection></ap:ConnectionGroup>
  </ap:Relationship></ap:Relationships>
  <ap:FloatingTopics><ap:Topic OId="9"><ap:Text PlainText="Legend" /></ap:Topic></ap:FloatingTopics>
</ap:Map>`),
    );

    // tree + text
    expect(doc.title).toBe("Company Plan");
    expect(doc.root.children.map((c) => c.topic)).toEqual(["Strategy", "Ops"]);
    const strategy = doc.root.children[0];
    expect(strategy.children.map((c) => c.topic)).toEqual(["Grow EU", "Cut costs"]);
    // notes + icons + hyperlink, on the nodes that carry them
    expect(doc.root.note).toBe("Top-level note");
    expect(doc.root.icons).toEqual(["🚩"]); // Flag -> emoji
    expect(strategy.hyperlink).toBe("https://plan.example/");
    expect(strategy.children[0].note).toBe("Expand into EU");
    expect(strategy.children[1].icons).toEqual(["1️⃣"]); // Priority1 -> emoji
    // boundary over Strategy's subtree, relationship as a cross-link, floating topic
    expect(doc.boundaries).toEqual([{ id: "b1", nodeIds: ["2", "3", "4"] }]);
    expect(doc.links).toEqual([{ id: "r1", from: "3", to: "5" }]);
    expect(doc.floatingTopics?.map((t) => t.topic)).toEqual(["Legend"]);
    // floating-topics note surfaced; nothing left behind
    expect(warnings.some((w) => /floating topic/.test(w))).toBe(true);
    expect(warnings.some((w) => /outside the central hierarchy/.test(w))).toBe(false);
    expect(doc.meta?.source).toBe("mmap");
  });
});

// --- writer (toMmap) -------------------------------------------------------------------------------

const docXml = (bytes: Uint8Array): string => strFromU8(unzipSync(bytes)["Document.xml"]);
const findByTopic = (n: MapNode, t: string): MapNode | undefined => {
  if (n.topic === t) return n;
  for (const c of n.children) {
    const hit = findByTopic(c, t);
    if (hit) return hit;
  }
  return undefined;
};

// A feature-rich doc: two-sided mains, a note/hyperlink/icons leaf, a relation, a floating topic.
const richDoc = (): MindMapDoc => ({
  schemaVersion: 1,
  id: "doc1",
  title: "Root",
  root: {
    id: "root",
    topic: "Root",
    children: [
      {
        id: "a",
        topic: "Alpha",
        side: "left",
        note: "a note",
        hyperlink: "https://ok.test/",
        icons: ["🚩", "✅", "📌"],
        collapsed: true,
        children: [{ id: "a1", topic: "Alpha 1", children: [] }],
      },
      { id: "b", topic: "Beta", side: "right", children: [] },
    ],
  },
  links: [{ id: "l1", from: "a", to: "b", label: "rel" }],
  floatingTopics: [{ id: "f1", topic: "Floater", children: [] }],
});

describe("toMmap → parseMmap round-trip", () => {
  it("round-trips tree, text, note, hyperlink, icons, side, links, floating", () => {
    const { doc } = parseMmap(toMmap(richDoc()));
    expect(doc.root.topic).toBe("Root");
    expect(doc.root.children.map((c) => c.topic)).toEqual(["Alpha", "Beta"]);
    const alpha = findByTopic(doc.root, "Alpha") as MapNode;
    expect(alpha.children.map((c) => c.topic)).toEqual(["Alpha 1"]);
    expect(alpha.note).toBe("a note");
    expect(alpha.hyperlink).toBe("https://ok.test/");
    expect(alpha.icons).toEqual(["🚩", "✅"]); // 📌 has no MindManager icon → dropped
    expect(alpha.side).toBe("left");
    expect((findByTopic(doc.root, "Beta") as MapNode).side).toBe("right");
    // Links compared by endpoint topic (ids are re-keyed to OId on import).
    const idOf = (t: string) => findByTopic(doc.root, t)?.id;
    expect(doc.links?.length).toBe(1);
    expect(doc.links?.[0].from).toBe(idOf("Alpha"));
    expect(doc.links?.[0].to).toBe(idOf("Beta"));
    expect(doc.links?.[0].label).toBe("rel");
    expect(doc.floatingTopics?.map((f) => f.topic)).toEqual(["Floater"]);
  });

  it("round-trips tags, task info, and an embedded PNG image (writer fidelity — item 8)", () => {
    // A 1×1 transparent PNG data URL (valid bytes).
    const PNG =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC";
    const doc: MindMapDoc = {
      schemaVersion: 1,
      id: "d",
      title: "Root",
      root: {
        id: "r",
        topic: "Root",
        children: [
          {
            id: "a",
            topic: "Task node",
            tags: ["Marketing", "Q3"],
            task: {
              priority: 7,
              progress: 0.4,
              start: "2026-06-10",
              due: "2026-06-20",
              resources: ["Ada", "Grace"],
            },
            image: { url: PNG, width: 120, height: 90 },
            children: [],
          },
        ],
      },
    };
    const { doc: back } = parseMmap(toMmap(doc));
    const node = findByTopic(back.root, "Task node") as MapNode;
    // Tags
    expect(node.tags).toEqual(["Marketing", "Q3"]);
    // Task info (priority 1–9, progress 0..1, dates as YYYY-MM-DD, resources)
    expect(node.task?.priority).toBe(7);
    expect(node.task?.progress).toBeCloseTo(0.4, 5);
    expect(node.task?.start).toBe("2026-06-10");
    expect(node.task?.due).toBe("2026-06-20");
    expect(node.task?.resources).toEqual(["Ada", "Grace"]);
    // Image: the bin entry resolves back to a data URL, dimensions restored via ImageSize.
    expect(node.image?.url).toMatch(/^data:image\/png;base64,/);
    expect(node.image?.width).toBe(120);
    expect(node.image?.height).toBe(90);
  });
});

describe("toMmap", () => {
  it("is byte-deterministic (no time/randomness)", () => {
    expect(toMmap(richDoc())).toEqual(toMmap(richDoc()));
  });

  it("stays byte-deterministic with tags / task / image (bin entries + mtime pinned)", () => {
    const PNG =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC";
    const build = (): MindMapDoc => ({
      schemaVersion: 1,
      id: "d",
      title: "R",
      root: {
        id: "r",
        topic: "R",
        tags: ["x"],
        task: { due: "2026-01-01" },
        image: { url: PNG, width: 10, height: 10 },
        children: [],
      },
    });
    expect(toMmap(build())).toEqual(toMmap(build()));
  });

  it("escapes user text and drops dangerous hyperlinks", () => {
    const doc: MindMapDoc = {
      schemaVersion: 1,
      id: "d",
      title: "T",
      root: {
        id: "r",
        topic: 'A & B < C > "D" </ap:Text>',
        hyperlink: "javascript:alert(1)",
        children: [],
      },
    };
    const xml = docXml(toMmap(doc));
    expect(xml).toContain("&amp;");
    expect(xml).toContain("&lt;");
    expect(xml).toContain("&quot;");
    expect(xml).not.toContain("javascript:"); // dropped at the boundary
    expect(xml).not.toContain("<ap:Hyperlink");
    const back = parseMmap(toMmap(doc)).doc;
    expect(back.root.topic).toBe('A & B < C > "D" </ap:Text>'); // decodes back exactly
    expect(back.root.hyperlink).toBeUndefined();
  });

  it("maps emoji to canonical IconTypes and omits non-MindManager markers", () => {
    const doc: MindMapDoc = {
      schemaVersion: 1,
      id: "d",
      title: "T",
      root: { id: "r", topic: "R", icons: ["🚩", "✅", "1️⃣", "📌"], children: [] },
    };
    const xml = docXml(toMmap(doc));
    expect(xml).toContain("urn:mindjet:Flag");
    expect(xml).toContain("urn:mindjet:Check");
    expect(xml).toContain("urn:mindjet:Priority1");
    expect(xml).not.toContain("📌");
  });

  it("emits the side offset on depth-1 mains + LeftAndRight, never deeper", () => {
    const doc: MindMapDoc = {
      schemaVersion: 1,
      id: "d",
      title: "T",
      root: {
        id: "r",
        topic: "R",
        children: [
          {
            id: "L",
            topic: "L",
            side: "left",
            children: [{ id: "d1", topic: "Deep", side: "right", children: [] }],
          },
          { id: "R2", topic: "R2", side: "right", children: [] },
        ],
      },
    };
    const xml = docXml(toMmap(doc));
    expect(xml).toContain('CX="-2."'); // left main
    expect(xml).toContain('CX="2."'); // right main
    expect(xml).toContain("urn:mindjet:LeftAndRight");
    // exactly the two mains carry an offset — the depth-2 "Deep" side is ignored
    expect((xml.match(/<ap:Offset /g) ?? []).length).toBe(2);
  });

  it("emits OneBoundary only when a boundary equals a topic's full subtree", () => {
    const doc: MindMapDoc = {
      schemaVersion: 1,
      id: "d",
      title: "T",
      root: {
        id: "r",
        topic: "R",
        children: [
          { id: "s", topic: "Sub", children: [{ id: "s1", topic: "S1", children: [] }] },
          { id: "o", topic: "Other", children: [] },
        ],
      },
      boundaries: [
        { id: "b1", nodeIds: ["s", "s1"] }, // == Sub's subtree → emitted
        { id: "b2", nodeIds: ["s", "o"] }, // arbitrary cross-branch → dropped
      ],
    };
    const xml = docXml(toMmap(doc));
    expect((xml.match(/<ap:OneBoundary/g) ?? []).length).toBe(1);
    expect(parseMmap(toMmap(doc)).doc.boundaries?.length).toBe(1);
  });

  it("normalises CR/CRLF to LF so multi-line text round-trips (no raw CR survives)", () => {
    const doc: MindMapDoc = {
      schemaVersion: 1,
      id: "d",
      title: "T",
      root: { id: "r", topic: "line1\r\nline2", note: "n1\rn2", children: [] },
    };
    expect(docXml(toMmap(doc))).not.toContain("\r");
    const back = parseMmap(toMmap(doc)).doc;
    expect(back.root.topic).toBe("line1\nline2");
    expect(back.root.note).toBe("n1\nn2");
  });

  it("strips XML-illegal control characters so the document stays well-formed", () => {
    const nul = String.fromCharCode(0);
    const bs = String.fromCharCode(8);
    const doc: MindMapDoc = {
      schemaVersion: 1,
      id: "d",
      title: "T",
      root: { id: "r", topic: `a${nul}b`, note: `x${bs}y`, children: [] },
    };
    const xml = docXml(toMmap(doc));
    // no C0 control char survives except TAB / LF (checked by code, not a control-char regex)
    expect(
      [...xml].every((ch) => {
        const c = ch.charCodeAt(0);
        return c >= 0x20 || c === 0x09 || c === 0x0a;
      }),
    ).toBe(true);
    const back = parseMmap(toMmap(doc)).doc;
    expect(back.root.topic).toBe("ab");
    expect(back.root.note).toBe("xy");
  });

  it("never emits a side offset or LeftAndRight inside a floating subtree", () => {
    const doc: MindMapDoc = {
      schemaVersion: 1,
      id: "d",
      title: "T",
      root: { id: "r", topic: "R", children: [] },
      floatingTopics: [
        { id: "f", topic: "F", children: [{ id: "fc", topic: "FC", side: "left", children: [] }] },
      ],
    };
    const xml = docXml(toMmap(doc));
    expect(xml).not.toContain("<ap:Offset");
    expect(xml).not.toContain("LeftAndRight");
  });

  it("gives the map element an OId distinct from every node, even a colliding id", () => {
    const doc: MindMapDoc = {
      schemaVersion: 1,
      id: "d",
      title: "T",
      root: { id: "urn:mindmap-studio:map", topic: "R", children: [] },
    };
    const oids = [...docXml(toMmap(doc)).matchAll(/OId="([^"]+)"/g)].map((m) => m[1]);
    expect(oids[0]).not.toBe(oids[1]); // <ap:Map> vs the root <ap:Topic>
    expect(new Set(oids).size).toBe(oids.length); // all unique
  });
});

function countWith(node: MapNode, pred: (n: MapNode) => boolean): number {
  let n = pred(node) ? 1 : 0;
  for (const child of node.children) n += countWith(child, pred);
  return n;
}

// Opt-in integration check against a REAL MindManager export. CI-safe: it skips
// when MMAP_FILE is unset, so the repo never depends on a personal file. Run it
// locally with:  $env:MMAP_FILE="C:\path\to\file.mmap"; pnpm test
// (The owner ran this against real feature-rich .mmap files on 2026-06-19 — import
// confirmed; CI still skips by default since no real file is committed.)
const realFile = process.env.MMAP_FILE;
describe.skipIf(!realFile)("parseMmap — real .mmap (MMAP_FILE)", () => {
  it("imports the real map and reports what survives vs. is lost", () => {
    const bytes = new Uint8Array(readFileSync(realFile as string));
    const { doc, warnings } = parseMmap(bytes);

    let count = 0;
    let maxDepth = 0;
    const iconTypes = new Set<string>();
    const walk = (node: MapNode, depth: number) => {
      count += 1;
      maxDepth = Math.max(maxDepth, depth);
      for (const icon of node.icons ?? []) iconTypes.add(icon);
      for (const child of node.children) walk(child, depth + 1);
    };
    walk(doc.root, 0);

    const branches = doc.root.children.map(
      (c) => `      - ${c.topic} (${c.children.length} children)`,
    );
    console.log(
      [
        "",
        `  root:        ${doc.root.topic}`,
        `  nodes:       ${count}    max depth: ${maxDepth}`,
        `  notes:       ${countWith(doc.root, (n) => !!n.note)}`,
        `  hyperlinks:  ${countWith(doc.root, (n) => !!n.hyperlink)}`,
        `  icons:       ${countWith(doc.root, (n) => !!n.icons?.length)} node(s); types: ${[...iconTypes].join(", ") || "none"}`,
        `  links:       ${doc.links?.length ?? 0}`,
        `  boundaries:  ${doc.boundaries?.length ?? 0}`,
        `  floating:    ${doc.floatingTopics?.length ?? 0}`,
        `  warnings:    ${warnings.length}`,
        ...warnings.slice(0, 12).map((w) => `      ! ${w}`),
        "  top-level branches:",
        ...branches,
        "",
      ].join("\n"),
    );

    expect(doc.root.topic.length).toBeGreaterThan(0);
    expect(count).toBeGreaterThan(1);
  });
});

// Re-emit a REAL map and re-import it: proves the writer faithfully re-encodes a real-origin doc
// (a stronger check than synthetic round-trips). CI-safe — skips without MMAP_FILE.
describe.skipIf(!realFile)("toMmap — real .mmap re-emit (MMAP_FILE)", () => {
  it("re-emits a real-origin map that re-imports with the same shape", () => {
    const first = parseMmap(new Uint8Array(readFileSync(realFile as string))).doc;
    const second = parseMmap(toMmap(first)).doc;
    const count = (n: MapNode): number => 1 + n.children.reduce((s, c) => s + count(c), 0);
    expect(count(second.root)).toBe(count(first.root));
    expect(second.root.topic).toBe(first.root.topic);
    expect(second.root.children.map((c) => c.topic)).toEqual(
      first.root.children.map((c) => c.topic),
    );
  });
});

// Real-export robustness: branches the happy-path image/attachment fixtures above don't exercise but a
// genuine multi-feature .mmap will hit — the case/basename-tolerant bin resolver, ImageSize capping,
// the vector→raster AlternateImageData fallback, IconImage, and attachment Folder/missing-bin skips,
// plus a combined realistic archive. Stands in (deterministically, in CI) for the not-committed real
// sample the backlog wanted: it confirms the mmarch://bin resolution + ImageSize mapping end-to-end.
describe("parseMmap — real-export robustness (bin resolution + ImageSize)", () => {
  // A genuine 1×1 transparent PNG, so the resolved data URL is a real, renderable image (not stub bytes).
  const PNG = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ]);
  const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
  const pngDataUrl = `data:image/png;base64,${b64(PNG)}`;
  const imageTopic = (uri: string, size = "") =>
    `${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1"><ap:Text PlainText="Pic" />
    <ap:OneImage><ap:Image>
      <ap:ImageData ImageType="urn:mindjet:PngImage"><ap:Uri>${uri}</ap:Uri></ap:ImageData>
      ${size}
    </ap:Image></ap:OneImage>
  </ap:Topic></ap:OneTopic>
</ap:Map>`;

  it("resolves a bin URI tolerant of scheme case, leading slashes, and path case", () => {
    const { doc } = parseMmap(
      zipSync({
        "Document.xml": strToU8(imageTopic("MMARCH:///bin/IMG1.BIN")),
        "bin/img1.bin": PNG, // archive entry differs in case from the reference
      }),
    );
    expect(doc.root.image?.url).toBe(pngDataUrl);
  });

  it("resolves a bin URI by basename when the archive stores it under a different folder", () => {
    const { doc } = parseMmap(
      zipSync({
        "Document.xml": strToU8(imageTopic("mmarch://bin/photo.bin")),
        "attachments/photo.bin": PNG, // different folder, same basename
      }),
    );
    expect(doc.root.image?.url).toBe(pngDataUrl);
  });

  it("caps a large ImageSize to the 280px display max, preserving aspect ratio", () => {
    const { doc } = parseMmap(
      zipSync({
        "Document.xml": strToU8(
          imageTopic("mmarch://bin/big.bin", '<ap:ImageSize Width="200" Height="100" />'),
        ),
        "bin/big.bin": PNG,
      }),
    );
    // 200mm @96dpi ≈ 756px → capped to 280; height scales 100→140 to keep the 2:1 ratio.
    expect(doc.root.image?.width).toBe(280);
    expect(doc.root.image?.height).toBe(140);
  });

  it("falls back to a raster AlternateImageData when the primary is a vector (Metafile)", () => {
    const { doc, warnings } = parseMmap(
      zipSync({
        "Document.xml": strToU8(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1"><ap:Text PlainText="Vec+raster" />
    <ap:OneImage><ap:Image>
      <ap:ImageData ImageType="urn:mindjet:MetafileImage"><ap:Uri>mmarch://bin/v.bin</ap:Uri></ap:ImageData>
      <ap:AlternateImageData ImageType="urn:mindjet:PngImage"><ap:Uri>mmarch://bin/alt.bin</ap:Uri></ap:AlternateImageData>
    </ap:Image></ap:OneImage>
  </ap:Topic></ap:OneTopic>
</ap:Map>`),
        "bin/v.bin": new Uint8Array([1, 2]),
        "bin/alt.bin": PNG,
      }),
    );
    expect(doc.root.image?.url).toBe(pngDataUrl); // used the raster fallback, not the vector primary
    expect(warnings.some((w) => /embedded image was skipped/i.test(w))).toBe(false);
  });

  it("imports an IconImage as a PNG data URL", () => {
    const { doc } = parseMmap(
      zipSync({
        "Document.xml": strToU8(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1"><ap:Text PlainText="Icon" />
    <ap:OneImage><ap:Image>
      <ap:ImageData ImageType="urn:mindjet:IconImage"><ap:Uri>mmarch://bin/icon.bin</ap:Uri></ap:ImageData>
    </ap:Image></ap:OneImage>
  </ap:Topic></ap:OneTopic>
</ap:Map>`),
        "bin/icon.bin": PNG,
      }),
    );
    expect(doc.root.image?.url).toBe(pngDataUrl);
  });

  it("skips a Folder attachment and one whose bytes are missing, keeping the real file", () => {
    const { doc } = parseMmap(
      zipSync({
        "Document.xml": strToU8(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1"><ap:Text PlainText="Files" />
    <ap:AttachmentGroup>
      <ap:AttachmentData FileName="folder" Type="urn:mindjet:Folder"><ap:Uri>mmarch://bin/folder.bin</ap:Uri></ap:AttachmentData>
      <ap:AttachmentData FileName="ghost.pdf" Type="urn:mindjet:File"><ap:Uri>mmarch://bin/missing.bin</ap:Uri></ap:AttachmentData>
      <ap:AttachmentData FileName="real.txt" Type="urn:mindjet:File"><ap:Uri>mmarch://bin/real.bin</ap:Uri></ap:AttachmentData>
    </ap:AttachmentGroup>
  </ap:Topic></ap:OneTopic>
</ap:Map>`),
        "bin/folder.bin": new Uint8Array([0]),
        "bin/real.bin": new Uint8Array([72, 105]), // "Hi"
      }),
    );
    expect(doc.root.attachments).toEqual([
      { name: "real.txt", dataUrl: `data:text/plain;base64,${btoa("Hi")}`, size: 2 },
    ]);
  });

  it("imports a realistic multi-feature archive (tree + image + attachment + note + tags) in one pass", () => {
    const { doc, warnings } = parseMmap(
      zipSync({
        "Document.xml": strToU8(`${MAP_OPEN}
  <ap:OneTopic><ap:Topic OId="1"><ap:Text PlainText="Launch" />
    <ap:SubTopics>
      <ap:Topic OId="2"><ap:Text PlainText="Brand" />
        <ap:OneImage><ap:Image>
          <ap:ImageData ImageType="urn:mindjet:PngImage"><ap:Uri>mmarch://bin/logo.bin</ap:Uri></ap:ImageData>
          <ap:ImageSize Width="25.4" Height="25.4" />
        </ap:Image></ap:OneImage>
      </ap:Topic>
      <ap:Topic OId="3"><ap:Text PlainText="Docs" />
        <ap:NotesGroup><ap:NotesXhtmlData PreviewPlainText="see brief" /></ap:NotesGroup>
        <ap:AttachmentGroup>
          <ap:AttachmentData FileName="brief.pdf" Type="urn:mindjet:File"><ap:Uri>mmarch://bin/brief.bin</ap:Uri></ap:AttachmentData>
        </ap:AttachmentGroup>
        <ap:TextLabels><ap:TextLabel TextLabelName="q3" /></ap:TextLabels>
      </ap:Topic>
    </ap:SubTopics>
  </ap:Topic></ap:OneTopic>
</ap:Map>`),
        "bin/logo.bin": PNG,
        "bin/brief.bin": new Uint8Array([37, 80, 68, 70]), // "%PDF"
      }),
    );
    expect(doc.root.topic).toBe("Launch");
    const [brand, docs] = doc.root.children;
    expect(brand.image?.url).toBe(pngDataUrl);
    expect(brand.image?.width).toBe(96); // 25.4mm @96dpi
    expect(docs.attachments?.[0]).toMatchObject({ name: "brief.pdf", size: 4 });
    expect(docs.note).toBe("see brief");
    expect(docs.tags).toEqual(["q3"]);
    expect(warnings).toEqual([]); // a clean, fully-imported multi-feature map logs nothing lost
  });
});
