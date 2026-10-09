import type { DueMode } from "./filter";

// A small operator/scope grammar for the search box, so a query can target *fields* — not just free
// text. Pure + unit-tested; the search runner (src/search.ts) consumes a ParsedQuery and matches
// nodes against it. Backward-compatible: a query with no operators / quotes / exclusions parses to a
// single free-text term and the caller keeps its original (fuzzy-capable) substring behaviour.

/** A node field that `has:` can require to be present. */
export type HasField = "note" | "attachment" | "link" | "task" | "image";

export interface ParsedQuery {
  /** Free-text substrings that must ALL appear in the node's searchable text (case-insensitive). */
  include: string[];
  /** Substrings that must NOT appear (the `-term` / `-"phrase"` exclusions). */
  exclude: string[];
  /** Node must carry at least one of these tags (`tag:foo`). */
  tags: string[];
  /** Node must carry at least one of these markers (`marker:` / `icon:`). */
  markers: string[];
  /** task.priority must equal this (`priority:N`, 1..9). */
  priority?: number;
  /** Due-date mode (`due:dated|overdue|soon`). */
  due?: DueMode;
  /** Node must have ALL of these fields present (`has:note|attachment|link|task|image`). */
  has: HasField[];
  /** Depth bounds — root = level 0 (`level:N`, `level:>=N`, `level:<=N`, `level:>N`, `level:<N`). */
  minLevel?: number;
  maxLevel?: number;
  /** True once any operator / exclusion / quoted phrase appears — the caller then switches from the
   *  plain single-substring (fuzzy) path to structured, field-aware matching. */
  scoped: boolean;
}

const DUE_MODES = new Set<DueMode>(["dated", "overdue", "soon"]);
const HAS_FIELDS = new Set<HasField>(["note", "attachment", "link", "task", "image"]);

// One token = an optional leading "-" (exclude), an optional "key:" prefix, then either a
// "quoted phrase" or a run of non-space, non-quote characters.
const TOKEN_RE = /(-)?(?:([a-zA-Z]+):)?(?:"([^"]*)"|([^\s"]+))/g;

/** Apply a `level:` expression (`N`, `>=N`, `<=N`, `>N`, `<N`) to the parsed bounds. Returns false
 *  when the value isn't a recognised level expression (so the caller can treat it as literal text). */
function applyLevel(out: ParsedQuery, value: string): boolean {
  const m = /^(>=|<=|>|<)?(\d+)$/.exec(value);
  if (!m) return false;
  const op = m[1] ?? "";
  const n = Number.parseInt(m[2], 10);
  if (op === ">=") out.minLevel = n;
  else if (op === ">") out.minLevel = n + 1;
  else if (op === "<=") out.maxLevel = n;
  else if (op === "<") out.maxLevel = n - 1;
  else {
    out.minLevel = n;
    out.maxLevel = n;
  }
  return true;
}

/** Parse a raw search string into structured, field-aware criteria. Pure + deterministic. */
export function parseQuery(query: string): ParsedQuery {
  const out: ParsedQuery = {
    include: [],
    exclude: [],
    tags: [],
    markers: [],
    has: [],
    scoped: false,
  };
  for (const m of query.matchAll(TOKEN_RE)) {
    const [literal, neg, rawKey, quoted, bare] = m;
    const raw = quoted ?? bare;
    if (raw === undefined) continue; // matched nothing usable
    const value = raw.trim();
    if (quoted !== undefined) out.scoped = true; // an explicit phrase is itself an operator
    if (neg) {
      out.scoped = true;
      if (value) out.exclude.push(value.toLowerCase());
      continue;
    }
    const key = rawKey?.toLowerCase();
    // For an unrecognised operator we fall back to matching the whole token literally.
    const asLiteral = () => out.include.push(literal.toLowerCase());
    switch (key) {
      case "tag":
        out.scoped = true;
        if (value) out.tags.push(value.toLowerCase());
        break;
      case "marker":
      case "icon":
        out.scoped = true;
        if (value) out.markers.push(value.toLowerCase());
        break;
      case "priority":
      case "p": {
        const n = Number.parseInt(value, 10);
        if (n >= 1 && n <= 9) {
          out.scoped = true;
          out.priority = n;
        } else asLiteral();
        break;
      }
      case "due":
        if (DUE_MODES.has(value.toLowerCase() as DueMode)) {
          out.scoped = true;
          out.due = value.toLowerCase() as DueMode;
        } else asLiteral();
        break;
      case "has":
        if (HAS_FIELDS.has(value.toLowerCase() as HasField)) {
          out.scoped = true;
          out.has.push(value.toLowerCase() as HasField);
        } else asLiteral();
        break;
      case "level":
      case "depth":
        if (applyLevel(out, value)) out.scoped = true;
        else asLiteral();
        break;
      default:
        // No key (plain word) or an unknown key → free-text term, matched as typed.
        if (value) out.include.push((key ? literal : value).toLowerCase());
    }
  }
  return out;
}
