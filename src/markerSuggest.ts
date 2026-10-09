// Suggest markers from a topic's text — lightweight smart-tagging cues (MindManager-ish). Opt-in: the
// inspector shows the suggestions as chips; the user clicks to apply. Pure + deterministic, so the
// rules are unit-tested. Each rule maps a word/symbol cue to a marker glyph already in the catalogue.

interface Cue {
  marker: string;
  /** Matches the (lower-cased) topic text. */
  test: RegExp;
}

const CUES: readonly Cue[] = [
  { marker: "✅", test: /\b(done|complete[d]?|finished|resolved)\b/ },
  { marker: "❗", test: /(!|\b(urgent|important|asap|critical|priority)\b)/ },
  { marker: "❓", test: /(\?|\b(why|how|unclear|tbd|question)\b)/ },
  { marker: "🚩", test: /\b(risk|blocker|blocked|flag|review)\b/ },
  { marker: "💡", test: /\b(idea|maybe|consider|suggestion|brainstorm)\b/ },
  { marker: "🎯", test: /\b(goal|objective|target|aim)\b/ },
  { marker: "⏳", test: /\b(later|pending|wait(ing)?|someday|backlog)\b/ },
];

/** Marker glyphs suggested by a topic's text (deduped, in cue order). Empty when nothing matches. */
export function suggestMarkers(topic: string): string[] {
  const t = topic.toLowerCase();
  const out: string[] = [];
  for (const c of CUES) if (c.test.test(t) && !out.includes(c.marker)) out.push(c.marker);
  return out;
}

/** Suggested markers a topic doesn't already carry — what the inspector actually offers. Pure. */
export function suggestNewMarkers(topic: string, existing: readonly string[] = []): string[] {
  return suggestMarkers(topic).filter((m) => !existing.includes(m));
}
