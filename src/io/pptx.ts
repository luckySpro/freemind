// PowerPoint (.pptx) export: the Walk-Through as a real slide deck — an overview
// slide, then one slide per top-level branch with its subtree as bullets.
//
// A .pptx is an Open Packaging Conventions ZIP of PresentationML/DrawingML parts.
// PowerPoint requires a complete, cross-referenced package — a presentation, a
// slide master, at least one slide layout, a theme, and one part per slide, each
// wired through its own .rels — so this emits that full minimal set. Slides use
// plain positioned text boxes (not placeholders), so they're self-describing and
// don't depend on the master/layout for content.
//
// Pure + deterministic (entry mtimes pinned); only escaped topic text is
// interpolated. Reuses the same slide model the in-app presentation renders.

import { getLocale } from "../i18n/registry";
import type { MapNode, MindMapDoc } from "../model/types";
import { resolveSlides, slideKey } from "../present/slides";
import { escapeXml, zipOoxml } from "./ooxml";

/** A rendered branch image for a live-map slide (item 1): the PNG bytes plus its natural pixel size,
 *  used to place the picture aspect-fitted inside the slide body region. */
export interface BranchImage {
  bytes: Uint8Array;
  width: number;
  height: number;
}

const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG = "http://schemas.openxmlformats.org/package/2006/relationships";

const REL_OFFICEDOC = `${R}/officeDocument`;
const REL_MASTER = `${R}/slideMaster`;
const REL_LAYOUT = `${R}/slideLayout`;
const REL_SLIDE = `${R}/slide`;
const REL_THEME = `${R}/theme`;
const REL_NOTESSLIDE = `${R}/notesSlide`;
const REL_IMAGE = `${R}/image`;

const CT_PRESENTATION =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml";
const CT_MASTER = "application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml";
const CT_LAYOUT = "application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml";
const CT_SLIDE = "application/vnd.openxmlformats-officedocument.presentationml.slide+xml";
const CT_NOTES = "application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml";
const CT_THEME = "application/vnd.openxmlformats-officedocument.theme+xml";

// Geometry in EMU (914400 per inch). 16:9 slide.
const SLIDE_W = 12192000;
const SLIDE_H = 6858000;
const MARGIN = 685800;
const CONTENT_W = SLIDE_W - 2 * MARGIN;
const TITLE_Y = 381000;
const TITLE_H = 1143000;
const BODY_Y = 1600200;
const BODY_H = SLIDE_H - BODY_Y - 381000;
const MAX_LVL = 8; // PresentationML caps outline levels at 0..8

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

interface BodyLine {
  text: string;
  level: number;
}

function collectBody(slide: { isOverview: boolean; node: MapNode }, doc: MindMapDoc): BodyLine[] {
  const out: BodyLine[] = [];
  if (slide.isOverview) {
    for (const child of doc.root.children) out.push({ text: child.topic, level: 0 });
    return out;
  }
  const walk = (nodes: MapNode[], level: number) => {
    for (const node of nodes) {
      out.push({ text: node.topic, level: Math.min(level, MAX_LVL) });
      walk(node.children, level + 1);
    }
  };
  walk(slide.node.children, 0);
  return out;
}

function titlePara(title: string): string {
  return `<a:p><a:r><a:rPr lang="${getLocale()}" sz="4000" b="1"><a:solidFill><a:srgbClr val="1F1B4D"/></a:solidFill></a:rPr><a:t>${escapeXml(title)}</a:t></a:r></a:p>`;
}

function bodyPara(line: BodyLine): string {
  const sz = Math.max(1400, 2000 - line.level * 200);
  const marL = 285750 * (line.level + 1);
  return `<a:p><a:pPr lvl="${line.level}" marL="${marL}" indent="-285750"><a:buFont typeface="Arial"/><a:buChar char="•"/></a:pPr><a:r><a:rPr lang="${getLocale()}" sz="${sz}"><a:solidFill><a:srgbClr val="333333"/></a:solidFill></a:rPr><a:t>${escapeXml(line.text)}</a:t></a:r></a:p>`;
}

function textBox(
  id: number,
  name: string,
  x: number,
  y: number,
  cx: number,
  cy: number,
  paras: string,
  autofit = false,
): string {
  const bodyPr = autofit ? "<a:bodyPr><a:normAutofit/></a:bodyPr>" : "<a:bodyPr/>";
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody>${bodyPr}<a:lstStyle/>${paras}</p:txBody></p:sp>`;
}

// Aspect-fit an image of natural size (imgW×imgH px) inside the slide body region, centred. Returns
// the DrawingML xfrm in EMU. Guards against a zero/undefined natural size (fills the box).
function fitBody(imgW: number, imgH: number): { x: number; y: number; cx: number; cy: number } {
  const w = imgW > 0 ? imgW : CONTENT_W;
  const h = imgH > 0 ? imgH : BODY_H;
  const scale = Math.min(CONTENT_W / w, BODY_H / h);
  const cx = Math.round(w * scale);
  const cy = Math.round(h * scale);
  return {
    x: MARGIN + Math.round((CONTENT_W - cx) / 2),
    y: BODY_Y + Math.round((BODY_H - cy) / 2),
    cx,
    cy,
  };
}

// A picture shape filling the body region with the branch's rendered map (item 1). `embed` is the
// slide-rels relationship id (rId3) pointing at the media part; aspect ratio is locked.
function pictureSp(embed: string, img: BranchImage): string {
  const { x, y, cx, cy } = fitBody(img.width, img.height);
  return `<p:pic><p:nvPicPr><p:cNvPr id="3" name="Branch map"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${embed}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}

// A slide: the title text box plus EITHER a branch map picture (live-map slide) or the bullet outline.
function slideXml(title: string, body: BodyLine[], img?: BranchImage): string {
  const titleSp = textBox(2, "Title", MARGIN, TITLE_Y, CONTENT_W, TITLE_H, titlePara(title));
  const content = img
    ? pictureSp("rId3", img)
    : body.length
      ? textBox(3, "Content", MARGIN, BODY_Y, CONTENT_W, BODY_H, body.map(bodyPara).join(""), true)
      : "";
  return `${XML_DECL}<p:sld xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${titleSp}${content}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

// Speaker-notes slide (B5). PowerPoint stores notes as separate parts referenced from the slide. Notes
// are plain text in PresentationML, so a Markdown note is emitted line-by-line (each non-blank line a
// paragraph) rather than rendered — the text content is preserved, formatting is not.
function notesParas(note: string): string {
  const lines = note.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return "<a:p/>";
  return lines
    .map(
      (line) => `<a:p><a:r><a:rPr lang="${getLocale()}"/><a:t>${escapeXml(line)}</a:t></a:r></a:p>`,
    )
    .join("");
}

function notesSlideXml(note: string): string {
  // A body placeholder (type="body" idx="1") holds the notes text — the minimal shape PowerPoint reads.
  const body = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes Placeholder"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${notesParas(note)}</p:txBody></p:sp>`;
  return `${XML_DECL}<p:notes xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${body}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`;
}

// A notes slide's rels point back at its parent slide.
function notesSlideRels(slideIndex: number): string {
  return `${XML_DECL}<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${REL_SLIDE}" Target="../slides/slide${slideIndex}.xml"/></Relationships>`;
}

const THEME = `${XML_DECL}<a:theme xmlns:a="${A}" name="Office Theme"><a:themeElements><a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Office"><a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;

const EMPTY_SPTREE = `<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree>`;

const MASTER = `${XML_DECL}<p:sldMaster xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}"><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>${EMPTY_SPTREE}</p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`;

const LAYOUT = `${XML_DECL}<p:sldLayout xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}" type="blank" preserve="1"><p:cSld name="Blank">${EMPTY_SPTREE}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;

const ROOT_RELS = `${XML_DECL}<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${REL_OFFICEDOC}" Target="ppt/presentation.xml"/></Relationships>`;

const MASTER_RELS = `${XML_DECL}<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${REL_LAYOUT}" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="${REL_THEME}" Target="../theme/theme1.xml"/></Relationships>`;

const LAYOUT_RELS = `${XML_DECL}<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${REL_MASTER}" Target="../slideMasters/slideMaster1.xml"/></Relationships>`;

// A slide's rels: always the layout (rId1); its notes slide when it has one (rId2, B5); and its branch
// map image when it's a live-map slide (rId3 → media/imageN.png, item 1). rIds are fixed by role so the
// slide XML can reference the picture embed (rId3) without threading the id through.
function slideRelsXml(slideIndex: number, hasNotes: boolean, hasImage: boolean): string {
  const notes = hasNotes
    ? `<Relationship Id="rId2" Type="${REL_NOTESSLIDE}" Target="../notesSlides/notesSlide${slideIndex}.xml"/>`
    : "";
  const image = hasImage
    ? `<Relationship Id="rId3" Type="${REL_IMAGE}" Target="../media/image${slideIndex}.png"/>`
    : "";
  return `${XML_DECL}<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${REL_LAYOUT}" Target="../slideLayouts/slideLayout1.xml"/>${notes}${image}</Relationships>`;
}

// `notesIndices` are the 1-based slide indices that carry a notes slide (so their parts get declared).
// `hasImages` adds the PNG default content type so embedded branch-map media resolve (item 1).
function contentTypesXml(slideCount: number, notesIndices: number[], hasImages: boolean): string {
  const slides = Array.from(
    { length: slideCount },
    (_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="${CT_SLIDE}"/>`,
  ).join("");
  const notes = notesIndices
    .map(
      (i) => `<Override PartName="/ppt/notesSlides/notesSlide${i}.xml" ContentType="${CT_NOTES}"/>`,
    )
    .join("");
  const png = hasImages ? `<Default Extension="png" ContentType="image/png"/>` : "";
  return `${XML_DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${png}<Override PartName="/ppt/presentation.xml" ContentType="${CT_PRESENTATION}"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="${CT_MASTER}"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="${CT_LAYOUT}"/><Override PartName="/ppt/theme/theme1.xml" ContentType="${CT_THEME}"/>${slides}${notes}</Types>`;
}

function presentationXml(slideCount: number): string {
  const sldIds = Array.from(
    { length: slideCount },
    (_, i) => `<p:sldId id="${256 + i}" r:id="rId${2 + i}"/>`,
  ).join("");
  return `${XML_DECL}<p:presentation xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${sldIds}</p:sldIdLst><p:sldSz cx="${SLIDE_W}" cy="${SLIDE_H}" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;
}

function presentationRelsXml(slideCount: number): string {
  const slides = Array.from(
    { length: slideCount },
    (_, i) =>
      `<Relationship Id="rId${2 + i}" Type="${REL_SLIDE}" Target="slides/slide${i + 1}.xml"/>`,
  ).join("");
  return `${XML_DECL}<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${REL_MASTER}" Target="slideMasters/slideMaster1.xml"/>${slides}</Relationships>`;
}

/**
 * The PowerPoint deck. When `branchImages` is supplied (item 1) — a map from each slide's `slideKey`
 * to its rendered branch map PNG (bytes + natural size) — those slides show the map picture instead of
 * the bullet outline, matching the HTML deck's live-map slides. Absent (no live canvas at export time)
 * ⇒ the classic bullet deck, unchanged and deterministic. A slide with no entry falls back to bullets.
 */
export function buildPptx(doc: MindMapDoc, branchImages?: Map<string, BranchImage>): Uint8Array {
  // resolveSlides (not presentationSlides) so a custom deck AND its per-slide speaker notes carry over,
  // matching the HTML deck + presenter view. Each slide's note = the SlideRef override, else the node's.
  const slides = resolveSlides(doc);
  const notes = slides.map((s) => (s.note ?? s.node.note ?? "").trim());
  const notesIndices = notes.map((n, i) => (n ? i + 1 : 0)).filter((i) => i > 0);
  const images = slides.map((s) => branchImages?.get(slideKey(s)));
  const hasImages = images.some(Boolean);
  const parts: Record<string, string | Uint8Array> = {
    "[Content_Types].xml": contentTypesXml(slides.length, notesIndices, hasImages),
    "_rels/.rels": ROOT_RELS,
    "ppt/presentation.xml": presentationXml(slides.length),
    "ppt/_rels/presentation.xml.rels": presentationRelsXml(slides.length),
    "ppt/theme/theme1.xml": THEME,
    "ppt/slideMasters/slideMaster1.xml": MASTER,
    "ppt/slideMasters/_rels/slideMaster1.xml.rels": MASTER_RELS,
    "ppt/slideLayouts/slideLayout1.xml": LAYOUT,
    "ppt/slideLayouts/_rels/slideLayout1.xml.rels": LAYOUT_RELS,
  };
  slides.forEach((slide, i) => {
    const n = i + 1;
    const hasNote = notes[i].length > 0;
    const img = images[i];
    parts[`ppt/slides/slide${n}.xml`] = slideXml(slide.heading, collectBody(slide, doc), img);
    parts[`ppt/slides/_rels/slide${n}.xml.rels`] = slideRelsXml(n, hasNote, !!img);
    if (hasNote) {
      parts[`ppt/notesSlides/notesSlide${n}.xml`] = notesSlideXml(notes[i]);
      parts[`ppt/notesSlides/_rels/notesSlide${n}.xml.rels`] = notesSlideRels(n);
    }
    if (img) parts[`ppt/media/image${n}.png`] = img.bytes;
  });
  return zipOoxml(parts);
}
