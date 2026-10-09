// Name-based link autocomplete for the inline topic editor: type `[[` (wiki-link) or `@` (mention) and
// pick a topic/map by name to author a link. Like the slash menu, the fiddly parts — detecting the
// trigger token at the caret and rewriting the buffer on select — are pure functions here so they're
// unit-tested; TopicNode owns the DOM caret + popup, FlowMindMap owns the candidate list + link op.

export interface LinkCandidate {
  /** Node id (kind "node") or map id (kind "map"). */
  id: string;
  /** Display name shown in the menu + inserted into the topic text on select. */
  label: string;
  /** The hyperlink to attach: `#node=<id>` for a topic, `#map=<id>` for a map. */
  link: string;
  kind: "node" | "map";
}

export interface LinkTrigger {
  kind: "wiki" | "mention";
  /** Text between the trigger and the caret (the live query). */
  query: string;
  /** Index in the text where the replaceable token starts (the first `[` or the `@`). */
  start: number;
  /** Index where the token ends (the caret). */
  end: number;
}

/** Detect a link-authoring token ending at `caret`: `[[query` (wiki) or `@query` (mention). Returns the
 *  token nearest the caret, or null. A wiki token is an unclosed `[[` (no `]]` after it); a mention is
 *  an `@` at a word boundary (line start or after whitespace). Neither may span a newline. */
export function linkTriggerAt(text: string, caret: number): LinkTrigger | null {
  const before = text.slice(0, Math.max(0, Math.min(caret, text.length)));
  const end = before.length;

  let wiki: LinkTrigger | null = null;
  const wikiOpen = before.lastIndexOf("[[");
  if (wikiOpen !== -1) {
    const seg = before.slice(wikiOpen + 2);
    if (!seg.includes("]]") && !seg.includes("\n") && !seg.includes("[["))
      wiki = { kind: "wiki", query: seg, start: wikiOpen, end };
  }

  let mention: LinkTrigger | null = null;
  const atPos = before.lastIndexOf("@");
  if (atPos !== -1) {
    const prev = atPos === 0 ? "" : before[atPos - 1];
    const seg = before.slice(atPos + 1);
    if ((atPos === 0 || /\s/.test(prev)) && !seg.includes("\n"))
      mention = { kind: "mention", query: seg, start: atPos, end };
  }

  // Whichever token starts nearer the caret is the one the user is actively inside.
  if (wiki && mention) return wiki.start >= mention.start ? wiki : mention;
  return wiki ?? mention;
}

/** Rewrite the buffer for a selected candidate: replace the trigger token `[start, end)` with `label`.
 *  Returns the new text and the caret position (just after the inserted label). Takes any trigger with
 *  a `{start,end}` range (a LinkTrigger or a TagTrigger — the latter passes "" to strip its token). */
export function applyLinkSelection(
  text: string,
  trigger: { start: number; end: number },
  label: string,
): { text: string; caret: number } {
  const next = text.slice(0, trigger.start) + label + text.slice(trigger.end);
  return { text: next, caret: trigger.start + label.length };
}

/** Candidates matching `query` (case-insensitive substring on the label), capped at `limit`. An empty
 *  query lists the first `limit`; a query matching nothing returns [] (the caller closes the menu). */
export function matchLinkCandidates(
  candidates: LinkCandidate[],
  query: string,
  limit = 8,
): LinkCandidate[] {
  const q = query.trim().toLowerCase();
  const pool = q ? candidates.filter((c) => c.label.toLowerCase().includes(q)) : candidates;
  return pool.slice(0, limit);
}

// ── Inline #tag accelerator ──────────────────────────────────────────────────
// Typing `#word` in the topic editor pops a tag picker; choosing (or Enter-ing) assigns the tag as
// metadata and strips the `#word` token from the title. Same pure-detection / DOM-in-TopicNode split
// as the link autocomplete above.

/** A live `#query` token ending at the caret — `start`/`end` bracket the `#…` to strip on select. */
export interface TagTrigger {
  query: string;
  start: number;
  end: number;
}

/** Detect a `#tag` token ending at `caret`: a `#` at a word boundary (line start or after whitespace)
 *  followed by tag chars (letters, digits, `-`, `_`) up to the caret. Returns null when there's no `#`
 *  at the caret's word, or the run has a space / newline (a tag is a single word). */
export function tagTriggerAt(text: string, caret: number): TagTrigger | null {
  const before = text.slice(0, Math.max(0, Math.min(caret, text.length)));
  const hashPos = before.lastIndexOf("#");
  if (hashPos === -1) return null;
  const prev = hashPos === 0 ? "" : before[hashPos - 1];
  if (!(hashPos === 0 || /\s/.test(prev))) return null; // `#` must start a word (not mid-word like a1#b)
  const seg = before.slice(hashPos + 1);
  if (!/^[\w-]*$/.test(seg)) return null; // only tag chars between the `#` and the caret
  return { query: seg, start: hashPos, end: before.length };
}

/** Tag suggestions for `query`: existing tags matching (case-insensitive substring), plus — when the
 *  trimmed query is a non-empty new tag not already listed — a "create" row for it (prefixed with `+`
 *  so the caller can show it as "add new"). Capped at `limit`. */
export function matchTagCandidates(existing: string[], query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of existing) {
    if (out.length >= limit) break;
    if (q && !t.toLowerCase().includes(q)) continue;
    if (seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  const trimmed = query.trim();
  if (trimmed && !seen.has(trimmed.toLowerCase())) out.unshift(trimmed); // offer to create the typed tag
  return out.slice(0, limit);
}
