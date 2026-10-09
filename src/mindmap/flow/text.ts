// Text wrapping + width estimation shared by the SVG exporter and the layout size estimate. The live
// canvas wraps topic text via CSS (`max-width` + `white-space: pre-wrap`); the exporter emits native
// <text> and must reproduce that wrap so a long label stays inside its box (canvas == export), and the
// layout estimate must reserve the wrapped line count's height. Pure + deterministic.
//
// Every width heuristic here is a *character count times a constant* — there are no font metrics
// available (and deliberately so: real measureText would make export output machine-dependent and
// break the byte-identical export snapshots). That works while every character is about as wide as
// every other, which is true for alphabetic scripts and false for CJK. `widthUnits` is the fix: it
// keeps the character-count shape but counts a full-width glyph as the ~1.8 narrow characters it
// actually occupies.

/** Em-advance of a narrow character. Latin prose averages ~0.46em in the app's font stack; 0.55 errs
 *  deliberately wide so wrapped text stays inside the measured box. Measured against Cyrillic (0.52),
 *  Hebrew (0.51), Greek (0.49), Vietnamese (0.49), Thai (0.47) and Arabic (0.43) prose — every
 *  alphabetic script sits under this bound, so one narrow class covers them all. */
const NARROW_EM = 0.55;

/** Em-advance of a full-width character. CJK ideographs, kana, Hangul and fullwidth forms all measure
 *  exactly 1.000em — nearly double NARROW_EM, which is why treating them as narrow overflowed CJK text
 *  past its box by 38-75% and under-reserved its height by ~2x. */
const WIDE_EM = 1;

/** Em-advance of an emoji presentation glyph (measured 1.373em — wider than CJK). The app emits emoji
 *  into export chips ("📅 12 Mar", "📎 3") and topic markers, where a surrogate pair used to count as
 *  two narrow characters (1.10em) against a real 1.373em. */
const EMOJI_EM = 1.373;

/** The em-advance to charge a single code point. */
function emAdvance(cp: number): number {
  // Emoji & pictographs — wider than CJK, and (as surrogate pairs) previously double-counted.
  if (cp >= 0x1f000 && cp <= 0x1faff) return EMOJI_EM;
  if (
    (cp >= 0x1100 && cp <= 0x115f) || // Hangul jamo
    (cp >= 0x2e80 && cp <= 0x303e) || // CJK radicals, Kangxi, CJK symbols & punctuation
    (cp >= 0x3041 && cp <= 0x33ff) || // kana, Bopomofo, Hangul compatibility jamo, CJK compatibility
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK extension A
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK unified ideographs
    (cp >= 0xa000 && cp <= 0xa4cf) || // Yi
    (cp >= 0xac00 && cp <= 0xd7a3) || // Hangul syllables
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK compatibility ideographs
    (cp >= 0xfe30 && cp <= 0xfe4f) || // CJK compatibility forms
    (cp >= 0xff00 && cp <= 0xff60) || // fullwidth forms
    (cp >= 0xffe0 && cp <= 0xffe6) || // fullwidth signs
    (cp >= 0x20000 && cp <= 0x3fffd) // CJK extension B and beyond
  )
    return WIDE_EM;
  return NARROW_EM;
}

/** `text`'s width expressed in NARROW-character equivalents: a Latin/Cyrillic/Arabic character counts
 *  1, a CJK character ~1.82, an emoji ~2.50. Iterates by CODE POINT, so a surrogate pair counts once
 *  rather than twice.
 *
 *  Drop-in for `text.length` at any site that estimates width as `characters * constant`: pure-ASCII
 *  input returns exactly `text.length`, so every existing Latin calibration — and the byte-identical
 *  export snapshots that pin it — is unchanged, while wide scripts finally scale. */
export function widthUnits(text: string): number {
  let units = 0;
  for (const ch of text) units += emAdvance(ch.codePointAt(0) ?? 0) / NARROW_EM;
  return units;
}

/** The longest prefix of `s` (whole code points) fitting `maxUnits`, always at least one glyph so a
 *  caller can't loop forever on an unsplittable character. Never splits a surrogate pair. */
function takeUnits(s: string, maxUnits: number): string {
  let units = 0;
  let end = 0;
  for (const ch of s) {
    const next = units + emAdvance(ch.codePointAt(0) ?? 0) / NARROW_EM;
    if (end > 0 && next > maxUnits) break;
    units = next;
    end += ch.length;
  }
  return s.slice(0, end);
}

/** Word-wrap `text` to fit `maxWidth` px at `fontSize`, using the per-script advance estimate above
 *  (no font metrics available). Splits on explicit newlines first; a single word longer than the line
 *  is hard-split. Returns at least one (possibly empty) line. */
export function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const charW = fontSize * NARROW_EM;
  const maxUnits = Math.max(1, Math.floor(maxWidth / charW));
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      let w = word;
      // Hard-split a word that can't fit on a line by itself. CJK and Thai have no inter-word spaces,
      // so a whole sentence arrives as one "word" and lands here — breaking it is what a browser does
      // for CJK too, and it now breaks at the real glyph width instead of a raw character count.
      while (widthUnits(w) > maxUnits) {
        const head = takeUnits(w, maxUnits);
        if (head.length === w.length) break; // one glyph wider than the whole line — leave it be
        if (line) {
          out.push(line);
          line = "";
        }
        out.push(head);
        w = w.slice(head.length);
      }
      const candidate = line ? `${line} ${w}` : w;
      if (widthUnits(candidate) <= maxUnits) line = candidate;
      else {
        if (line) out.push(line);
        line = w;
      }
    }
    if (line) out.push(line);
  }
  return out.length > 0 ? out : [""];
}
