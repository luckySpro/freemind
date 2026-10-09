import type { MapNode, MindMapDoc } from "./model/types";
import { addDaysISO, isOverdue } from "./taskDate";

// Pure derivation behind the Agenda panel: a read-only, time-bucketed view of every dated, unfinished
// task in the map (root tree + floating topics). `today` is injected (ISO "YYYY-MM-DD") so the buckets
// stay deterministic and unit-tested; the panel passes todayISO(). Completed tasks (progress ≥ 1) and
// undated topics are excluded — the agenda is about what still needs doing and when.

export interface AgendaItem {
  id: string;
  topic: string;
  /** ISO "YYYY-MM-DD" due date. */
  due: string;
}

export interface AgendaBuckets {
  /** Past due and unfinished, oldest first. */
  overdue: AgendaItem[];
  /** Due today. */
  today: AgendaItem[];
  /** Due within the next 7 days (tomorrow … today+7), soonest first. */
  thisWeek: AgendaItem[];
  /** Due after today+7 (scheduled further out), soonest first — so future-dated work isn't dropped. */
  later: AgendaItem[];
}

/** Group the map's dated, unfinished tasks into overdue / today / this-week buckets. Pure. */
export function agendaBuckets(doc: MindMapDoc, today: string): AgendaBuckets {
  const overdue: AgendaItem[] = [];
  const dueToday: AgendaItem[] = [];
  const thisWeek: AgendaItem[] = [];
  const later: AgendaItem[] = [];
  const weekEnd = addDaysISO(today, 7);

  const visit = (n: MapNode) => {
    const due = n.task?.due;
    const progress = n.task?.progress;
    if (due && (progress ?? 0) < 1) {
      const item: AgendaItem = { id: n.id, topic: n.topic, due };
      if (isOverdue(due, progress, today)) overdue.push(item);
      else if (due === today) dueToday.push(item);
      else if (due <= weekEnd) thisWeek.push(item);
      else later.push(item); // due > today+7 — kept, not dropped
    }
    for (const c of n.children) visit(c);
  };
  visit(doc.root);
  for (const f of doc.floatingTopics ?? []) visit(f);

  const byDue = (a: AgendaItem, b: AgendaItem) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0);
  return {
    overdue: overdue.sort(byDue),
    today: dueToday.sort(byDue),
    thisWeek: thisWeek.sort(byDue),
    later: later.sort(byDue),
  };
}

/** True when no bucket carries anything — lets the panel show its empty state. */
export function agendaIsEmpty(b: AgendaBuckets): boolean {
  return (
    b.overdue.length === 0 &&
    b.today.length === 0 &&
    b.thisWeek.length === 0 &&
    b.later.length === 0
  );
}
