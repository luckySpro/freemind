# i18n — owner decisions and their outcomes

> **STATUS 2026-07-28: nothing in this file is blocked any more.** All four items are RESOLVED or
> DECLINED, and the i18n programme merged to `main` in PR #173. The filename is kept because
> `NEXT_STEPS.md`, `scripts/bundle-budget.mjs` and `scripts/lib/i18nFrozen.mjs` all point at it by
> path; read it as a **decision record**, not a worklist.

Items the migration reached and deliberately did **not** decide on its own. Each changed visible copy,
changed behaviour, or asked a question the migration had no standing to answer. They were recorded
here rather than guessed at, and rather than left as a silent gap.

Each is kept with its full reasoning **after** resolution, not deleted, because the arguments are the
reusable part — three of the four were resolved in a way that contradicted the first analysis written
about them, and that pattern is the most useful thing in this file.

---

## 1. ✅ RESOLVED (2026-07-27) — markup interleaved with prose

**Decision: build the node interpolator.** Keep the `<kbd>`/`<strong>` styling *and* make each sentence
one reorderable message. Shipped as `tNodes` in `src/i18n/nodes.tsx`.

The scope turned out to be **three files, not one**. Grepping `<kbd>` found the same shape in
`FirstRunCard.tsx` (five list items, `<strong>` as well as `<kbd>`) and `CaptureCard.tsx`, both of which
this file had counted under "blocked" without naming. All three are migrated and now on the guard's
allowlist.

Two things worth keeping, because they are the reason this was not as done as it looked:

- **The scanner cannot see this shape at all.** No detector matches a sentence that a JSX element has
  cut in half, so after the `<kbd>` exemption landed all three files reported *zero hardcoded strings*
  while their prose was still hardcoded. `test/i18n-pseudo-render.test.tsx` renders them instead, and
  that is what actually holds them — the allowlist entry is bookkeeping.
- **The harness had the same blind spot, from the other side.** `tNodes` splits a message into sibling
  text nodes, so wrapping a whole message in `⟦…⟧` left every interior run unmarked and reported as
  hardcoded. `applyMarkerLocale` now marks each *segment*. Found by pointing the harness at the real
  component, not by review.

Also fixed in passing, both invisible to every detector: `DropLabel` shadowed the imported `t` with a
local variable (so its label could not be migrated without a silent runtime error), and
`"3 things to try"` escaped the JSX-text rule because the rule requires a leading `[A-Z]` and `3` is
not one.

<details>
<summary>Original write-up, kept for the rationale</summary>

`src/mindmap/flow/CanvasOverlays.tsx:41,45`

```tsx
Press <kbd>Tab</kbd> for a child · <kbd>Enter</kbd> for a sibling · double-click to rename
<kbd>Shift</kbd>-drag the canvas to select several topics
```

**Two rules collide here.**

*Physical key names stay literal.* `Tab`, `Enter` and `Shift` denote keys on a keyboard, not words; a
locale does not rename them. This is already policy — `src/i18n/core.ts` documents it for the keyboard
cheat sheet, and `test/i18n-no-hardcoded-strings.test.ts` pins `keys: "Ctrl/⌘ + Z"` as a must-not-fire
case.

*A sentence must be one message.* The prose around those keys is split into fragments by the `<kbd>`
elements, so a translator can never reorder it — and most languages will need to. "Press X for a child"
does not survive being cut into "Press", X, "for a child" in, say, German or Japanese.

**Why this isn't just done:** `t()` returns a string, so the obvious fix — one message with `{child}`
and `{sibling}` placeholders — cannot carry the `<kbd>` elements. Resolving it means one of:

- **Drop the `<kbd>` styling** and make the whole line one message with the key names inline. Simplest,
  fully translatable, and a **visible design change** (the keys stop looking like keys).
- **Render the message through a small interpolator** that maps placeholders to React nodes, so
  `t("canvas.coach.editKeys")` returns `Press {child} for a child …` and the component substitutes
  `<kbd>Tab</kbd>`. Keeps the styling and the word order; adds a helper the codebase does not have.
- **Leave it English.** Honest, and the coach is a first-run affordance, but it is the first thing a new
  user reads.

Until then `CanvasOverlays.tsx` stays off the allowlist. Everything else in it is migrated; the file
reports exactly these three key names.

</details>

---

## 2. Map content — declined, recorded so it is not re-litigated

`src/exampleBuilders.ts` (~169), `src/templates.ts` (~30), `src/model/sampleMap.ts` (~14)

Owner decision, 2026-07-26: **do not migrate examples, patterns or templates.** Their bodies AND their
names stay English.

The accepted consequence, stated plainly: those names render in the "+ New…" dropdown and the Insert ▸
Map parts menu, so **those menu entries will read English inside an otherwise translated menu**.

**The correctness defect inside this decision is ✅ FIXED (2026-07-27), by owner decision.** A handful
of example notes gave UI-referential instructions ("Open the Outline panel", "📝 Notes or 🏷 Markers
from the toolbar"). Those name controls that will not be called that in a translated UI, so the
sentence stops being untranslated and starts being *wrong* — and wrong in example content reads as the
app lying to a new user.

Six strings reworded: `exampleBuilders.ts` (5) and `sampleMap.ts` (1). **The copy is still English —
the decline stands.** This was a correctness fix, not a migration; nothing moved into a catalogue.

The rule, now recorded at the top of `exampleBuilders.ts`: describe the *action* and keep the **glyph**
as the finding aid. 🔗, 🧲, 📝, 🏷 and ↓ are not translated, so they point at the right control in
every locale — "use 🔗 to point this topic at your Strategy map" survives, "🔗 Link" does not.

Audited all three content files, not just the ones already known. `templates.ts` has **zero** —
every string there describes map content. Deliberately left alone: "switch the layout to right-only"
(describes the result; the label is "Right") and the four "Link me to your … map" topic texts (ordinary
verb, not a quoted label). A brittle "(Chapter 5)" cross-reference went at the same time.

---

## 3. ✅ RESOLVED (2026-07-27) — the bundle gate measured a subset of first-load JS

**Decision: gate on true first load, re-based to 182 kB**, recorded as a metric correction rather than
an allowance. Measured at the switch: 157.9 entry + 22.4 preloaded = **180.3 kB**.

**182, not the ~185 first sketched.** 185 would leave ~4.7 kB of unguarded slack, which is precisely
what the `171 → 175` note in `bundle-budget.mjs` warned about and then demonstrated — "unrelated bloat
can ride in unnoticed". The usual argument for a fat margin does not apply: this figure is
deterministic, so unlike the coverage floor it cannot flake under concurrent CI/Deploy/Stats runners.
That is the same reasoning that accepted 0.9 kB of headroom at 175. 182 leaves 1.7 kB.

Two things came out of doing it that were not in the original write-up:

- **The dashboard would have drifted from the gate.** `build-stats.mjs` computed its own `withinBudget`
  from `index-*.js`, so after the flip it would have reported green against a ceiling it was measuring
  differently — the same failure `bundle-budget.mjs` exists to prevent, one level up from the constant.
  The measurement now lives in `scripts/lib/firstLoad.mjs` and both import it.
- **It is guarded by a test, not just by having been done once.** `test/first-load-budget.test.ts`
  pins that a modulepreloaded chunk counts and a dynamically-imported one does not. Mutation-checked:
  reverting the rule to entry-only fails two of its three cases. Verified end-to-end too — with the
  ceiling temporarily at 179 (above the entry, below true first load) the gate fails, where the old
  metric would have passed.

<details>
<summary>Original write-up, kept for the rationale</summary>

`scripts/size-budget.mjs`, `scripts/bundle-budget.mjs`

The gate weighs `index-*.js` and calls it "the initial bundle". Rollup also splits code shared by
several eagerly-imported modules into its own chunk, and Vite emits a `<link rel="modulepreload">` for
it — so the browser fetches it on first paint exactly like the entry. The gate filed those under "lazy"
and stopped counting.

**Measured:**

| | entry | preloaded | true first load |
| --- | --- | --- | --- |
| at this branch's start | 168.1 | 8.4 | **176.5** |
| after the eager-inspector batch | 158.0 | 20.6 | **178.6** |

Two things follow, and they point in opposite directions:

- **The true figure has been above the 175 ceiling since before this work started.** Not a regression
  introduced here — verified by building the branch point.
- **The gate can report an improvement for a change that made things worse.** Migrating the eager
  inspectors moved ~16.6 kB into `primitives-*.js`; the gate reported 168.5 → 158.0, a 10.5 kB "win",
  for a change that added 141 catalogue keys. Real first load went *up* ~2 kB.

`size-budget.mjs` now **computes and prints** the true figure, and flags it when it exceeds the ceiling.
It still **gates on the old metric**, deliberately — switching it changes what a guard-rail means, and
because the true number was already over, flipping it silently would either read as a regression this
work caused or invite raising the ceiling to hide it.

**The decision:** gate on true first load and re-base `BUDGET_KB` to the measured figure plus a margin
(recording it as a metric correction, not an allowance) — or keep the entry-only metric and document
that it is a proxy. The one option to avoid is leaving a gate that can be satisfied by moving weight
sideways.

Worth noting either way: `primitives-*.js` at 16.6 kB is the UI-primitive layer, pulled in eagerly. If
first-load size matters, that chunk — not the catalogue — is where the weight actually is.

</details>

---

## 4. ✅ RESOLVED (2026-07-28) — 194 strings were frozen at import and would not follow a language picker

`test/i18n-frozen-ratchet.test.ts` holds the per-file list (BUDGET is now empty — the total went
194 → 145 → 0 across three sessions); `test/i18n-frozen-constants.test.ts` proves the mechanism and
pins the fix with CLEARANCE tests.

**Resolved by converting every site to a getter** (`get tab() { return t("panel.outline"); }` instead
of `tab: t("panel.outline")`), the first option listed below — chosen because it is a true drop-in
replacement: every READ site (`PANEL_LABELS.outline.tab`) is byte-identical before and after, so
`App.tsx` and `Toolbar.tsx` needed zero call-site changes. The identity field on every one of these
tables (id/kind/key/href/w/d/a/value — never the translated field) was left as a plain literal on
purpose, since that is what callers key React lists and persist by; getters only touch the
purely-for-display field. One real bug surfaced along the way: `CaptureCard.tsx`'s suggested-prompt
buttons keyed their React list on the translated text itself (`key={ex}`) — the same "translated label
used as identity" defect already fixed for Toolbar's last-export id and Recent's date buckets. That
array is now a function returning stable `{ id, text }` pairs, keyed on `id`.

The rest of this section is kept as a historical record of the investigation — the trigger analysis,
the blind-spot note about hidden derivations, and the options considered — since the "why it isn't just
fixed here" framing and the options list are still useful context for the next time this class of bug
shows up.

`t()` reads the **active** locale at call time. A call inside a render function therefore follows a
later `setLocale`. A call at **module scope** runs once, when the module is first imported, and freezes
its result into a `const`:

```ts
// src/panelLabels.ts — evaluated at import, forever English
export const PANEL_LABELS = {
  outline: { tab: t("panel.outline"), menu: t("panel.outline") },
  …
```

**⚠️ CORRECTED 2026-07-27 — the original write-up below got the trigger wrong, in the dangerous
direction.** It said the frozen strings were "currently correct" because "the registry resolves the
stored locale before any catalogue-consuming module loads", and that they arm "the moment a language
picker ships". Both were false, and the second is the sentence on which "just require a reload" rested.

Measured: `main.tsx` called `initLocale()` in its body, *below* `import { App }`. ES imports are hoisted
and evaluated depth-first, so the entire eager graph had already run its module-scope `t()` calls
against `DEFAULT_LOCALE` — **99 of the 194 froze before resolution ever ran.** That is fixed (the call
now lives in the `src/i18n` barrel body, pinned by `test/i18n-init-order.test.ts`), but it means the
"currently correct" reassurance was luck, not design: it held only because `LOCALES` has one entry.

And the trigger is **`LOCALES` gaining a second entry, not a picker.** `resolveLocale()` already reads
`navigator.languages`, so the day a second catalogue ships, a Danish browser gets a half-English first
paint — panel tabs, slash commands, edge presets, Start sidebar and theme names in English — **with no
user action and no UI involved**. A half-translated UI reads as a broken translation rather than a code
defect, so it would be reported late and diagnosed slowly.

**A related blind spot, recorded so it is not rediscovered:** the ratchet counts `t(` calls, so it
cannot see a module-scope *derivation* that materialises its inputs — `MapPanel.tsx:112`,
`Kanban.tsx:27` and `icons.ts:116` each read a table once at import. Migrate their sources to getters
and they silently re-freeze while the detector reports 0. Their contents (layout names, marker-group
names) are also raw English literals today, so they score 0 on every existing check.

**Checked and clear:** module-scope *collation* was suspected as a second family of the same bug. An
independent AST scan found zero — `collator()` builds a fresh `Intl.Collator(active, …)` per call, and
`taskDate.ts` re-keys its `DateTimeFormat` on `getLocale()`. Do not re-litigate.

**Measured spread** — 194 calls in 23 files, concentrated in the ones that build label tables:
`panelLabels.ts` (26), `stickers.ts` (25), `EdgeInspector.tsx` (15), `start/sections/Layouts.tsx` (15),
`start/sections/Learn.tsx` (12), `editorCommands.ts` (11), then a tail.

**Why it wasn't just fixed at the time:** the fix was mechanical but not free — each site becomes
either a getter or a function call, and the function form changes every consumer. Landed at the end of
a long migration, that looked like a wide, impossible-to-verify-by-eye diff that wanted its own change.
In the event, **every one of the 145 remaining sites turned out to be the getter shape** (an array/object
literal with an identity field and a display field), so the "changes every consumer" cost never
materialized — see the resolution note at the top of this section.

**The options that were on the table:**

- **Getters** (`get tab() { return t("panel.outline"); }`) — no call-site churn at all, since property
  access already looks like property access. Pinned as working in the third test. **This is what shipped.**
- **Functions** (`panelLabels()`) — the most explicit about the cost, and the most churn. Not needed —
  no site was a bare exported binding rather than an object property.
- **Accept it and drop `setLocale`'s dynamism** — decide the locale is fixed for a session and require
  a reload to change it. Not chosen, since the getter fix cost nothing extra.

The ratchet still holds the line for the future: the count cannot grow above its (now empty) budget,
and no new file can join without editing `test/i18n-frozen-ratchet.test.ts` by hand.
