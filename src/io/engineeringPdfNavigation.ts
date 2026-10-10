import { type PDFDocument, PDFHexString, PDFName, type PDFPage } from "pdf-lib";

export interface PdfSectionDestination {
  title: string;
  level: number;
  page: PDFPage;
  y: number;
}

/** Attach open, hierarchical bookmarks to the document's catalog. */
export function addEngineeringPdfNavigation(
  pdf: PDFDocument,
  sections: PdfSectionDestination[],
): void {
  if (!sections.length) return;
  const context = pdf.context;
  const root = context.obj({ Type: "Outlines" });
  const rootRef = context.register(root);
  const entries = sections.map((section) => {
    const dict = context.obj({
      Title: PDFHexString.fromText(section.title),
      Dest: [section.page.ref, "XYZ", 48, section.y, null],
    });
    return { dict, ref: context.register(dict), children: [] as number[] };
  });
  const roots: number[] = [];
  const stack: number[] = [];
  sections.forEach((section, index) => {
    // A skipped heading level nests beneath the nearest preceding ancestor.
    const level = Math.max(1, Math.min(9, Math.floor(section.level) || 1));
    while (
      stack.length &&
      Math.max(1, Math.min(9, Math.floor(sections[stack[stack.length - 1]].level) || 1)) >= level
    )
      stack.pop();
    const parent = stack[stack.length - 1];
    const siblings = parent === undefined ? roots : entries[parent].children;
    entries[index].dict.set(
      PDFName.of("Parent"),
      parent === undefined ? rootRef : entries[parent].ref,
    );
    siblings.push(index);
    stack.push(index);
  });
  function connect(children: number[]): number {
    let count = 0;
    children.forEach((index, position) => {
      const entry = entries[index];
      if (position) entry.dict.set(PDFName.of("Prev"), entries[children[position - 1]].ref);
      if (position + 1 < children.length)
        entry.dict.set(PDFName.of("Next"), entries[children[position + 1]].ref);
      const descendants = connect(entry.children);
      if (entry.children.length) {
        entry.dict.set(PDFName.of("First"), entries[entry.children[0]].ref);
        entry.dict.set(PDFName.of("Last"), entries[entry.children[entry.children.length - 1]].ref);
        entry.dict.set(PDFName.of("Count"), context.obj(descendants));
      }
      count += descendants + 1;
    });
    return count;
  }
  root.set(PDFName.of("Count"), context.obj(connect(roots)));
  root.set(PDFName.of("First"), entries[roots[0]].ref);
  root.set(PDFName.of("Last"), entries[roots[roots.length - 1]].ref);
  pdf.catalog.set(PDFName.of("Outlines"), rootRef);
  pdf.catalog.set(PDFName.of("PageMode"), PDFName.of("UseOutlines"));
}

/** Make a table-of-contents row navigate directly to its section. */
export function addPdfSectionLink(
  pdf: PDFDocument,
  page: PDFPage,
  rect: [number, number, number, number],
  destination: PdfSectionDestination,
): void {
  const annotation = pdf.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: rect,
    Border: [0, 0, 0],
    Dest: [destination.page.ref, "XYZ", 48, destination.y, null],
  });
  page.node.addAnnot(pdf.context.register(annotation));
}
