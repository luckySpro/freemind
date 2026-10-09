import type { MapNode, MindMapDoc } from "./model/types";
import { progressMap } from "./progress";
import { type HasField, type ParsedQuery, parseQuery } from "./queryParser";
import { isDueSoon, isOverdue, todayISO } from "./taskDate";

// Every searchable surface of a node, joined into one lowercased haystack. Topic + note are the
// primary content; tags, marker (icon) ids, the hyperlink, callout bubbles, attachment filenames,
// and task resources are searchable too — so Find reaches a node by anything it actually carries.
export const searchableText = (node: MapNode): string =>
  [
    node.topic,
    node.note ?? "",
    ...(node.tags ?? []),
    ...(node.icons ?? []),
    node.hyperlink ?? "",
    ...(node.hyperlinks ?? []),
    ...(node.callouts?.map((c) => c.text) ?? []),
    ...(node.attachments?.map((a) => a.name) ?? []),
    ...(node.task?.resources ?? []),
  ]
    .join(" ")
    .toLowerCase();

const matchesQuery = (node: MapNode, q: string): boolean => searchableText(node).includes(q);

// Levenshtein edit distance, bounded: returns early (as max + 1) once the best possible exceeds
// `max`, so a no-match is cheap. Pure.
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      curr.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1; // whole row already worse than the budget
    prev = curr;
  }
  return prev[b.length];
}

/** Typo-tolerant match: an exact substring, OR the query within a small edit distance of a word
 *  in the text. The distance budget scales with query length (short queries stay strict). Pure. */
export function fuzzyHit(text: string, q: string): boolean {
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  const max = q.length <= 5 ? 1 : 2;
  return t.split(/\s+/).some((w) => w.length > 0 && editDistance(w, q, max) <= max);
}

const matchesFuzzy = (node: MapNode, q: string): boolean => fuzzyHit(searchableText(node), q);

const roots = (doc: MindMapDoc): MapNode[] => [doc.root, ...(doc.floatingTopics ?? [])];

// Effective (rolled-up) completion per node id — so a "done" parent isn't reported as overdue. Only
// built when a due-date scope actually needs it.
const buildProgress = (doc: MindMapDoc): Map<string, number | undefined> => {
  const prog = new Map<string, number | undefined>();
  for (const root of roots(doc)) for (const [k, v] of progressMap(root)) prog.set(k, v.progress);
  return prog;
};

const hasField = (n: MapNode, f: HasField): boolean => {
  switch (f) {
    case "note":
      return !!n.note?.trim();
    case "attachment":
      return !!n.attachments?.length;
    case "link":
      return !!n.hyperlink || !!n.hyperlinks?.length;
    case "task":
      return !!n.task;
    case "image":
      return !!n.image;
  }
};

// Does a node satisfy a structured (operator) query at the given depth (root = 0)? Free terms are
// AND'd substrings of the searchable haystack; tag/marker are OR-within / AND-across; has/level/due/
// priority are hard gates. `today` + `progress` are only consulted for due:overdue / due:soon. Pure.
function nodeMatchesParsed(
  n: MapNode,
  p: ParsedQuery,
  depth: number,
  today: string,
  progress: number | undefined,
): boolean {
  const hay = searchableText(n);
  if (p.include.some((t) => !hay.includes(t))) return false;
  if (p.exclude.some((t) => hay.includes(t))) return false;
  if (p.tags.length && !p.tags.some((t) => n.tags?.some((x) => x.toLowerCase() === t)))
    return false;
  if (p.markers.length && !p.markers.some((mk) => n.icons?.some((x) => x.toLowerCase() === mk)))
    return false;
  if (p.priority !== undefined && n.task?.priority !== p.priority) return false;
  if (p.has.some((f) => !hasField(n, f))) return false;
  if (p.due === "dated" && !n.task?.due) return false;
  if (p.due === "overdue" && !isOverdue(n.task?.due, progress, today)) return false;
  if (p.due === "soon" && !isDueSoon(n.task?.due, progress, today)) return false;
  if (p.minLevel !== undefined && depth < p.minLevel) return false;
  if (p.maxLevel !== undefined && depth > p.maxLevel) return false;
  return true;
}

// Visit every node of a doc (central tree + floating topics, each rooted at depth 0) that satisfies a
// structured query, in DFS order. The progress map is built lazily — only when a due scope needs it.
function eachScopedMatch(
  doc: MindMapDoc,
  p: ParsedQuery,
  today: string,
  cb: (n: MapNode, ancestors: string[]) => void,
): void {
  const prog = p.due === "overdue" || p.due === "soon" ? buildProgress(doc) : null;
  const walk = (n: MapNode, depth: number, ancestors: string[]) => {
    if (nodeMatchesParsed(n, p, depth, today, prog?.get(n.id))) cb(n, ancestors);
    for (const c of n.children) walk(c, depth + 1, [...ancestors, n.topic]);
  };
  for (const root of roots(doc)) walk(root, 0, []);
}

// Find node ids whose searchable text contains the query (case-insensitive), in depth-first
// order. The haystack is every surface a node carries — topic, note, tags, markers, hyperlink,
// callouts, attachment names, task resources (see searchableText) — so Find reaches a node by
// anything on it. Pure + deterministic so it's unit-testable; the UI cycles through the returned
// ids and focuses each on the canvas.
export function findMatches(
  root: MapNode,
  query: string,
  match: (node: MapNode, q: string) => boolean = matchesQuery,
): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const ids: string[] = [];
  const walk = (node: MapNode) => {
    if (match(node, q)) ids.push(node.id);
    for (const child of node.children) walk(child);
  };
  walk(root);
  return ids;
}

/** A single-map match with enough context to list it: the node, its topic, the ancestor breadcrumb,
 *  and a note snippet when the match isn't in the topic. The in-map Find list renders these. */
export interface NodeHit {
  nodeId: string;
  topic: string;
  /** Ancestor topics from the root down to the match's parent (empty for a root / floating topic). */
  path: string[];
  /** A short slice of the note around the query, when the match landed in the note (not the topic). */
  snippet?: string;
}

const hitOf = (n: MapNode, ancestors: string[], q: string): NodeHit => ({
  nodeId: n.id,
  topic: n.topic,
  path: ancestors,
  snippet: n.topic.toLowerCase().includes(q) ? undefined : noteSnippet(n.note, q),
});

// Walk a doc (central tree + floating topics) collecting rich hits for nodes the predicate accepts,
// threading the ancestor breadcrumb, in DFS order.
function plainHits(
  doc: MindMapDoc,
  match: (n: MapNode, q: string) => boolean,
  q: string,
): NodeHit[] {
  const hits: NodeHit[] = [];
  const walk = (n: MapNode, ancestors: string[]) => {
    if (match(n, q)) hits.push(hitOf(n, ancestors, q));
    for (const c of n.children) walk(c, [...ancestors, n.topic]);
  };
  for (const root of roots(doc)) walk(root, []);
  return hits;
}

// Find matches across a whole map — the central tree AND floating topics — as rich hits (topic +
// breadcrumb + snippet). A query carrying operators (tag:/marker:/priority:/due:/has:/level:/-exclude/
// "phrase") matches the structured, field-aware way; a plain query keeps the historical behaviour:
// exact (substring) first, then — when long enough and empty-handed — a typo-tolerant fuzzy pass.
// DFS order. `today` is injected so due-date scopes stay deterministic.
export function findDocHits(doc: MindMapDoc, query: string, today = todayISO()): NodeHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const parsed = parseQuery(query);
  if (parsed.scoped) {
    const hits: NodeHit[] = [];
    eachScopedMatch(doc, parsed, today, (n, ancestors) => hits.push(hitOf(n, ancestors, q)));
    return hits;
  }
  const exact = plainHits(doc, matchesQuery, q);
  if (exact.length > 0 || q.length < 4) return exact;
  return plainHits(doc, matchesFuzzy, q);
}

// The node ids of every in-map match, in DFS order — the cycler's source of truth (the list uses the
// richer findDocHits). Kept as a thin projection so the two surfaces can't drift in order or membership.
export function findDocMatches(doc: MindMapDoc, query: string, today = todayISO()): string[] {
  return findDocHits(doc, query, today).map((h) => h.nodeId);
}

/** A library-wide search hit: a single-node hit (topic + breadcrumb + snippet) tagged with its map. */
export interface LibraryHit extends NodeHit {
  mapId: string;
  mapTitle: string;
}

// A ~60-char window of the note centred on the first occurrence of the (plain-text) query, ellipsised
// at each clipped end. Returns undefined when the query isn't a literal substring of the note (a scoped
// or fuzzy hit, or a topic-only match) — so the snippet only ever shows genuine, locatable context.
function noteSnippet(note: string | undefined, q: string): string | undefined {
  if (!note) return undefined;
  const i = note.toLowerCase().indexOf(q);
  if (i < 0) return undefined;
  const start = Math.max(0, i - 30);
  const end = Math.min(note.length, i + q.length + 30);
  return `${start > 0 ? "…" : ""}${note.slice(start, end).trim()}${end < note.length ? "…" : ""}`;
}

// Search every map's nodes — the central tree AND floating topics — for the query across all
// their searchable text (see searchableText), returning hits with enough context to navigate to
// them. Pure + unit-tested; the UI loads the library, filters with this, and jumps to the chosen
// map/node.
export function searchLibrary(docs: MindMapDoc[], query: string, today = todayISO()): LibraryHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const parsed = parseQuery(query);
  // A library hit is a single-node hit (topic + breadcrumb + snippet) tagged with its map.
  const mk = (doc: MindMapDoc, n: MapNode, ancestors: string[]): LibraryHit => ({
    mapId: doc.id,
    mapTitle: doc.title,
    ...hitOf(n, ancestors, q),
  });
  if (parsed.scoped) {
    const hits: LibraryHit[] = [];
    for (const doc of docs)
      eachScopedMatch(doc, parsed, today, (n, ancestors) => hits.push(mk(doc, n, ancestors)));
    return hits;
  }
  const collect = (match: (node: MapNode, q: string) => boolean): LibraryHit[] => {
    const hits: LibraryHit[] = [];
    for (const doc of docs) {
      const walk = (node: MapNode, ancestors: string[]) => {
        if (match(node, q)) hits.push(mk(doc, node, ancestors));
        for (const child of node.children) walk(child, [...ancestors, node.topic]);
      };
      for (const root of roots(doc)) walk(root, []);
    }
    return hits;
  };
  const exact = collect(matchesQuery);
  // Same exact-then-fuzzy fallback as in-map Find.
  if (exact.length > 0 || q.length < 4) return exact;
  return collect(matchesFuzzy);
}

// Case-insensitive replace of every occurrence of `query` within `topic`.
// Pure + unit-tested; the canvas applies the result to each matching node.
export function replaceInTopic(topic: string, query: string, replacement: string): string {
  const q = query.trim();
  if (!q) return topic;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return topic.replace(new RegExp(escaped, "gi"), replacement);
}
