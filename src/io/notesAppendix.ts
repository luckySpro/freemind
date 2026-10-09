import { t } from "../i18n/registry";
// Build a "Notes" appendix (HTML) for the print/PDF export: every topic that carries a note, listed
// with its outline number + title and the note rendered from the same safe markdown subset the editor
// uses. The PDF export is otherwise an SVG of the canvas, which omits notes — this appends them so a
// printed map carries its detail. Pure + deterministic (the note HTML comes from renderNote, which is
// escape-first, so it's safe to interpolate into the print document alongside the sanitised SVG).

import type { MapNode, MindMapDoc } from "../model/types";
import { renderNote } from "../noteFormat";
import { outlineNumbers } from "../outline";
import { escapeHtmlContent as escapeHtml } from "./htmlEscape";

/** HTML for the notes appendix, or "" when no topic carries a note. */
export function buildNotesAppendix(doc: MindMapDoc): string {
  const numbers = outlineNumbers(doc.root, doc.meta?.numberStyle);
  const items: string[] = [];
  const visit = (n: MapNode) => {
    if (n.note?.trim()) {
      const num = numbers.get(n.id);
      const heading = `${num ? `${escapeHtml(num)} ` : ""}${escapeHtml(n.topic || t("common.untitled"))}`;
      items.push(`<article><h3>${heading}</h3>${renderNote(n.note)}</article>`);
    }
    for (const c of n.children) visit(c);
  };
  visit(doc.root);
  for (const f of doc.floatingTopics ?? []) visit(f);
  if (items.length === 0) return "";
  return `<section class="mm-notes-appendix"><h2>${escapeHtml(t("panel.tab.notes"))}</h2>${items.join("")}</section>`;
}
