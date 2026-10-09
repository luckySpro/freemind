import { t } from "../i18n/registry";
import "../io/messages";
import { XMLParser } from "fast-xml-parser";
import { strFromU8, unzipSync } from "fflate";
import { mindManagerIconToEmoji } from "../icons";
import { isDangerousUrl } from "../io/urlSafety";
import type {
  Boundary,
  Callout,
  CrossLink,
  MapAttachment,
  MapImage,
  MapNode,
  MindMapDoc,
  NodeId,
  NodeShape,
  NodeStyle,
  TaskInfo,
} from "../model/types";

// MindManager .mmap importer (one-way).
//
// A .mmap is a ZIP archive whose map lives in `Document.xml`, namespace
// http://schemas.mindjet.com/MindManager/Application/2003. The field shapes
// below are taken from the bundled XSD schemas, so they are authoritative
// (not guessed), and the text/structure import is confirmed against real
// feature-rich MindManager exports (owner-validated 2026-06-19). The importer
// is defensive: it recovers everything it understands, warns about what it
// deliberately drops, and throws a useful error when handed something that is
// not a MindManager map.
//
// Imported: topic tree + text (Text@PlainText), rich-text runs (Text>FontRange →
// topicRich), notes (full NotesXhtmlData XHTML body, falling back to
// @PreviewPlainText), stock icons (Icon@IconType), user tags
// (TextLabels>TextLabel@TextLabelName), per-topic colour/font/shape (Topic>Color,
// Text>Font, SubTopicShape), task info (Task@StartDate/@DeadlineDate/
// @TaskPriority/@TaskPercentage/@Resources), embedded images
// (OneImage>…>cor:Uri mmarch://bin/) and attachments (AttachmentGroup>…>cor:Uri),
// hyperlinks (Hyperlink@Url), relationships + their styling (colour/width/dash/
// arrowheads), boundaries + their styling (colour/shape/dash), callouts
// (FloatingTopics w/ CalloutFloatingTopicShape), the map background colour
// (StyleGroup>BackgroundFill), floating topics, and each main branch's two-sided
// side (Offset@CX sign, depth-1 only).
//
// Still dropped (no model home / out of scope, by design): theme-only styling
// (topics with no explicit attributes inherit the StyleGroup theme we don't
// resolve), summary brackets (their span is positional/implicit in the schema),
// vector (EMF/WMF) images without a raster fallback, the Gantt/resource-scheduling
// layer beyond the per-topic task fields above, SmartRules, spreadsheets, and live
// OLE objects.

export interface MmapImportResult {
  doc: MindMapDoc;
  warnings: string[];
}

const ATTR = "@_";

// biome-ignore lint/suspicious/noExplicitAny: parsed XML is dynamically shaped
type Xml = any;

interface ParseContext {
  warnings: string[];
  boundaries: Boundary[];
  /** The unzipped archive — image/attachment bytes live here under `bin/<uuid>.bin`. */
  files: Record<string, Uint8Array>;
  /** Callout topics lifted onto their parent (counted so the honesty check doesn't flag them). */
  calloutCount: number;
}

function asList<T>(x: T | T[] | undefined | null): T[] {
  if (x === undefined || x === null) return [];
  return Array.isArray(x) ? x : [x];
}

function extractText(node: Xml): string {
  const t = node?.Text;
  if (!t) return "";
  return String(t[`${ATTR}PlainText`] ?? t[`${ATTR}Text`] ?? t["#text"] ?? "");
}

/** True for a MindManager boolean attribute ("true"/"1"). */
function truthyAttr(v: unknown): boolean {
  return v === true || v === "true" || v === "1" || v === 1;
}

/** pri:Color is hexBinary AARRGGBB (alpha FIRST), lowercase. Return CSS `#rrggbb`, or undefined when
 *  absent / malformed / fully transparent (alpha 00) — a transparent fill is "no override", not black. */
function argbToHex(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const hex = v.trim().toLowerCase();
  if (!/^[0-9a-f]{8}$/.test(hex)) return undefined;
  if (hex.startsWith("00")) return undefined; // fully transparent → leave to the theme
  return `#${hex.slice(2)}`;
}

const BLOCK_TAG = /^(p|div|br|li|tr|h[1-6]|blockquote|ul|ol|table)$/i;

/** Flatten a parsed XHTML notes subtree to plain text, breaking lines on block-level elements. */
function collectXhtmlText(node: Xml): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectXhtmlText).join("");
  let out = "";
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith(ATTR)) continue; // attributes carry no note text
    if (key === "#text") {
      out += String(value);
      continue;
    }
    // Repeated tags collapse to an array (e.g. several <p>); break each as its own block.
    for (const item of Array.isArray(value) ? value : [value]) {
      const text = collectXhtmlText(item);
      out += BLOCK_TAG.test(key) ? `\n${text}` : text;
    }
  }
  return out;
}

function extractNote(topic: Xml): string | undefined {
  const xhtml = topic?.NotesGroup?.NotesXhtmlData;
  // The full note body is an inline XHTML subtree; @PreviewPlainText is only a truncated preview.
  // Prefer the full body so long notes import whole, then fall back to the preview, then legacy shapes.
  if (xhtml && typeof xhtml === "object") {
    const body = collectXhtmlText(xhtml.html ?? xhtml)
      .replace(/ /g, " ") // nbsp → space
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (body) return body;
  }
  const preview = xhtml?.[`${ATTR}PreviewPlainText`];
  if (preview) return String(preview);
  const legacy = topic?.Notes?.CDATA?.[`${ATTR}Text`] ?? topic?.Notes?.["#text"];
  return legacy ? String(legacy) : undefined;
}

/** User tags / text-markers: Topic>TextLabels>TextLabel@TextLabelName (deduped, order-preserving). */
function extractTags(topic: Xml): string[] {
  const seen = new Set<string>();
  for (const label of asList(topic?.TextLabels?.TextLabel)) {
    const name = label?.[`${ATTR}TextLabelName`] ?? label?.[`${ATTR}Name`];
    if (typeof name === "string" && name.length > 0) seen.add(name);
  }
  return [...seen];
}

/** Explicit per-topic style overrides (fill/line colour + whole-topic font). Theme-inherited styling
 *  (no explicit attributes) is intentionally left to the canvas default — we don't resolve the theme. */
function extractStyle(topic: Xml): NodeStyle | undefined {
  const style: NodeStyle = {};
  const fill = argbToHex(topic?.Color?.[`${ATTR}FillColor`]);
  if (fill) style.background = fill;
  const line = argbToHex(topic?.Color?.[`${ATTR}LineColor`]);
  if (line) style.border = `1px solid ${line}`;
  const font = topic?.Text?.Font;
  if (font) {
    const color = argbToHex(font[`${ATTR}Color`]);
    if (color) style.color = color;
    const name = font[`${ATTR}Name`];
    if (typeof name === "string" && name) style.fontFamily = name;
    const size = Number(font[`${ATTR}Size`]);
    if (Number.isFinite(size) && size > 0) style.fontSize = `${size}px`;
    if (truthyAttr(font[`${ATTR}Bold`])) style.fontWeight = "bold";
    if (truthyAttr(font[`${ATTR}Underline`])) style.textDecoration = "underline";
  }
  const shape = mapShape(topic);
  if (shape) style.shape = shape;
  return Object.keys(style).length > 0 ? style : undefined;
}

/** The dateTime attrs are ISO local (e.g. "2026-06-21T00:00:00"); the model stores a YYYY-MM-DD date. */
function isoDate(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const m = v.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : undefined;
}

/** Per-topic task fields the app already supports (inspector / filter / Kanban): start, due, priority
 *  (Prio1..5 → 1..5, 1 = highest), progress (TaskPercentage 0..100 → 0..1), and resources. */
function extractTask(topic: Xml): TaskInfo | undefined {
  const t = topic?.Task;
  if (!t) return undefined;
  const info: TaskInfo = {};
  const prio = String(t[`${ATTR}TaskPriority`] ?? "").match(/Prio([1-9])/i);
  if (prio) info.priority = Number(prio[1]);
  const pct = Number(t[`${ATTR}TaskPercentage`]);
  if (Number.isFinite(pct)) info.progress = Math.max(0, Math.min(1, pct / 100));
  const due = isoDate(t[`${ATTR}DeadlineDate`]);
  if (due) info.due = due;
  const start = isoDate(t[`${ATTR}StartDate`]);
  if (start) info.start = start;
  const resources = String(t[`${ATTR}Resources`] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (resources.length > 0) info.resources = resources;
  return Object.keys(info).length > 0 ? info : undefined;
}

// --- Phase B/C: binaries, rich text, shapes, styling, callouts ------------------------------------

/** Base64-encode bytes (for data: URLs). btoa exists in browsers and Node ≥16. */
function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/** Text of a `cor:Uri` node (string, or {#text}). */
function uriText(u: Xml): string | undefined {
  if (typeof u === "string") return u;
  const t = u?.["#text"];
  return typeof t === "string" ? t : undefined;
}

/** Resolve an `mmarch://bin/<uuid>.bin` reference to the archive entry's bytes (case/basename tolerant). */
function resolveBin(uri: unknown, files: Record<string, Uint8Array>): Uint8Array | undefined {
  if (typeof uri !== "string") return undefined;
  const path = uri.replace(/^mmarch:\/\//i, "").replace(/^\/+/, "");
  if (files[path]) return files[path];
  const lower = path.toLowerCase();
  const base = lower.split("/").pop();
  const key = Object.keys(files).find(
    (k) => k.toLowerCase() === lower || k.toLowerCase().split("/").pop() === base,
  );
  return key ? files[key] : undefined;
}

const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  txt: "text/plain",
  csv: "text/csv",
  md: "text/markdown",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
};
function mimeFromName(name: string): string {
  return EXT_MIME[name.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
}

// Browser-renderable raster image types (Metafile = EMF/WMF can't render in a browser).
const IMAGE_MIME: Record<string, string> = { PngImage: "image/png", IconImage: "image/png" };

/** Embedded topic image: Topic>OneImage>Image>ImageData>cor:Uri (mmarch://bin/…), with a raster
 *  AlternateImageData fallback for vector primaries. Optional ImageSize (mm) → capped display px. */
function extractImage(topic: Xml, ctx: ParseContext): MapImage | undefined {
  const img = topic?.OneImage?.Image;
  if (!img) return undefined;
  const fromData = (d: Xml): MapImage | undefined => {
    if (!d) return undefined;
    const type = String(d[`${ATTR}ImageType`] ?? "").replace(/^urn:mindjet:/, "");
    const mime = IMAGE_MIME[type];
    if (!mime) return undefined; // e.g. MetafileImage — not browser-renderable
    const bytes = resolveBin(uriText(d.Uri), ctx.files);
    return bytes ? { url: `data:${mime};base64,${toBase64(bytes)}` } : undefined;
  };
  const result = fromData(img.ImageData) ?? fromData(img.AlternateImageData);
  if (!result) {
    ctx.warnings.push(t("io.warn.mmapImageSkipped"));
    return undefined;
  }
  // ImageSize is in millimetres; convert at 96dpi and cap the on-canvas display (aspect preserved).
  let w = Number(img.ImageSize?.[`${ATTR}Width`]);
  let h = Number(img.ImageSize?.[`${ATTR}Height`]);
  w = Number.isFinite(w) && w > 0 ? (w / 25.4) * 96 : 0;
  h = Number.isFinite(h) && h > 0 ? (h / 25.4) * 96 : 0;
  const MAX = 280;
  if (w > MAX) {
    h *= MAX / w;
    w = MAX;
  }
  if (h > MAX) {
    w *= MAX / h;
    h = MAX;
  }
  if (w > 0) result.width = Math.round(w);
  if (h > 0) result.height = Math.round(h);
  return result;
}

/** Embedded attachments: Topic>AttachmentGroup>AttachmentData>cor:Uri (mmarch://bin/…). The real
 *  filename only survives in @FileName (the archive entry is a generic .bin). Folders are skipped. */
function extractAttachments(topic: Xml, ctx: ParseContext): MapAttachment[] {
  const out: MapAttachment[] = [];
  for (const a of asList(topic?.AttachmentGroup?.AttachmentData)) {
    if (String(a?.[`${ATTR}Type`] ?? "").replace(/^urn:mindjet:/, "") === "Folder") continue;
    const bytes = resolveBin(uriText(a?.Uri), ctx.files);
    if (!bytes) continue;
    const name = String(a?.[`${ATTR}FileName`] ?? "attachment");
    out.push({
      name,
      dataUrl: `data:${mimeFromName(name)};base64,${toBase64(bytes)}`,
      size: bytes.length,
    });
  }
  return out;
}

function escapeRich(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface RunAttr {
  b?: boolean;
  i?: boolean;
  u?: boolean;
  s?: boolean;
  color?: string;
}

function wrapRun(text: string, a: RunAttr): string {
  let inner = escapeRich(text).replace(/\n/g, "<br>");
  if (a.b) inner = `<strong>${inner}</strong>`;
  if (a.i) inner = `<em>${inner}</em>`;
  if (a.u) inner = `<u>${inner}</u>`;
  if (a.s) inner = `<s>${inner}</s>`;
  if (a.color) inner = `<span style="color: ${a.color}">${inner}</span>`;
  return inner;
}

/** Rich-text runs: Text>FontRange[@From,@To,@Bold,@Italic,@Underline,@Strikethrough,@Color] over the
 *  PlainText (UTF-16 offsets). Build the canvas's sanitised inline-HTML subset directly (we only emit
 *  allow-listed tags + a safe colour span, so it needs no DOMParser pass). undefined = no formatting. */
function extractRich(topic: Xml, plain: string): string | undefined {
  const ranges = asList(topic?.Text?.FontRange);
  if (ranges.length === 0 || plain.length === 0) return undefined;
  const attrs: RunAttr[] = Array.from({ length: plain.length }, () => ({}));
  let any = false;
  for (const r of ranges) {
    const from = Math.max(0, Math.trunc(Number(r?.[`${ATTR}From`]) || 0));
    const toRaw = Number(r?.[`${ATTR}To`]);
    const to = Number.isFinite(toRaw) ? Math.min(plain.length, Math.trunc(toRaw)) : plain.length;
    const a: RunAttr = {};
    if (truthyAttr(r[`${ATTR}Bold`])) a.b = true;
    if (truthyAttr(r[`${ATTR}Italic`])) a.i = true;
    if (truthyAttr(r[`${ATTR}Underline`])) a.u = true;
    if (truthyAttr(r[`${ATTR}Strikethrough`])) a.s = true;
    const color = argbToHex(r[`${ATTR}Color`]);
    if (color) a.color = color;
    if (!a.b && !a.i && !a.u && !a.s && !a.color) continue;
    for (let idx = from; idx < to; idx++) attrs[idx] = { ...attrs[idx], ...a };
    any = true;
  }
  if (!any) return undefined;
  const sig = (a: RunAttr) =>
    `${a.b ? 1 : 0}${a.i ? 1 : 0}${a.u ? 1 : 0}${a.s ? 1 : 0}|${a.color ?? ""}`;
  let html = "";
  for (let i = 0; i < plain.length; ) {
    let j = i + 1;
    while (j < plain.length && sig(attrs[j]) === sig(attrs[i])) j++;
    html += wrapRun(plain.slice(i, j), attrs[i]);
    i = j;
  }
  return html;
}

/** Geometric topic shapes that map to a model NodeShape; Rectangle/RoundedRectangle ≈ the default
 *  look (skipped), and None/Line/Image have no equivalent. */
function mapShape(topic: Xml): NodeShape | undefined {
  switch (
    String(topic?.SubTopicShape?.[`${ATTR}SubTopicShape`] ?? "").replace(/^urn:mindjet:/, "")
  ) {
    case "Oval":
    case "Circle":
      return "ellipse";
    case "Hexagon":
      return "hexagon";
    case "Octagon":
      return "octagon";
    default:
      return undefined;
  }
}

/** MindManager line-dash enum → the model's three styles. */
function mapDash(v: unknown): "solid" | "dashed" | "dotted" | undefined {
  const s = String(v ?? "").replace(/^urn:mindjet:/, "");
  if (/dot/i.test(s)) return "dotted";
  if (/dash/i.test(s)) return "dashed";
  if (/solid/i.test(s)) return "solid";
  return undefined;
}

/** Boundary outline shape enum → the model's boundary shapes. */
function mapBoundaryShape(v: unknown): Boundary["shape"] | undefined {
  const s = String(v ?? "").replace(/^urn:mindjet:/, "");
  if (/curvedrectangle|roundedrectangle/i.test(s)) return "roundRect";
  if (/rectangle/i.test(s)) return "rect";
  if (/scallop|wave|curved|cloud/i.test(s)) return "cloud";
  if (/zigzag|polygon/i.test(s)) return "polygon";
  return undefined;
}

function isCalloutTopic(t: Xml): boolean {
  // The marker is an empty self-closing element → parses to "" (falsy); test for the key's presence.
  return t != null && typeof t === "object" && "CalloutFloatingTopicShape" in t;
}

let calloutCounter = 0;
/** Callouts are floating topics under a parent carrying CalloutFloatingTopicShape — lifted onto the
 *  parent node as annotation bubbles. (Their MindManager offsets are a different scale, so we stagger
 *  them with sensible defaults rather than reuse the raw offset.) */
function extractCallouts(topic: Xml, ctx: ParseContext): Callout[] {
  const callouts: Callout[] = [];
  asList(topic?.FloatingTopics?.Topic)
    .filter(isCalloutTopic)
    .forEach((c, idx) => {
      const color = argbToHex(c?.Color?.[`${ATTR}FillColor`]);
      calloutCounter += 1;
      callouts.push({
        id: `c${calloutCounter}`,
        text: extractText(c),
        dx: 140,
        dy: idx * 64,
        ...(color ? { color } : {}),
      });
      ctx.calloutCount += 1;
    });
  return callouts;
}

function extractIcons(topic: Xml): string[] {
  return (
    asList(topic?.IconsGroup?.Icons?.Icon)
      .map((icon) => {
        const type = icon?.[`${ATTR}IconType`];
        // e.g. "urn:mindjet:ThumbsUp" -> "ThumbsUp"
        return typeof type === "string" ? type.replace(/^urn:mindjet:/, "") : "";
      })
      .filter((name) => name.length > 0)
      // Render as glyphs (👍) rather than literal "ThumbsUp"; unknown names kept as-is.
      .map(mindManagerIconToEmoji)
  );
}

function subtreeIds(node: MapNode): NodeId[] {
  const ids: NodeId[] = [node.id];
  for (const child of node.children) ids.push(...subtreeIds(child));
  return ids;
}

function countNodes(node: MapNode): number {
  let total = 1;
  for (const child of node.children) total += countNodes(child);
  return total;
}

let idCounter = 0;
function makeId(): string {
  idCounter += 1;
  return `n${idCounter}`;
}

function topicToNode(topic: Xml, ctx: ParseContext, depth = 0): MapNode {
  const node: MapNode = {
    id: String(topic?.[`${ATTR}OId`] ?? makeId()),
    topic: extractText(topic),
    children: [],
  };

  const note = extractNote(topic);
  if (note) node.note = note;

  const url = topic?.Hyperlink?.[`${ATTR}Url`];
  // A malicious .mmap could carry a javascript:/data: hyperlink — skip it on import.
  if (url && !isDangerousUrl(String(url))) node.hyperlink = String(url);

  const icons = extractIcons(topic);
  if (icons.length > 0) node.icons = icons;

  const tags = extractTags(topic);
  if (tags.length > 0) node.tags = tags;

  const style = extractStyle(topic);
  if (style) node.style = style;

  const rich = extractRich(topic, node.topic);
  if (rich) node.topicRich = rich;

  const task = extractTask(topic);
  if (task) node.task = task;

  const image = extractImage(topic, ctx);
  if (image) node.image = image;

  const attachments = extractAttachments(topic, ctx);
  if (attachments.length > 0) node.attachments = attachments;

  const callouts = extractCallouts(topic, ctx);
  if (callouts.length > 0) node.callouts = callouts;

  // Two-sided map: a MAIN branch (depth 1) records which half it sits on via the sign of its
  // horizontal offset from the central topic — MindManager stamps CX < 0 for the left side and
  // CX > 0 for the right (the magnitude is just a layout nudge). Deeper topics carry offsets too,
  // but a "side" only has meaning for a root child, so gate strictly on depth === 1.
  if (depth === 1) {
    const cx = Number(topic?.Offset?.[`${ATTR}CX`]);
    if (Number.isFinite(cx) && cx !== 0) node.side = cx < 0 ? "left" : "right";
  }

  node.children = asList(topic?.SubTopics?.Topic).map((child) =>
    topicToNode(child, ctx, depth + 1),
  );

  // A boundary drawn on this topic encloses its subtree; carry its explicit styling when present.
  if (topic?.OneBoundary) {
    const b = topic.OneBoundary.Boundary ?? {};
    const boundary: Boundary = { id: `b${ctx.boundaries.length + 1}`, nodeIds: subtreeIds(node) };
    const color =
      argbToHex(b?.Color?.[`${ATTR}LineColor`]) ?? argbToHex(b?.Color?.[`${ATTR}FillColor`]);
    if (color) boundary.color = color;
    const shape = mapBoundaryShape(b?.BoundaryShape?.[`${ATTR}BoundaryShape`]);
    if (shape) boundary.shape = shape;
    const dash = mapDash(b?.LineStyle?.[`${ATTR}LineDashStyle`]);
    if (dash) boundary.dash = dash;
    ctx.boundaries.push(boundary);
  }

  return node;
}

/** Arrowheads from the two endpoints' ConnectionShape (NoArrow|Arrow). Returns undefined to keep the
 *  historical default ("to") when the file doesn't say. */
function relArrow(cgs: Xml[]): CrossLink["arrow"] | undefined {
  const shapeOf = (cg: Xml) =>
    String(cg?.Connection?.DefaultConnectionStyle?.[`${ATTR}ConnectionShape`] ?? "");
  const has = (s: string) => /arrow/i.test(s) && !/noarrow/i.test(s);
  const f = shapeOf(cgs[0]);
  const t = shapeOf(cgs[1]);
  if (!f && !t) return undefined; // unspecified → leave the default
  const fa = has(f);
  const ta = has(t);
  if (fa && ta) return "both";
  if (fa) return "from";
  if (ta) return "to";
  return "none";
}

function extractRelationships(map: Xml): CrossLink[] {
  const links: CrossLink[] = [];
  asList(map?.Relationships?.Relationship).forEach((rel, i) => {
    const cgs = asList(rel?.ConnectionGroup);
    const oids = cgs
      .map((cg) => cg?.Connection?.ObjectReference?.[`${ATTR}OIdRef`])
      .filter(Boolean)
      .map(String);
    if (oids.length < 2) return;
    const link: CrossLink = { id: `r${i + 1}`, from: oids[0], to: oids[1] };
    const label = extractText(rel);
    if (label) link.label = label;
    const color = argbToHex(rel?.Color?.[`${ATTR}LineColor`]);
    if (color) link.color = color;
    const width = Number(rel?.LineStyle?.[`${ATTR}LineWidth`]);
    if (Number.isFinite(width) && width > 0) link.width = width;
    const dash = mapDash(rel?.LineStyle?.[`${ATTR}LineDashStyle`]);
    if (dash) link.dash = dash;
    const arrow = relArrow(cgs);
    if (arrow) link.arrow = arrow;
    links.push(link);
  });
  return links;
}

export function parseMmap(zipBytes: Uint8Array): MmapImportResult {
  const files = unzipSync(zipBytes);
  const ctx: ParseContext = { warnings: [], boundaries: [], files, calloutCount: 0 };

  const entryName = Object.keys(files).find((k) => /(^|\/)document\.xml$/i.test(k));
  if (!entryName) {
    throw new Error(t("io.err.mmapNoDocument", { entries: Object.keys(files).join(", ") }));
  }

  const xml = strFromU8(files[entryName]);
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ATTR,
    removeNSPrefix: true,
  });
  const tree = parser.parse(xml);

  const map = tree?.Map;
  if (!map) throw new Error(t("io.err.mmapNoMapRoot"));

  const rootTopic = map?.OneTopic?.Topic ?? map?.Topic;
  if (!rootTopic) {
    throw new Error(t("io.err.mmapNoRootTopic"));
  }

  idCounter = 0;
  calloutCounter = 0;
  const root = topicToNode(rootTopic, ctx);

  // Map-level floating topics (legends, sticky notes outside the central tree). Callout-shaped floaters
  // under the root were already lifted onto it as callouts (topicToNode), so exclude them here.
  const floatingTopics = [
    ...asList(map?.FloatingTopics?.Topic),
    ...asList(rootTopic?.FloatingTopics?.Topic).filter((t) => !isCalloutTopic(t)),
  ].map((t) => topicToNode(t, ctx));

  const links = extractRelationships(map);

  // Per-map canvas background colour from the theme's BackgroundFill (colour only).
  const background = argbToHex(map?.StyleGroup?.BackgroundFill?.[`${ATTR}FillColor`]);

  // Honesty check: warn about any topics still left behind (callouts count as imported).
  const totalTopics = (xml.match(/<ap:Topic[\s>]/g) ?? []).length;
  const importedTopics =
    countNodes(root) + floatingTopics.reduce((sum, f) => sum + countNodes(f), 0) + ctx.calloutCount;
  if (totalTopics > importedTopics) {
    ctx.warnings.push(
      `${totalTopics - importedTopics} topic(s) outside the central hierarchy (floating/detached) were not imported.`,
    );
  }

  // Floating (detached) topics are imported as-is; note that so their placement isn't a surprise.
  if (floatingTopics.length > 0) {
    ctx.warnings.push(t("io.warn.mmapFloatingTopics", { n: floatingTopics.length }));
  }

  const doc: MindMapDoc = {
    schemaVersion: 1,
    id: makeId(),
    title: root.topic || "Imported map",
    root,
    ...(links.length > 0 ? { links } : {}),
    ...(ctx.boundaries.length > 0 ? { boundaries: ctx.boundaries } : {}),
    ...(floatingTopics.length > 0 ? { floatingTopics } : {}),
    meta: { source: "mmap", ...(background ? { background } : {}) },
  };

  return { doc, warnings: ctx.warnings };
}
