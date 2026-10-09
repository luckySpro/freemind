import type { MapNode, MindMapDoc } from "./model/types";
import { isOverdue, todayISO } from "./taskDate";

// Map statistics: a one-pass, pure summary of a map for the Map-stats panel — topic counts, depth,
// task health, and content tallies. No DOM coupling; the panel just renders the numbers. `today`
// (ISO) anchors the overdue tally — defaulted so callers needn't thread it, overridable for tests.

export interface MapStats {
  /** Topics in the central hierarchy (including the root). */
  topics: number;
  /** Detached/floating topics (not part of the central tree). */
  floating: number;
  /** Deepest level below the root (root = 0). */
  maxDepth: number;
  /** Leaf topics (no children) in the central tree. */
  leaves: number;
  /** Topics carrying a task (any task field set). */
  tasks: number;
  /** Tasks at 100% completion. */
  completed: number;
  /** Tasks past their due date and not finished. */
  overdue: number;
  /** Overall task completion 0..1 (completed / tasks), or 0 when there are no tasks. */
  completion: number;
  /** Topics with a non-empty note. */
  notes: number;
  /** Total attached files across all topics. */
  attachments: number;
  /** Distinct tags used anywhere in the map. */
  tags: number;
  /** Distinct marker icons used anywhere in the map. */
  markers: number;
  /** Relationship (cross-link) edges. */
  links: number;
  /** Boundary enclosures. */
  boundaries: number;
  /** Total words across every topic title + note (the map's reading load). */
  words: number;
  /** Estimated reading time in minutes (words ÷ 200, rounded up; 0 for an empty map). */
  readingMinutes: number;
}

/** Whitespace-delimited word count of a string (empty/blank → 0). Pure. */
export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Compute a map's statistics in a single walk of the central tree (+ scalar doc tallies). Pure. */
export function mapStats(doc: MindMapDoc, today: string = todayISO()): MapStats {
  let topics = 0;
  let maxDepth = 0;
  let leaves = 0;
  let tasks = 0;
  let completed = 0;
  let overdue = 0;
  let notes = 0;
  let attachments = 0;
  let words = 0;
  const tags = new Set<string>();
  const markers = new Set<string>();

  const walk = (n: MapNode, depth: number) => {
    topics++;
    if (depth > maxDepth) maxDepth = depth;
    if (n.children.length === 0) leaves++;
    if (n.note?.trim()) notes++;
    words += countWords(n.topic) + countWords(n.note ?? "");
    attachments += n.attachments?.length ?? 0;
    for (const t of n.tags ?? []) tags.add(t);
    for (const ic of n.icons ?? []) markers.add(ic);
    if (n.task) {
      tasks++;
      if ((n.task.progress ?? 0) >= 1) completed++;
      if (isOverdue(n.task.due, n.task.progress, today)) overdue++;
    }
    for (const c of n.children) walk(c, depth + 1);
  };
  walk(doc.root, 0);

  return {
    topics,
    floating: doc.floatingTopics?.length ?? 0,
    maxDepth,
    leaves,
    tasks,
    completed,
    overdue,
    completion: tasks > 0 ? completed / tasks : 0,
    notes,
    attachments,
    tags: tags.size,
    markers: markers.size,
    links: doc.links?.length ?? 0,
    boundaries: doc.boundaries?.length ?? 0,
    words,
    readingMinutes: Math.ceil(words / 200),
  };
}
