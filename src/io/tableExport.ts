import { t } from "../i18n/registry";
import type { MapNode, MindMapDoc } from "../model/types";

// Export a map as a flat table (the inverse of io/pasteTable): one row per topic with its depth, note,
// and tags — for pasting into Excel / Google Sheets. Pure + deterministic; the clipboard action
// serialises mapToTsv(). A cell can't carry tabs/newlines (they're the delimiters), so they collapse
// to spaces.

/** The table's fixed header row. */
export const TABLE_HEADERS = ["Topic", "Depth", "Note", "Tags"] as const;

/** Flatten tabs/newlines in a cell value so it can't break the TSV grid. */
function cell(s: string): string {
  return s.replace(/[\t\r\n]+/g, " ").trim();
}

/** Rows for the map's central tree (header first), depth-first, root included (depth 0). Pure. */
export function mapToRows(doc: MindMapDoc): string[][] {
  const rows: string[][] = [[...TABLE_HEADERS]];
  const walk = (n: MapNode, depth: number) => {
    rows.push([
      cell(n.topic) || t("common.untitled"),
      String(depth),
      cell(n.note ?? ""),
      (n.tags ?? []).join(", "),
    ]);
    for (const c of n.children) walk(c, depth + 1);
  };
  walk(doc.root, 0);
  return rows;
}

/** The map as a TSV string (tab-separated cells, newline-separated rows). Pure. */
export function mapToTsv(doc: MindMapDoc): string {
  return mapToRows(doc)
    .map((r) => r.join("\t"))
    .join("\n");
}
