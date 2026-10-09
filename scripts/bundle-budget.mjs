// The entry-chunk size budget — SINGLE SOURCE OF TRUTH, imported by both the gate
// (scripts/size-budget.mjs, which fails the build) and the dashboard
// (scripts/build-stats.mjs, which reports it in public/stats.json).
//
// It lives in its own module because those two drifted: build-stats.mjs carried a hand-copied
// `budgetKb = 150` with a "mirrors size-budget.mjs" comment and was never updated through the ten
// bumps below, so the dashboard reported a 150 kB ceiling — and a false `withinBudget: false` — while
// the gate enforced 171. Importing it makes that drift impossible rather than merely fixed once.
//
// Raise/lower this deliberately (in the same commit as the change that moves it),
// never silently. The entry chunk is the JS that loads on first visit.
// 150 → 153: the search & nav pack adds editor-core code (broadened Find +
// operator/scoped search parser + back/forward navigation history) that can't be
// meaningfully lazy-loaded, nudging the entry from 149.9 to ~152 kB gz.
// 153 → 158: the knowledge-linking / capture / accessibility packs (cross-map +
// in-note links, slash-capture, keyboard + SR a11y) add more editor-core UI that
// likewise can't be lazy-loaded. Headroom for the whole multi-pack effort.
// 158 → 159: typed relationships (B3) + export-this-branch (B4). The branch-export
// picker itself is lazy, but its editor-core orchestration (relationship types in
// the projection / EdgeInspector / rules / filter, the branch-export command +
// context-menu wiring) lands in the entry and can't be lazy-loaded.
// 159 → 160: custom theme designer (C3). The designer UI is lazy, but useTheme must
// resolve a persisted custom theme synchronously on first paint (else the canvas
// flashes the wrong theme), so the store read + luminance-derived cssVar mapping
// (getCustomThemes / customToCanvasTheme) land in the entry and can't be lazy-loaded.
// 160 → 163: the 2026-07-02 Tier 3 batch (MindManager review) — the MenuSub fly-out
// submenu primitive (used by the always-mounted Insert menu + Map panel), the visual
// Layout gallery (layoutPreview.ts + its SVG renderer, replacing a native <select> in
// the always-mounted Map panel), the Design gallery's move from the lazy Canvas menu
// into the always-mounted Map panel, and the AND/NOT rules + full 1-9 priority
// expansions. All of it is core editor-chrome/canvas code the Map panel or canvas
// keydown handler needs synchronously, so none of it can be meaningfully lazy-loaded.
// 163 → 165: the 2026-07-02 Tier 1/2 batch — most of it (boards, exports, .mmap writer,
// #tag/paste/date ops) is lazy or self-contained, but the live-map-slides deck renderer
// (useMapExports' renderDeckSvgs/renderDeckImages + the resolveSlides/slideKey imports)
// rides in the eagerly-imported export hook, nudging the entry ~0.2 kB over the old
// razor-thin 163 ceiling. The 2 kB headroom also stops the near-flush margin from
// flaking the gate under concurrent CI/Deploy/Stats runners.
// 165 → 167: the 2026-07-26 Tier 5 batch. Two eager additions, both unavoidable:
// richTextCommands (item 25) replaces document.execCommand and is reached from the
// always-mounted Notes panel, and saved views (item 33) moved onto the doc schema. The
// XMind marker vocabulary from item 34 is deliberately NOT here — it was placed in
// io/xmind.ts rather than the eager icons.ts precisely so the format adapters stay lazy,
// which held the entry flat. This left 0.3 kB of headroom at 165; 167 restores a working
// margin without loosening the ceiling enough to hide real bloat.
// 167 → 169: the i18n layer (2026-07-26). The registry + Intl plumbing is a ~1 kB one-off; after that
// the marginal cost of migrating a string is the KEY, not the text, because the English text was
// already in the bundle inline. Measured: 43 catalogue entries ≈ 25 bytes of key each. That makes the
// FULL ~1,440-string extraction roughly +12 kB gz of keys, which this ceiling cannot absorb — see the
// open decision in NEXT_STEPS before the bulk migration. This bump covers the layer plus the first
// migrated surface; it is not headroom for the rest.
// 169 → 171: the editorCommands / ⌘K registry batch (2026-07-26). ~50 more catalogue keys at the
// measured ~17 bytes gz each. Tracking the strategy note in NEXT_STEPS: chunk-locality first, then bump
// for the eager remainder. This is the eager chrome registry, so it has to sit in the entry chunk.
// 171 → 175: forward headroom for the rest of the i18n migration (2026-07-26), by owner decision.
// Unlike every bump above, this one is a PROJECTION, not a measurement of landed work — recorded as
// such so the next reader doesn't mistake it for evidence. Measured so far: the App.tsx `hint.*` batch
// is +1.2 kB gz for ~124 new keys (~10 bytes each), taking the entry to 171.8. Almost none of those keys
// reuse an existing message the way Toolbar.tsx's 31 shared `cmd.*` keys did, which is why this batch
// costs what Toolbar's 93 strings did not. Panels.tsx's remaining 233 strings project to ~+2.3 kB at
// that rate, landing near 174; 175 covers the finished eager migration in one move rather than a bump
// per batch.
// What that buys and what it costs: no repeat bumps mid-migration, but ~4 kB of slack sits unguarded
// until the migration lands, so unrelated bloat can ride in unnoticed — the precise risk the 167 → 169
// note warned about. It also front-runs the "chunk-locality first, then raise the ceiling" ordering in
// NEXT_STEPS, which is recorded there as superseded by this decision.
// RESOLVED 2026-07-26: Panels.tsx landed (233 strings) and the eager migration is complete. Measured
// entry 174.1 kB, against a projection of ~174 — so 175 is now a MEASURED ceiling with 0.9 kB of
// headroom, not a projection, and no further tightening is warranted. Dropping to ~174.5 would buy
// nothing (this figure is deterministic, so a thin margin can't flake the way the coverage floor does)
// while making the next legitimate change a two-line edit. The "~4 kB of unguarded slack" the bump
// above warned about is closed: the slack is now 0.9 kB.
// 175 → 182, and the METRIC CHANGED (2026-07-27, owner decision — docs/I18N_BLOCKED.md item 3).
//
// READ THIS BEFORE COMPARING THE NUMBER TO ANY BUMP ABOVE. Every figure above measures `index-*.js`
// alone. From here the budget measures TRUE FIRST LOAD: the entry chunk plus every chunk index.html
// preloads, because Vite emits <link rel="modulepreload"> for shared eager chunks and the browser
// fetches those on first paint exactly like the entry. The number going up does NOT mean anything got
// slower — it means the ruler got honest. Measured at the moment of the switch: 157.9 kB entry +
// 22.4 kB preloaded = 180.3 kB true first load.
//
// The old rule was not merely imprecise, it was GAMEABLE, and it had already been gamed by accident:
// migrating the eager inspectors moved ~16.6 kB into primitives-*.js and the gate reported a 10.5 kB
// improvement (168.5 → 158.0) for a change that ADDED 141 catalogue keys. Real first load went UP
// ~2 kB. A ceiling you can satisfy by relocating weight is not a ceiling.
//
// Why 182 and not the ~185 first sketched: 185 would leave ~4.7 kB of unguarded slack, which is the
// exact failure the 171 → 175 note above warned about and then demonstrated ("unrelated bloat can ride
// in unnoticed"). And the counter-argument for a fat margin does not apply here — this figure is
// deterministic, so unlike the coverage floor it cannot flake under concurrent CI/Deploy/Stats
// runners. That is the same reasoning that accepted 0.9 kB of headroom at 175. 182 leaves 1.7 kB:
// enough that a legitimate small change isn't a two-line edit, too little to hide a regression.
//
// The true figure has been ABOVE the old 175 ceiling since before the i18n branch started (measured
// 176.5 at the branch point), so this is not a regression that work introduced — it is the first
// honest reading. primitives-*.js at ~16.6 kB is where the weight actually is, if it needs shedding.
//
// 182 → 184 (2026-07-28, owner-approved). NOT a policy change — a restoration of the working headroom
// 182 was chosen to provide. That note set the ceiling 1.7 kB above a measured 180.3 "enough that a
// legitimate small change isn't a two-line edit, too little to hide a regression". The rest of the i18n
// migration then consumed almost all of it: measured 181.9 at the merge of PR #173, i.e. 0.1 kB left,
// which fails the "not a two-line edit" half of that test — the next string anyone adds turns the gate
// red for a reason nobody will remember.
//
// Why 184 and not the ~190 first suggested: the reasoning two paragraphs up still holds and argues
// against a fat margin. 190 would leave ~8 kB of unguarded slack — nearly double the 4.7 kB that the
// 171 → 175 note warned about and that this file then watched ride in unnoticed. 184 restores ~2.1 kB,
// which is the same margin 182 was picked to give, measured against today's number instead of
// July's. The pressure that ate the headroom is also gone: the eager catalogue migration is COMPLETE
// (all four items in docs/I18N_BLOCKED.md resolved), so there is no further batch queued to spend it.
// If this needs raising again, shed primitives-*.js first — a third bump without shedding is the
// signal that the ceiling has stopped meaning anything.
export const BUDGET_KB = 184;
