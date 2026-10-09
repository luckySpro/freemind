// The detectors behind the hardcoded-user-facing-string guard, in ONE place.
//
// Both `test/i18n-no-hardcoded-strings.test.ts` (which enforces them over the migrated allowlist) and
// `scripts/i18n-scan.mjs` (which reports them for any file, so the next migration can see its worklist)
// import from here. They were briefly two copies of the same regexes; a copy silently lost a `\\s` and
// reported zero `label=` hits on a file that had sixty, which is precisely the kind of quiet wrong
// answer this guard exists to prevent. One source of truth for a cross-cutting rule.
//
// Each detector is narrow on purpose and tuned for NO false positives: a noisy guard gets switched off,
// which is worse than a narrow one. When one fires, the fix is to move the string into a catalogue — not
// to widen the exceptions. If a genuinely non-user-facing string trips it, narrow the check.

/** Props whose value is read by a user or a screen reader. `label` covers both the menu components in
 *  `Toolbar.tsx` (`<MenuItem label="Fit map to screen">`) and the DOM's own `<optgroup label>`; leaving
 *  it out hid 60 menu labels in a file the allowlist already called migrated.
 *
 *  The camelCase entries are THIS codebase's own component props, not DOM attributes — `<Menu
 *  triggerTitle="Export">`. A detector that only knows DOM attribute names is blind to every custom
 *  component a codebase defines, which hid 18 more menu labels in files the allowlist called clean. */
export const USER_FACING_PROPS = [
  "title",
  "aria-label",
  "placeholder",
  "alt",
  "label",
  "ariaLabel",
  "triggerTitle",
  "triggerAriaLabel",
  "menuAriaLabel",
  "labelText",
  "tooltipText",
];

/** Values that are legitimately literal: DOM/ARIA plumbing rather than prose. */
export const ALLOWED_LITERALS = new Set([
  "true",
  "false",
  "none",
  "off",
  "on",
  "polite",
  "assertive",
]);

const isComment = (line) => /^\s*(\/\/|\/\*|\*)/.test(line);

// Which lines sit inside a comment, tracked ACROSS lines.
//
// `isComment` above is per-line, and that is not enough for the multi-line JSX block comments this
// codebase is full of: the opener is a brace-slash-star, but the CONTINUATION lines open with prose
// rather than with a star. The bare-prose detector read those continuations as JSX copy and reported a
// false positive in FlowMindMap.tsx. A false positive is the one failure this guard cannot afford — it
// trains people to ignore the output — so the fix is to narrow the check, not to except the file.
//
// A block only OPENS on a block-comment opener that STARTS its line (optionally behind the JSX brace).
// Requiring that keeps an opener sitting inside a string literal — a URL, a regex — from starting a
// phantom block that would silently swallow every line until the next closer and hide real strings.
//
// (Written with line comments rather than a doc comment on purpose: the delimiters it has to talk
// about cannot be quoted inside a block comment without ending it.)
function commentLineSet(src) {
  const inComment = new Set();
  let inBlock = false;
  src.split("\n").forEach((line, i) => {
    if (inBlock) {
      inComment.add(i);
      if (line.includes("*/")) inBlock = false;
      return;
    }
    if (/^\s*\{?\s*\/\*/.test(line)) {
      inComment.add(i);
      // A single-line `/* … */` opens and closes on the same line; only a dangling opener continues.
      if (!line.includes("*/")) inBlock = true;
      return;
    }
    if (isComment(line)) inComment.add(i);
  });
  return inComment;
}

/** A literal in a user-facing prop — `title="Save"` instead of `title={t("…")}`. */
export function propViolations(src) {
  const out = [];
  src.split("\n").forEach((line, i) => {
    for (const prop of USER_FACING_PROPS) {
      // Only a double-quoted literal: the `{t(...)}` form has a brace, not a quote, after the `=`.
      const m = new RegExp(`(?:^|\\s)${prop}="([^"]{2,})"`).exec(line);
      if (!m) continue;
      const value = m[1];
      if (ALLOWED_LITERALS.has(value.toLowerCase())) continue;
      // An INTERPOLATION is not a literal. The exporters build HTML inside template literals, so
      // `aria-label="${escapeHtml(t("io.deck.slides"))}"` is already migrated — but the regex above
      // stops at the first `"`, which here is the one inside `t("…`, leaving a truncated value that
      // looks like a literal. Skipping any value containing `${` is safe: a genuine JSX literal cannot
      // contain one, and a JSX prop that IS a template is caught by the template rule below.
      if (value.includes("${")) continue;
      out.push({ line: i + 1, text: `${prop}="${value}"`, why: "user-facing prop is a literal" });
    }

    // The TEMPLATE form of the same defect: title={`Apply "${s.name}"`}.
    //
    // `templateViolations` cannot catch these. It looks for prose — a capitalised word followed by a
    // lowercase word — which `Apply "${…}"` and `${ariaLabel}: pick from calendar` never match once
    // the interpolations are blanked. That rule has to be conservative because a template can hold
    // anything; here we are anchored on the PROP NAME, which already says the value is read by a user,
    // so any real words in the static parts are enough. Measured: this is 7 of the strings that were
    // sitting inside allowlisted files, including `Rename / merge "${key}" — type an existing tag
    // name to merge`, whose own sibling `aria-label` on the same element is already a `t()` call.
    for (const prop of USER_FACING_PROPS) {
      const m = new RegExp(`(?:^|\\s)${prop}=\\{\`([^\`]*)\``).exec(line);
      if (!m) continue;
      const statics = m[1].replace(/\$\{[^}]*\}/g, " ");
      // Two consecutive letters somewhere outside the interpolations. `title={`${n}%`}` is data.
      if (!/\p{Letter}{2,}/u.test(statics)) continue;
      // A MACHINE-TOKEN CHEATSHEET is not prose. The search box's tooltip is
      // `${t("search.operatorsHelp")}\ntag:foo  marker:flag-red  priority:1  due:overdue …` — the
      // sentence is already a message and the rest is query syntax the user TYPES, so translating it
      // would break the feature. Same reasoning that keeps physical key names literal. Two or more
      // `word:value` tokens with no space after the colon is the signature; a colon followed by a
      // space is ordinary punctuation (`Relationship: ${label}`) and still gets caught.
      if ((statics.match(/\b[a-z]+:[^\s]/g) ?? []).length >= 2) continue;
      if (ALLOWED_LITERALS.has(statics.trim().toLowerCase())) continue;
      out.push({
        line: i + 1,
        text: `${prop}={\`${m[1]}\`}`,
        why: "user-facing prop is a template literal",
      });
    }
  });
  return out;
}

/** A prose string passed as a positional ARGUMENT — `add("open-file", "Open file…", "map", run)`, or a
 *  tuple member like `["json", ".json (lossless)", fn]`. Nothing names these, so the prop detector can't
 *  see them and the prose detector skips the line for having code punctuation. This was a real blind
 *  spot: adding `editorCommands.ts` to the allowlist made it PASS with ~85 labels still hardcoded.
 *
 *  Rule: a capitalised multi-word literal sitting in an argument position (preceded by `(` or `,`, or
 *  alone on its own line because prettier wrapped the call), or in a ternary arm.
 *  Deliberately NOT triggered by an object property — `keys: "Ctrl/⌘ + Z"` in shortcuts.ts is literal on
 *  purpose, because it names a physical key — which is why the preceding character matters. */
export function argumentViolations(src) {
  const out = [];
  const inComment = commentLineSet(src);
  src.split("\n").forEach((line, i) => {
    // Comments are prose on purpose, INCLUDING `/** … */` doc comments — those quote UI text to explain
    // a prop ("…a new standalone library map (\"New map from topic\")"), and flagging them would push the
    // migration into rewriting commentary, which is exactly the mistake the Toolbar pass made once.
    if (inComment.has(i)) return;
    // The rules below overlap on purpose — a wrapped `? "…"` arm is both an argument position and a
    // ternary arm — so a literal is reported once per line, not once per rule that noticed it.
    const seen = new Set();
    const push = (value) => {
      if (ALLOWED_LITERALS.has(value.toLowerCase()) || seen.has(value)) return;
      seen.add(value);
      out.push({ line: i + 1, text: `"${value}"`, why: "prose in a positional argument" });
    };
    for (const m of line.matchAll(/[(,?]\s*"([A-Z][^"]*\s[^"]*)"/g)) push(m[1]);
    // An argument long enough to be wrapped onto its own line has no punctuation in front of it, so the
    // rule above is blind to it. `"Priority: clear on selected topic",` in editorCommands.ts sat there
    // through two passes of this guard.
    const wrapped = /^\s*"([A-Z][^"]*\s[^"]*)",?$/.exec(line);
    if (wrapped) push(wrapped[1]);
    // A ternary arm that prettier put on its own line — `? "Saving…"` / `: "Saved locally"`. A leading
    // `:` here is unambiguous: an object property would have its key in front of the colon. Without
    // this, only the `?` half of a wrapped ternary is seen and the `else` string ships untranslated.
    const arm = /^\s*[?:]\s*"([A-Z][^"]*\s[^"]*)"[,})\]]*$/.exec(line);
    if (arm) push(arm[1]);
    // The `else` half of a same-line ternary. The discriminator against an object property is the SPACE
    // BEFORE the colon: prettier writes a ternary as `cond ? a : b` and a property as `key: value`, and
    // it formats every file here. Gating on a `?` somewhere on the line keeps `keys: "Ctrl/⌘ + Z"`
    // exempt twice over. An earlier version required the `?` arm to be a double-quoted string too, which
    // missed ``showHint(ok ? `Inserted the ${p.name}…` : "Select a topic first.")`` — a template in the
    // `then` arm hid a hardcoded `else`, twice in Toolbar.tsx.
    if (line.includes("?"))
      for (const m of line.matchAll(/\s:\s*"([A-Z][^"]*\s[^"]*)"/g)) push(m[1]);
  });
  return out;
}

/** Prose inside a TEMPLATE literal — `` `Delete view ${v.name}` ``. Interpolation is exactly where a
 *  hardcoded string hides best: the value is dynamic, so it reads as computed rather than authored, and
 *  every other detector here only looks at double quotes. This found 12 live strings across four files
 *  the allowlist already called migrated, which is the failure mode this guard exists to prevent.
 *
 *  Rule: strip the `${…}` holes, then look for a capitalised word followed by a lowercase word. That
 *  shape is prose; the templates that legitimately stay literal — CSS values, SVG paths, `data:` URLs,
 *  class names — are lowercase throughout or single tokens, so they don't match. */
export function templateViolations(src) {
  const out = [];
  const inComment = commentLineSet(src);
  src.split("\n").forEach((line, i) => {
    if (inComment.has(i)) return;
    for (const m of line.matchAll(/`([^`]*)`/g)) {
      const text = m[1]
        .replace(/\$\{[^}]*\}/g, " ")
        // Strip MARKUP before looking for prose. The exporters build OOXML and SVG by concatenation,
        // and a tag or attribute name reads exactly like prose to the rule below — `<a:p>` and
        // `<Relationships xmlns=` and `<Sld name="Blank">` are all "capitalised word, lowercase word".
        // That was 32 false positives across io/pptx.ts, io/xlsx.ts, io/interactiveHtml.ts,
        // io/deck.ts and flow/exportSvg.ts, and it is why those files could never join the allowlist.
        //
        // This strips the TAGS, not the file: prose sitting BETWEEN tags still reads as prose, so
        // `<div class="warn">Could not render ${n} topics</div>` is still caught. Only the markup
        // itself goes quiet.
        .replace(/<\/?[A-Za-z][^<>]*>/g, " ");
      if (!/[A-Z][a-z]+\s+[a-z]+/.test(text)) continue;
      out.push({ line: i + 1, text: `\`${m[1]}\``, why: "prose in a template literal" });
    }
  });
  return out;
}

/** A parenthesised lowercase placeholder — `"(untitled)"`, the fallback shown when a topic or map has no
 *  title. It's user-facing text that appeared at 20 call sites, and no other detector sees it: it opens
 *  with `(` so it isn't "capitalised", and it's one word so it isn't "multi-word". Narrow by design —
 *  letters and spaces only inside the parens, which no regex, format string or selector matches. */
export function placeholderViolations(src) {
  const out = [];
  const inComment = commentLineSet(src);
  src.split("\n").forEach((line, i) => {
    if (inComment.has(i)) return;
    for (const m of line.matchAll(/"(\([a-z][a-z ]*\))"/g))
      out.push({ line: i + 1, text: `"${m[1]}"`, why: "user-facing placeholder literal" });
  });
  return out;
}

/** A label/action TUPLE — `["Copy image to clipboard", () => io.copyPng()]`, `[".svg (vector)",
 *  io.exportSvg]`. Menus built from data rather than from JSX use this shape, and nothing else sees it:
 *  the first member is preceded by `[`, which the argument rule excludes, and many of these labels open
 *  with a `.` so they aren't "capitalised" either. 23 export labels sat behind that in `Toolbar.tsx`
 *  after it was declared migrated, and 13 context-menu items in `FlowMindMap.tsx`.
 *
 *  The second member must LOOK like a function — an arrow, or a dotted/bare identifier closing the
 *  array. That is what separates a label/action pair from a plain data array of strings such as
 *  `(["relates-to", "depends-on"] as const)`, whose members are ids and must not be flagged. Because
 *  the shape itself proves the string is a label, this detector needs no capitalisation or word-count
 *  rule, so it catches the short ones the others give up on (`"Rename"`, `"+1d"`). */
export function tupleLabelViolations(src) {
  const out = [];
  const inComment = commentLineSet(src);
  src.split("\n").forEach((line, i) => {
    if (inComment.has(i)) return;
    // Second member: an arrow / call, a dotted-or-bare identifier closing the array, or a NUMBER
    // closing it. The number case is the label/value pair — `["−1w", -7]` in the date-shift presets,
    // where the other four entries of the same array were already migrated and these two were not,
    // leaving one control half-translated.
    const tuple = /\[\s*"([^"]{2,})"\s*,\s*(?:\(|(?:\w+\.)*\w+\s*\]|-?\d+(?:\.\d+)?\s*\])/g;
    for (const m of line.matchAll(tuple)) {
      if (ALLOWED_LITERALS.has(m[1].toLowerCase())) continue;
      out.push({ line: i + 1, text: `"${m[1]}"`, why: "label in a label/action tuple" });
    }
  });
  return out;
}

/** A user-facing string in an OBJECT PROPERTY — `{ title: "Delete this map?", confirmText: "Delete
 *  anyway" }`. Menus, dialogs and shape palettes are built from data here, so this is where a lot of
 *  the copy actually lives.
 *
 *  The argument detector deliberately exempts object properties, because `shortcuts.ts` keeps
 *  `keys: "Ctrl/⌘ + Z"` literal on purpose — it names a physical key. That exemption was hiding 36 real
 *  strings: dialog titles and bodies, shape tooltips, undo labels.
 *
 *  Resolved by keying on the PROPERTY NAME rather than the value. The list below is the honest part of
 *  this rule and its weakest point — it catches exactly the names on it, so adding a component prop
 *  called `caption` silently reintroduces the blind spot. Prefer the names below when writing new
 *  data-driven UI. `keys` is deliberately absent, which is what preserves the shortcuts exemption. */
export const USER_FACING_OBJECT_PROPS = [
  "title",
  "body",
  "label",
  "text",
  "heading",
  "subtitle",
  "placeholder",
  "confirmText",
  "cancelText",
  "hint",
  "description",
  "tooltip",
  "caption",
  "message",
  "menu",
  "tab",
];

export function objectPropViolations(src) {
  const out = [];
  const inComment = commentLineSet(src);
  const names = USER_FACING_OBJECT_PROPS.join("|");
  const re = new RegExp(`(?:^|[{,\\s])(${names})\\s*:\\s*"([^"]{2,})"`, "g");
  src.split("\n").forEach((line, i) => {
    if (inComment.has(i)) return;
    for (const m of line.matchAll(re)) {
      const value = m[2];
      if (ALLOWED_LITERALS.has(value.toLowerCase())) continue;
      // Sentence-cased, parenthesised or elliptical — the shapes UI copy takes. A lowercase value is
      // far more likely an id, a CSS value or a discriminator (`kind: "note"`, `text: "plain"`).
      if (!/^[A-Z(.…+—]/.test(value)) continue;
      out.push({ line: i + 1, text: `${m[1]}: "${value}"`, why: "user-facing object property" });
    }
  });
  return out;
}

/** JSX text whose OPENING TAG ended on the previous line:
 *
 *      <button
 *        onClick={…}
 *      >
 *        Save
 *      </button>
 *
 *  The single-line `>text</` rule can't see this, and the bare-prose rule skips it for being one word
 *  or too short. That combination hid 32 strings — `Save`, `Close`, `Reset`, `+ Add`, `→ map` — in
 *  files the allowlist called migrated. Prettier produces this shape whenever a tag has more than a
 *  couple of attributes, so it is common, not exotic.
 *
 *  Anchored on BOTH neighbours: the previous line must end the opening tag and the next must close it.
 *  That is what keeps it from reading an ordinary wrapped sentence as a label. */
export function loneJsxTextViolations(src) {
  const out = [];
  const inComment = commentLineSet(src);
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    if (inComment.has(i)) return;
    const text = line.trim();
    if (text.length < 2 || text.length > 80) return;
    // PARENTHESES are punctuation in UI copy, not just code. Excluding them cost real strings —
    // `Presenter view (P)`, `Exit (Esc)`, `Show all (Esc)` — and the exclusion was never load-bearing
    // here the way it is in `proseViolations`, because this rule is anchored structurally: the
    // previous line must end in `>` and the next must open `</`, so the text is unambiguously JSX
    // content. `{}`, `=`, backtick, quotes and `;` stay excluded — those do still mark it as code.
    if (/[<>{}=`"';[\]]/.test(text)) return;
    if (!/\p{Letter}/u.test(text)) return;
    // A LEADING GLYPH does not stop it being a label — same fix as `jsxTextViolations`, and the same
    // reason: this used to require the FIRST character to come from a fixed set
    // (`[A-Z＋✕←→‹›▦☰⏸▶↺−+]`), so any new glyph the house style reached for (⤢, ☑, 🔗, 📝, 🖼…) was
    // invisible here even though the identical text on ONE line was already caught. One optional
    // non-letter/non-number glyph is allowed before the required capital, so `>3<` and a bare `>x<`
    // still don't qualify.
    if (!/^(?:[^\p{Letter}\p{Number}]\s*)?[A-Z]/u.test(text)) return;
    if (!/>$/.test((lines[i - 1] ?? "").trim())) return;
    if (!/^<\//.test((lines[i + 1] ?? "").trim())) return;
    out.push({ line: i + 1, text: `>${text}<`, why: "user-facing JSX text (wrapped tag)" });
  });
  return out;
}

/** JSX text content sitting on ONE line between its tags — `<MenuLabel>Arrowheads</MenuLabel>`,
 *  `<option value="left">Left side</option>`, `<span>Double-tap to edit</span>`.
 *
 *  This is where the SHORT labels live, and short is exactly what the other detectors give up on: the
 *  argument rule needs a capitalised multi-word literal and the bare-prose rule needs a line with no
 *  code punctuation, so a one-word section heading satisfies neither. Anchoring on the tags instead of
 *  on the text is what makes single words safe here — `>Type</` is unambiguously rendered content,
 *  whereas a bare `"Type"` could be an id, a `kind` or a discriminator.
 *
 *  Content containing `{` is skipped, so `<span>{t("…")}</span>` and any other interpolation passes.
 *  Verified against every file on the allowlist before being added: all clean, while it found three
 *  live hardcoded coach hints in `TopicNode.tsx` and 26 menu labels in `FlowMindMap.tsx`. */
export function jsxTextViolations(src) {
  const out = [];
  const inComment = commentLineSet(src);
  src.split("\n").forEach((line, i) => {
    if (inComment.has(i)) return;
    // `<kbd>` is HTML's keyboard-input element, and its content is a PHYSICAL KEY NAME — `Tab`,
    // `Enter`, `Shift`. Policy is that those stay literal: a locale does not rename the Tab key. That
    // is already pinned elsewhere (`keys: "Ctrl/⌘ + Z"` is a documented must-not-fire case in
    // test/i18n-no-hardcoded-strings.test.ts), and this is the same rule for the JSX shape.
    //
    // Stripping the ELEMENT rather than exempting the text keeps the rule anchored on markup: a real
    // label cannot escape by happening to match a key name, only by actually being marked up as one.
    // Verified against every allowlisted file before landing — no file loses a detection, because the
    // only `<kbd>` contents in the tree are key names and already-migrated `{t(…)}` interpolations.
    const withoutKeyNames = line.replace(/<kbd>[^<>]*<\/kbd>/g, " ");
    // A LEADING GLYPH does not stop it being a label. The rule anchored on `[A-Z]` immediately after
    // the `>`, so every emoji-prefixed label in the app was invisible to it: `🔗 Relationships`,
    // `📊 Map statistics`, `🗓 Agenda`, `🗂 Maps`, `▦ Board`, `＋ New`. That is not a rare shape here —
    // it is the house style for panel headings, and it hid ~15 strings inside files the allowlist had
    // already certified as clean. One optional non-alphanumeric glyph is allowed before the capital;
    // the capital is still required, so `>3<` and `>x<` stay out.
    for (const m of withoutKeyNames.matchAll(
      />((?:[^\p{Letter}\p{Number}\s<>{}]\s*)?[A-Z][^<>{}]*)<\//gu,
    )) {
      const text = m[1].trim();
      // A single character is a glyph or an initial, not a label — `<kbd>K</kbd>`.
      if (text.length < 2) continue;
      if (ALLOWED_LITERALS.has(text.toLowerCase())) continue;
      out.push({ line: i + 1, text: `>${text}<`, why: "user-facing JSX text" });
    }
  });
  return out;
}

/** A line that is bare prose — how the multi-line paragraphs inside JSX look in source.
 *
 *  Tuned for NO false positives, accepting that it therefore misses some shapes. In particular a prose
 *  line containing `:` or `?` is skipped, because `background: style?.fillImage` and friends are
 *  indistinguishable from prose without a parser. Those shapes are still caught when they sit in a prop,
 *  which is the common case. */
export function proseViolations(src) {
  const out = [];
  const inComment = commentLineSet(src);
  src.split("\n").forEach((line, i) => {
    const trimmed = line.trim();
    // The length floor keeps short CODE lines out — `return null`, `const x`, `break` all satisfy every
    // other rule below. Between 6 and 11 characters a capital first letter is what separates the two:
    // JS keywords are lowercase, UI copy is sentence-cased. That distinction is worth having, because
    // the floor alone was hiding `Map side` — a real label in the branch menu, 8 characters long.
    if (trimmed.length < 6) return;
    if (trimmed.length < 12 && !/^[A-Z]/.test(trimmed)) return;
    // Comments are prose on purpose — including the CONTINUATION lines of a multi-line block comment,
    // which open with prose rather than with a star. That was this detector's one false-positive shape.
    if (inComment.has(i)) return;
    // Code punctuation — includes `:` and `?`, which object literals and optional chaining use.
    if (/[<>{}=`"';(),[\]?:]/.test(trimmed)) return;
    // Property access (`navigator.storage`) reads as two words once the dot is allowed; a full stop in
    // prose is followed by a space or end-of-line, never immediately by a letter.
    if (/\.\w/.test(trimmed)) return;
    // A control-flow keyword followed by ONE identifier is a wrapped statement, not a sentence:
    // `return parsed`, `return folderName`, `return lines`. Two words, no punctuation, sentence-cased
    // only by accident of the keyword being lowercase — it satisfies every rule below. Seven of these
    // exist today and none is prose.
    //
    // Deliberately anchored to `$`: real copy that opens with one of these words keeps going
    // ("Return to the map to continue"), so requiring the identifier to END the line separates them.
    if (/^(?:return|throw|yield|await|delete|typeof|void)\s+[\w$]+$/.test(trimmed)) return;
    // Needs at least two letter-words to be prose rather than an identifier.
    if (!/^[A-Za-z][A-Za-z'’À-ſ.,!—–-]*(\s+[A-Za-z'’À-ſ.,!—–-]+){1,}$/.test(trimmed)) return;
    out.push({ line: i + 1, text: trimmed, why: "bare prose in JSX" });
  });
  return out;
}

/** Every detector, over one file's source. */
export function scanSource(src) {
  return [
    ...propViolations(src),
    ...argumentViolations(src),
    ...templateViolations(src),
    ...placeholderViolations(src),
    ...tupleLabelViolations(src),
    ...objectPropViolations(src),
    ...loneJsxTextViolations(src),
    ...jsxTextViolations(src),
    ...proseViolations(src),
  ];
}
