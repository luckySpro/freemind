import { compareText } from "./i18n";
import { MARKER_GROUPS, markerName } from "./icons";
import type { MapNode, MindMapDoc } from "./model/types";
import { progressMap, toPercent } from "./progress";
import { addDaysISO } from "./taskDate";

// Group a map's topics into Kanban columns — a "board" view of the same data — keyed by one of three
// sources (item 4/5): TAGS (a topic appears once per tag; untagged fall into an "Untagged" column),
// a single-select MARKER GROUP (Priority/Status/Mood/Vote — one column per member glyph plus "None"),
// or a SCHEDULE of date buckets (Unscheduled / Overdue / Today / This week / Later). Cards carry their
// rolled-up completion + due date so the board reads like a status wall. Pure; the canvas applies the
// drop via the right handle (retag / set-marker / set-due).

export interface BoardCard {
  id: string;
  topic: string;
  /** Rolled-up completion (0..100), or undefined when the topic isn't a task. */
  progress?: number;
  /** Due date ("YYYY-MM-DD"), or undefined. */
  due?: string;
  /** The topic's tags — needed by the drag-to-retag drop. */
  tags: string[];
  /** The topic's markers — needed by the drag-to-set-marker drop. */
  icons: string[];
}

export interface BoardColumn {
  /** Stable column key — the tag, the marker glyph (""=none), or the schedule-bucket id. */
  key: string;
  /** Display heading for the column. */
  label: string;
  cards: BoardCard[];
}

/** What the board's columns are keyed on. */
export type BoardSource =
  | { kind: "tag" }
  | { kind: "marker"; group: string }
  | { kind: "schedule" };

export const UNTAGGED = "";

/** DataTransfer MIME identifying a Kanban card dragged between columns. */
export const CARD_DND_TYPE = "application/x-mm-card";

/** A card's new tag set when dragged from `fromTag` to `toTag`: drop the source-column tag, add the
 *  target-column tag (deduped). Dropping into Untagged only removes; dragging from Untagged only adds;
 *  a card's other tags are preserved. Pure — the canvas applies it via the `setNodeTags` handle. */
export function retagForMove(tags: string[], fromTag: string, toTag: string): string[] {
  const next = tags.filter((t) => t !== fromTag || fromTag === UNTAGGED);
  if (toTag !== UNTAGGED && !next.includes(toTag)) next.push(toTag);
  return next;
}

/** A card's new marker set when dragged onto the `toGlyph` column of a marker group: drop every
 *  member of that group the card currently carries, then add `toGlyph` (""=the "None" column → just
 *  clear the group). Markers outside the group are preserved. Pure — applied via `setNodeMarkers`. */
export function reMarkForMove(icons: string[], group: string, toGlyph: string): string[] {
  const members = new Set(MARKER_GROUPS.find((g) => g.id === group)?.members ?? []);
  const next = icons.filter((m) => !members.has(m));
  if (toGlyph && members.has(toGlyph)) next.push(toGlyph);
  return next;
}

// Schedule buckets, in board order. `test(due, today)` decides membership for a dated, unfinished task.
const SCHEDULE_BUCKETS: {
  key: string;
  label: string;
  test: (due: string, today: string) => boolean;
}[] = [
  { key: "overdue", label: "Overdue", test: (due, today) => due < today },
  { key: "today", label: "Today", test: (due, today) => due === today },
  {
    key: "week",
    label: "This week",
    test: (due, today) => due > today && due <= addDaysISO(today, 7),
  },
  { key: "later", label: "Later", test: (due, today) => due > addDaysISO(today, 7) },
];

/** The schedule bucket id a card lands in: "unscheduled" (no due, or a finished task), else the first
 *  matching date bucket. Also the drop target → the due date written for each bucket (see bucketDueDate). */
export function scheduleBucketOf(
  due: string | undefined,
  progress: number | undefined,
  today: string,
): string {
  if (!due || (progress ?? 0) >= 1) return "unscheduled";
  for (const b of SCHEDULE_BUCKETS) if (b.test(due, today)) return b.key;
  return "later";
}

/** The due date to write when a card is dropped on a schedule column (Overdue→yesterday, Today→today,
 *  This week→+3d, Later→+14d, Unscheduled→clear). Keeps the drop meaningful without a date picker. */
export function bucketDueDate(bucketKey: string, today: string): string | undefined {
  switch (bucketKey) {
    case "overdue":
      return addDaysISO(today, -1);
    case "today":
      return today;
    case "week":
      return addDaysISO(today, 3);
    case "later":
      return addDaysISO(today, 14);
    default:
      return undefined; // "unscheduled" → clear the due date
  }
}

/** Build the board's columns for a source. `today` (ISO) anchors the schedule buckets. Pure. */
export function buildBoard(doc: MindMapDoc, source: BoardSource, today: string): BoardColumn[] {
  const prog = new Map(progressMap(doc.root));
  for (const f of doc.floatingTopics ?? []) for (const [k, v] of progressMap(f)) prog.set(k, v);

  const cardOf = (n: MapNode): BoardCard => {
    const info = prog.get(n.id);
    return {
      id: n.id,
      topic: n.topic,
      progress: info ? toPercent(info.progress) : undefined,
      due: n.task?.due,
      tags: n.tags ?? [],
      icons: n.icons ?? [],
    };
  };

  const cols = new Map<string, BoardCard[]>();
  const push = (key: string, card: BoardCard) => {
    const list = cols.get(key);
    if (list) list.push(card);
    else cols.set(key, [card]);
  };

  const group =
    source.kind === "marker" ? MARKER_GROUPS.find((g) => g.id === source.group) : undefined;

  const walk = (n: MapNode) => {
    const card = cardOf(n);
    if (source.kind === "tag") {
      const tags = card.tags;
      if (tags.length === 0) push(UNTAGGED, card);
      else for (const t of new Set(tags)) push(t, card);
    } else if (source.kind === "marker" && group) {
      const member = card.icons.find((m) => group.members.includes(m));
      push(member ?? "", card); // ""=the "None" column
    } else if (source.kind === "schedule") {
      const info = prog.get(n.id);
      push(scheduleBucketOf(card.due, info?.progress, today), card);
    }
    for (const c of n.children) walk(c);
  };
  walk(doc.root);
  for (const f of doc.floatingTopics ?? []) walk(f);

  if (source.kind === "tag") {
    const tagged = [...cols.keys()]
      .filter((k) => k !== UNTAGGED)
      .sort(compareText)
      .map((tag) => ({ key: tag, label: tag, cards: cols.get(tag) ?? [] }));
    const untagged = cols.get(UNTAGGED);
    return untagged ? [...tagged, { key: UNTAGGED, label: "Untagged", cards: untagged }] : tagged;
  }
  if (source.kind === "marker" && group) {
    // One column per group member (in the group's order), then a trailing "None" column.
    const out: BoardColumn[] = group.members.map((glyph) => ({
      key: glyph,
      label: markerName(glyph) ?? glyph,
      cards: cols.get(glyph) ?? [],
    }));
    out.push({ key: "", label: "None", cards: cols.get("") ?? [] });
    return out;
  }
  // schedule: Unscheduled first, then the date buckets in order.
  const order = ["unscheduled", ...SCHEDULE_BUCKETS.map((b) => b.key)];
  const label = (k: string) =>
    k === "unscheduled" ? "Unscheduled" : (SCHEDULE_BUCKETS.find((b) => b.key === k)?.label ?? k);
  return order.map((k) => ({ key: k, label: label(k), cards: cols.get(k) ?? [] }));
}

/** Legacy tag-mode board (kept for callers/tests that predate the source selector). */
export function boardColumns(doc: MindMapDoc): BoardColumn[] {
  return buildBoard(doc, { kind: "tag" }, "");
}
