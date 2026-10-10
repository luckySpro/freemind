import {
  AlignmentType,
  Bookmark,
  Document,
  ExternalHyperlink,
  Footer,
  HeadingLevel,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { type Token, type Tokens, marked } from "marked";
import { t } from "../i18n";
import type { MapNode, MindMapDoc } from "../model/types";

type Inline = TextRun | ImageRun | ExternalHyperlink;
type Block = Paragraph | Table;

// Data URLs only: Word export never reaches the network. All bytes are embedded.
function imageRun(src: string, alt: string): Inline[] {
  const match = /^data:image\/(png|jpeg);base64,([a-z0-9+/=\s]+)$/i.exec(src);
  if (!match)
    return [new TextRun(t("writing.remoteExport", { alt: alt || t("writing.pasteLocal") }))];
  try {
    const bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
    let width = 480;
    let height = 320;
    if (match[1].toLowerCase() === "png" && bytes.length >= 24) {
      const view = new DataView(bytes.buffer);
      width = view.getUint32(16);
      height = view.getUint32(20);
    } else if (match[1].toLowerCase() === "jpeg") {
      let offset = 2;
      while (offset + 8 < bytes.length) {
        if (bytes[offset] !== 0xff) break;
        const marker = bytes[offset + 1];
        const length = bytes[offset + 2] * 256 + bytes[offset + 3];
        if ([0xc0, 0xc1, 0xc2].includes(marker)) {
          height = bytes[offset + 5] * 256 + bytes[offset + 6];
          width = bytes[offset + 7] * 256 + bytes[offset + 8];
          break;
        }
        if (length < 2) break;
        offset += length + 2;
      }
    }
    if (!width || !height) throw new Error("Invalid dimensions");
    const scale = Math.min(1, 560 / width, 700 / height);
    return [
      new ImageRun({
        type: match[1].toLowerCase() === "png" ? "png" : "jpg",
        data: bytes,
        transformation: { width: Math.round(width * scale), height: Math.round(height * scale) },
        altText: { title: alt, description: alt, name: alt || t("writing.noteImage") },
      }),
    ];
  } catch {
    return [new TextRun(t("writing.invalidImage", { alt: alt || t("writing.image") }))];
  }
}

function inline(
  tokens: Token[],
  style: { bold?: boolean; italics?: boolean; strike?: boolean } = {},
): Inline[] {
  return tokens.flatMap((token): Inline[] => {
    switch (token.type) {
      case "strong":
        return inline((token as Tokens.Strong).tokens, { ...style, bold: true });
      case "em":
        return inline((token as Tokens.Em).tokens, { ...style, italics: true });
      case "del":
        return inline((token as Tokens.Del).tokens, { ...style, strike: true });
      case "image":
        return imageRun((token as Tokens.Image).href, (token as Tokens.Image).text);
      case "link": {
        const link = token as Tokens.Link;
        const children = inline(link.tokens, style);
        return /^(https?:\/\/|mailto:)/i.test(link.href)
          ? [new ExternalHyperlink({ link: link.href, children })]
          : children;
      }
      case "br":
        return [new TextRun({ break: 1 })];
      case "codespan":
        return [new TextRun({ text: (token as Tokens.Codespan).text, font: "Menlo", ...style })];
      case "html":
        return []; // Raw active markup is never copied into Office documents.
      default: {
        const text = token as Tokens.Text;
        return text.tokens
          ? inline(text.tokens, style)
          : [new TextRun({ text: text.text ?? token.raw, ...style })];
      }
    }
  });
}

function noteBlocks(note: string): Block[] {
  const blocks = (tokens: Token[], listPrefix = ""): Block[] =>
    tokens.flatMap((token): Block[] => {
      switch (token.type) {
        case "space":
          return [];
        case "html":
          return [
            new Paragraph({
              children: [new TextRun(t("writing.htmlOmitted"))],
            }),
          ];
        case "table": {
          const table = token as Tokens.Table;
          const row = (cells: Tokens.TableCell[], header = false) =>
            new TableRow({
              tableHeader: header,
              children: cells.map(
                (cell) =>
                  new TableCell({
                    children: [new Paragraph({ children: inline(cell.tokens, { bold: header }) })],
                  }),
              ),
            });
          return [
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [row(table.header, true), ...table.rows.map((cells) => row(cells))],
            }),
          ];
        }
        case "list": {
          const list = token as Tokens.List;
          return list.items.flatMap((item, index) =>
            blocks(
              item.tokens,
              item.task
                ? item.checked
                  ? "☑ "
                  : "☐ "
                : list.ordered
                  ? `${Number(list.start || 1) + index}. `
                  : "• ",
            ),
          );
        }
        case "blockquote":
          return blocks((token as Tokens.Blockquote).tokens);
        case "code":
          return (token as Tokens.Code).text.split("\n").map(
            (text) =>
              new Paragraph({
                children: [new TextRun({ text, font: "Menlo", size: 20 })],
                shading: { fill: "F3F4F6" },
              }),
          );
        case "hr":
          return [new Paragraph({ text: "────────" })];
        case "heading":
          return [
            new Paragraph({
              children: inline((token as Tokens.Heading).tokens, { bold: true }),
              spacing: { before: 160, after: 80 },
            }),
          ];
        default: {
          const paragraph = token as Tokens.Paragraph;
          return [
            new Paragraph({
              children: [new TextRun(listPrefix), ...inline(paragraph.tokens ?? [token])],
              spacing: { after: 120 },
            }),
          ];
        }
      }
    });
  return blocks(marked.lexer(note, { gfm: true }));
}

export async function buildEngineeringDocx(doc: MindMapDoc): Promise<Uint8Array> {
  const title = doc.title || doc.root.topic || t("writing.document");
  const body: Block[] = [];
  const entries: { title: string; level: number; href: string }[] = [];
  let index = 0;
  if (doc.root.note) body.push(...noteBlocks(doc.root.note));
  const walk = (nodes: MapNode[], path: number[]) => {
    nodes.forEach((node, position) => {
      const numbers = [...path, position + 1];
      const level = Math.min(numbers.length, 9);
      const heading = `${numbers.join(".")} ${node.topic}`;
      const bookmark = `section_${++index}`;
      entries.push({ title: heading, level, href: bookmark });
      body.push(
        new Paragraph({
          heading: HeadingLevel[`HEADING_${level}` as keyof typeof HeadingLevel],
          children: [new Bookmark({ id: bookmark, children: [new TextRun(heading)] })],
          spacing: { before: level === 1 ? 280 : 180, after: 120 },
          keepNext: true,
        }),
      );
      if (node.note) body.push(...noteBlocks(node.note));
      if (node.image) body.push(new Paragraph({ children: imageRun(node.image.url, node.topic) }));
      walk(node.children, numbers);
    });
  };
  walk(doc.root.children, []);
  const document = new Document({
    title,
    creator: "FreeMind",
    description: t("writing.description"),
    features: { updateFields: true },
    styles: {
      default: {
        title: { run: { font: "Arial Unicode MS", color: "000000", size: 48 } },
        heading1: { run: { font: "Arial Unicode MS", color: "000000", bold: true, size: 32 } },
        heading2: { run: { font: "Arial Unicode MS", color: "000000", bold: true, size: 28 } },
        heading3: { run: { font: "Arial Unicode MS", color: "000000", bold: true, size: 24 } },
        heading4: { run: { font: "Arial Unicode MS", color: "000000", bold: true, size: 22 } },
        heading5: { run: { font: "Arial Unicode MS", color: "000000", bold: true, size: 22 } },
        heading6: { run: { font: "Arial Unicode MS", color: "000000", bold: true, size: 22 } },
        document: {
          run: { font: "Arial Unicode MS", size: 22 },
          paragraph: { spacing: { after: 120, line: 320 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ children: [PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES] }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            text: title,
            heading: HeadingLevel.TITLE,
            spacing: { before: 1800, after: 400 },
          }),
          new Paragraph({
            text: t("writing.document"),
            spacing: { after: 300 },
            pageBreakBefore: false,
          }),
          new Paragraph({
            text: t("writing.contents"),
            pageBreakBefore: true,
            spacing: { after: 240 },
          }),
          new TableOfContents(t("writing.contents"), {
            headingStyleRange: "1-9",
            hyperlink: true,
            cachedEntries: entries,
          }),
          new Paragraph({ pageBreakBefore: true }),
          ...body,
        ],
      },
    ],
  });
  return new Uint8Array(await Packer.toArrayBuffer(document));
}
