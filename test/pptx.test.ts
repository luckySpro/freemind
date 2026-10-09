import { XMLValidator } from "fast-xml-parser";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { type BranchImage, buildPptx } from "../src/io/pptx";
import type { MindMapDoc } from "../src/model/types";

const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "Plan",
  root: {
    id: "r",
    topic: "Plan",
    children: [
      { id: "a", topic: "Alpha", children: [{ id: "a1", topic: "Alpha One", children: [] }] },
      { id: "b", topic: "Beta", children: [] },
    ],
  },
};

function open(d: MindMapDoc) {
  const files = unzipSync(buildPptx(d));
  return { files, names: Object.keys(files), text: (name: string) => strFromU8(files[name]) };
}

const SLIDE_RE = /^ppt\/slides\/slide\d+\.xml$/;

describe("buildPptx", () => {
  it("emits an overview slide plus one slide per top-level branch", () => {
    const slides = open(doc).names.filter((n) => SLIDE_RE.test(n));
    expect(slides).toHaveLength(3); // overview + Alpha + Beta
  });

  it("packages the required OPC parts, with a .rels for each slide", () => {
    const { names } = open(doc);
    for (const required of [
      "[Content_Types].xml",
      "_rels/.rels",
      "ppt/presentation.xml",
      "ppt/_rels/presentation.xml.rels",
      "ppt/theme/theme1.xml",
      "ppt/slideMasters/slideMaster1.xml",
      "ppt/slideMasters/_rels/slideMaster1.xml.rels",
      "ppt/slideLayouts/slideLayout1.xml",
      "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
      "ppt/slides/slide1.xml",
      "ppt/slides/_rels/slide1.xml.rels",
    ]) {
      expect(names).toContain(required);
    }
  });

  it("emits well-formed XML for every part", () => {
    const { files } = open(doc);
    for (const name of Object.keys(files)) {
      expect(XMLValidator.validate(strFromU8(files[name]))).toBe(true);
    }
  });

  it("declares a content-type override for every part PowerPoint needs", () => {
    const { names, text } = open(doc);
    const ct = text("[Content_Types].xml");
    expect(ct).toContain("/ppt/presentation.xml");
    expect(ct).toContain("/ppt/slideMasters/slideMaster1.xml");
    expect(ct).toContain("/ppt/slideLayouts/slideLayout1.xml");
    expect(ct).toContain("/ppt/theme/theme1.xml");
    for (const slide of names.filter((n) => SLIDE_RE.test(n))) {
      expect(ct).toContain(`/${slide}`);
    }
  });

  it("resolves every r:id in presentation.xml against its .rels (no dangling refs)", () => {
    const { text } = open(doc);
    const referenced = [...text("ppt/presentation.xml").matchAll(/r:id="(rId\d+)"/g)].map(
      (m) => m[1],
    );
    const defined = new Set(
      [...text("ppt/_rels/presentation.xml.rels").matchAll(/Id="(rId\d+)"/g)].map((m) => m[1]),
    );
    expect(referenced.length).toBeGreaterThan(0);
    for (const id of referenced) expect(defined.has(id)).toBe(true);
  });

  it("wires each slide's .rels to the shared layout, and the master to layout + theme", () => {
    const { text } = open(doc);
    expect(text("ppt/slides/_rels/slide1.xml.rels")).toContain("slideLayouts/slideLayout1.xml");
    const masterRels = text("ppt/slideMasters/_rels/slideMaster1.xml.rels");
    expect(masterRels).toContain("slideLayouts/slideLayout1.xml");
    expect(masterRels).toContain("theme/theme1.xml");
  });

  it("lists the branches on the overview and the subtree on a branch slide", () => {
    const { text } = open(doc);
    expect(text("ppt/slides/slide1.xml")).toContain("Alpha");
    expect(text("ppt/slides/slide1.xml")).toContain("Beta");
    expect(text("ppt/slides/slide2.xml")).toContain("Alpha One");
  });

  it("escapes XML metacharacters in topics", () => {
    const evil: MindMapDoc = {
      schemaVersion: 1,
      id: "e",
      title: "T",
      root: { id: "r", topic: "T", children: [{ id: "x", topic: "A & B <c>", children: [] }] },
    };
    const xml = strFromU8(unzipSync(buildPptx(evil))["ppt/slides/slide1.xml"]);
    expect(xml).toContain("A &amp; B &lt;c&gt;");
    expect(xml).not.toContain("<c>");
  });

  it("is deterministic — the same map produces identical bytes", () => {
    expect(Buffer.from(buildPptx(doc)).equals(Buffer.from(buildPptx(doc)))).toBe(true);
  });

  it("emits a notes slide with the speaker note only for slides that have one (B5)", () => {
    const withNotes: MindMapDoc = {
      ...doc,
      root: {
        ...doc.root,
        children: [
          { id: "a", topic: "Alpha", note: "Say hello\nSecond line", children: [] },
          { id: "b", topic: "Beta", children: [] }, // no note
        ],
      },
    };
    // Slides: overview(1), Alpha(2), Beta(3). Only Alpha carries a note → notesSlide2.
    const { names, text } = open(withNotes);
    expect(names).toContain("ppt/notesSlides/notesSlide2.xml");
    expect(names).not.toContain("ppt/notesSlides/notesSlide1.xml"); // overview has no note
    expect(names).not.toContain("ppt/notesSlides/notesSlide3.xml"); // Beta has no note

    const notesXml = text("ppt/notesSlides/notesSlide2.xml");
    expect(XMLValidator.validate(notesXml)).toBe(true);
    expect(notesXml).toContain("Say hello");
    expect(notesXml).toContain("Second line"); // multi-line note → one paragraph per line

    // The part is declared + the slide's rels point at it + its rels point back.
    expect(text("[Content_Types].xml")).toContain("/ppt/notesSlides/notesSlide2.xml");
    expect(text("ppt/slides/_rels/slide2.xml.rels")).toContain("notesSlides/notesSlide2.xml");
    expect(text("ppt/notesSlides/_rels/notesSlide2.xml.rels")).toContain("slides/slide2.xml");
  });

  it("uses a custom deck's per-slide note override in the PPTX notes (B5)", () => {
    const custom: MindMapDoc = {
      ...doc,
      root: {
        ...doc.root,
        children: [{ id: "a", topic: "Alpha", note: "topic note", children: [] }],
      },
      meta: { slides: [{ nodeId: "a", note: "override note" }] },
    };
    // A custom deck of one slide (Alpha) → notesSlide1.
    const notesXml = open(custom).text("ppt/notesSlides/notesSlide1.xml");
    expect(notesXml).toContain("override note");
    expect(notesXml).not.toContain("topic note");
  });

  describe("live-map slides — embedded branch images (item 1)", () => {
    // Fake PNG media: buildPptx trusts the passed pixel size (used only for the aspect-fit), so the
    // bytes need not be a real image for the packaging assertions.
    const img = (w: number, h: number): BranchImage => ({
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]),
      width: w,
      height: h,
    });
    // Slides are overview("overview"), Alpha("a"), Beta("b"); give the first two an image, leave Beta out.
    const images = new Map<string, BranchImage>([
      ["overview", img(1600, 900)],
      ["a", img(1200, 1600)],
    ]);
    const openImg = () => {
      const files = unzipSync(buildPptx(doc, images));
      return { files, names: Object.keys(files), text: (n: string) => strFromU8(files[n]) };
    };

    it("packs a media part + slide image rel for each imaged slide, and none for the rest", () => {
      const { names, text } = openImg();
      expect(names).toContain("ppt/media/image1.png"); // overview
      expect(names).toContain("ppt/media/image2.png"); // Alpha
      expect(names).not.toContain("ppt/media/image3.png"); // Beta → bullets
      expect(text("ppt/slides/_rels/slide1.xml.rels")).toContain("../media/image1.png");
      expect(text("ppt/slides/_rels/slide2.xml.rels")).toContain("../media/image2.png");
      expect(text("ppt/slides/_rels/slide3.xml.rels")).not.toContain("media/");
    });

    it("declares the PNG default content type only when images are embedded", () => {
      expect(openImg().text("[Content_Types].xml")).toContain('Extension="png"');
      // The image-less deck must not carry the png default.
      const plain = strFromU8(unzipSync(buildPptx(doc))["[Content_Types].xml"]);
      expect(plain).not.toContain('Extension="png"');
    });

    it("renders a picture (not bullets) on an imaged slide, and bullets on a bare one", () => {
      const { text } = openImg();
      const s1 = text("ppt/slides/slide1.xml");
      expect(s1).toContain("<p:pic>");
      expect(s1).toContain('r:embed="rId3"');
      expect(s1).not.toContain("<a:buChar"); // no bullet outline on a live-map slide
      // Beta (no image) still lists its bullets.
      expect(text("ppt/slides/slide3.xml")).not.toContain("<p:pic>");
    });

    it("resolves the picture's rId3 embed against the slide rels (no dangling ref)", () => {
      const { text } = openImg();
      expect(text("ppt/slides/_rels/slide1.xml.rels")).toContain('Id="rId3"');
    });

    it("keeps every XML part well-formed with images embedded", () => {
      const { files } = openImg();
      for (const name of Object.keys(files)) {
        if (name.endsWith(".png")) continue; // binary media, not XML
        expect(XMLValidator.validate(strFromU8(files[name]))).toBe(true);
      }
    });

    it("aspect-fits the picture within the body region (portrait image is not stretched wide)", () => {
      // Alpha's image is portrait (1200×1600). Its ext cx must be < the full content width, and the
      // cx:cy ratio must match the source (no distortion). Scope to the <p:pic> so the group/title
      // <a:ext> don't match first.
      const s2 = openImg().text("ppt/slides/slide2.xml");
      const pic = s2.slice(s2.indexOf("<p:pic>"));
      const m = pic.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
      expect(m).toBeTruthy();
      const cx = Number(m?.[1]);
      const cy = Number(m?.[2]);
      expect(cx / cy).toBeCloseTo(1200 / 1600, 2);
      expect(cx).toBeLessThan(12192000 - 2 * 685800); // < CONTENT_W
    });

    it("is deterministic with images — the same input produces identical bytes", () => {
      expect(Buffer.from(buildPptx(doc, images)).equals(Buffer.from(buildPptx(doc, images)))).toBe(
        true,
      );
    });
  });
});
