import { t } from "../../i18n/registry";
import "./messages";
// The slash `/` command menu — pure catalogue + matching + key-routing, so the stateful popup in
// TopicNode stays thin and this logic is unit-tested. Typing `/` at the start of a topic opens the
// menu; the text after the slash filters it; Arrow/Enter/Escape drive it. Each command's *effect*
// lives in FlowMindMap's `runSlashCommand` (it needs the doc ops); here we only describe + select.

export interface SlashCommand {
  /** Stable id dispatched to `runSlashCommand`. */
  id: string;
  label: string;
  /** A short trailing hint/glyph shown on the right (e.g. a marker). */
  hint?: string;
  /** Extra match terms beyond the label (so "task" finds "Mark as to-do"). */
  keywords: string[];
}

// Ordered by how often you'd reach for them while capturing. Ids map 1:1 to runSlashCommand's switch.
export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "child",
    get label() {
      return t("canvas.addChildTopic");
    },
    hint: "⇥",
    keywords: ["child", "subtopic", "sub", "add"],
  },
  {
    id: "sibling",
    get label() {
      return t("canvas.addSiblingTopic");
    },
    hint: "⏎",
    keywords: ["sibling", "add", "next"],
  },
  {
    id: "todo",
    get label() {
      return t("canvas.markAsToDo");
    },
    hint: "☐",
    keywords: ["todo", "task", "checkbox", "check"],
  },
  {
    id: "done",
    get label() {
      return t("canvas.markAsDone");
    },
    hint: "☑",
    keywords: ["done", "complete", "finished"],
  },
  {
    id: "due-today",
    get label() {
      return t("canvas.dueToday");
    },
    hint: "📅",
    keywords: ["due", "date", "today", "deadline"],
  },
  {
    id: "priority-high",
    get label() {
      return t("canvas.highPriority");
    },
    hint: "❗",
    keywords: ["priority", "high", "important", "urgent"],
  },
  {
    id: "boundary",
    get label() {
      return t("canvas.groupInABoundary");
    },
    hint: "▢",
    keywords: ["boundary", "group", "box"],
  },
  {
    id: "note",
    get label() {
      return t("canvas.addANote");
    },
    hint: "📝",
    keywords: ["note", "comment", "annotation"],
  },
  {
    id: "marker-star",
    get label() {
      return t("canvas.starMarker");
    },
    hint: "⭐",
    keywords: ["star", "marker", "favourite"],
  },
];

/** The slash trigger: the editor's plain text is a slash command iff it starts with `/`. Returns the
 *  query (everything after the slash) or `null` when not triggered. Only a *leading* slash counts, so
 *  a topic that merely contains a slash later (a path, a fraction) never opens the menu. */
export function slashQuery(text: string): string | null {
  return text.startsWith("/") ? text.slice(1) : null;
}

/** Commands matching `query` (case-insensitive, by label or keyword). An empty query lists them all;
 *  a query that matches nothing returns [] (the caller closes the menu). */
export function matchSlashCommands(query: string): SlashCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter(
    (c) => c.label.toLowerCase().includes(q) || c.keywords.some((k) => k.includes(q)),
  );
}

/** Route a keydown while the menu is open. `passthrough` = not a menu key (let the editor handle it);
 *  everything else the caller should `preventDefault` on. Index wraps; `count` must be > 0. */
export function slashMenuKey(
  key: string,
  index: number,
  count: number,
): { index: number; action: "move" | "select" | "close" | "passthrough" } {
  switch (key) {
    case "ArrowDown":
      return { index: (index + 1) % count, action: "move" };
    case "ArrowUp":
      return { index: (index - 1 + count) % count, action: "move" };
    case "Enter":
    case "Tab":
      return { index, action: "select" };
    case "Escape":
      return { index, action: "close" };
    default:
      return { index, action: "passthrough" };
  }
}
