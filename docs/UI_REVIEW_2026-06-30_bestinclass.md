# Fresh UI review — best-in-class features (2026-06-30)

A second, features-focused review with fresh eyes — run *after* the UI-1…UI-7 remediation + tails
shipped. Where the [June research report](UI_RESEARCH_2026-06-30.md) targeted *polish* (chrome, a11y,
density), this one asks a different question: **what best-in-class capabilities would elevate the
product**, filtered hard against the as-built feature set and the decided-against list.

This doc was revised after a **23-agent verified gap scan**: a code-grounded as-built inventory → 10
gap lenses → a **skeptic pass that refuted every claimed gap against the actual repo** (dropping anything
already shipped) → dedupe/group → a completeness audit. The skeptic pass corrected this review's own first
draft (see the correction note below), so every "already shipped" and every gap here is code-checked.

> **Correction to the first draft of this doc.** The verified scan proved two items the first draft
> pitched as "Tier-1 missing" already ship: **interactive offline HTML export** (`io/interactiveHtml.ts` —
> a single self-contained file with collapsible branches, search/filter, and pan/zoom) and **in-map fuzzy
> jump-to-topic** (`editorCommands.ts` `jump:*` rows in ⌘K). Their real, narrower gaps survive below
> (visual fidelity in the HTML export; a *cross-map* quick switcher). Honesty over a clean headline.

> **Pruned (2026-07-01).** This doc is now open-items-only: every gap the review found that has since
> shipped is removed from the tables below (the full shipped history — waves, packs, and the
> nine-item deferred backlog — lives in `CHANGELOG.md`, not duplicated here). Section numbering is
> kept stable even where a section emptied out, since it's referenced loosely elsewhere. **65 open
> gaps remain** (down from the original 111 the scan surfaced).

---

## The honest headline

**This is not a "what's missing" exercise — it's a "what's left" one.** The inventory turned up ~180
shipped capabilities; the app already has the large majority of every competitor's feature set *and*
several genuinely **best-in-class strengths** most rivals can't match:

- **Local-first + fully offline, no account, no telemetry** — rare in this category; the core identity.
- **MindManager `.mmap` round-trip completeness** (rich text, icons→emoji, tasks, relationships,
  boundaries, callouts, per-topic styling all survive) — better interop than most. 14 import + 17 export
  formats, incl. a **self-contained interactive HTML** and a **standalone HTML slide deck**.
- **Conditional styling / SmartRules** (render-time auto-formatting by tag/marker/priority/completion).
- **Canvas == export fidelity** (SVG/PNG/PDF/PPTX render identically to screen, documented + tested).
- **WCAG 2.2/2.5 maturity** with assertions in CI (incl. the `role="tree"` outline + SR relationships
  list from this month's work).
- **Presenter view** (notes + clickable agenda + next-slide), **version-history playback**, **12 layouts**
  + free canvas, **Power Filter** + saved presets, a genuinely-working **responsive/touch** build.

So the add-list is a **finite, code-verified set of gaps**, not an open-ended wishlist. Below: first the
shipped baseline (so nothing here is re-pitched), then the **65 open gaps** grouped into 11 themes.

---

## Already shipped — NOT re-pitched (verified in code)

A best-in-class review usually proposes these; this app already has them, so they're excluded from the
gap list below: focus-mode/drill-into-subtree (`useFocusHotkey`, `drillId`), **saved views/perspectives**
(`savedViews.ts`), **detail-level folding** ("Show detail level 1–5" in ⌘K), summaries + boundaries +
callouts, outline numbering, breadcrumb + minimap, **per-node backlinks / "Linked-from"**, marker/tag
index, **Power Filter** + saved filters + extract-matches-to-map, cross-map + in-map **fuzzy search** with
Find Next/Prev, **find-and-replace** (`replaceTopics`, regex), an **editable Outline panel** (rename,
drag-reorder, ◂▸ indent, Tab/Enter), **image-paste** + **paste-text→map** + **paste-table→subtree**,
conditional styling, Kanban, agenda/stats panels, **12 layouts** + free canvas with **align/distribute**
+ **auto branch-colour** + **format painter**, **multi-select bulk** icon/tag ops, **tag rename/merge**,
**14 node shapes**, roll-ups across maps, version-history playback, the **brainstorm timer**, the
contextual action bar + accessible tree, a `⌘K` palette with **in-map fuzzy jump-to-topic**, and a
**self-contained interactive HTML export** (collapsible + searchable + pan/zoom, offline) alongside the
static-image HTML, PPTX, PDF (+notes), DOCX, XLSX, and 8 mind-map formats.

---

## Open gaps, grouped (65, code-verified)

Tags per gap: **scope** (`in` in-scope · `?` needs a product call · all out-of-scope items are listed
separately) · **impact** (high/med/low) · **effort** (S/M/L) · **status** (`missing` / `partial`).
"partial" = the model or a sibling surface already exists; the named sub-capability is the delta.

### 1 · Capture & low-friction input (7)
| Gap | What | Tags |
|---|---|---|
| Rich HTML paste → nodes | preserve inline formatting + split lists/headings into nodes | `in·med·M·partial` |
| Inline tokens on add (`#tag !priority @resource`) | lift typed tokens onto structured fields | `?·med·M·missing` |
| Natural-language date entry (chrono-node) | "next fri" → ISO date | `?·med·S·missing` |
| Template / map-parts on insert (keyboard) | insert SWOT/pros-cons under a node at capture time | `in·low·S·partial` |
| Inline tag/marker autocomplete in the canvas editor | type-ahead from within the topic editor | `?·low·M·partial` |
| PWA share-target capture | receive shared text/link/image from the OS | `?·low·M·missing` |
| Image OCR on paste/drop | tesseract.js WASM, lazy-loaded | `?·low·L·missing` |

### 2 · Search, navigation & wayfinding — all shipped ✅
Every gap this lens surfaced has shipped — see `CHANGELOG.md`.

### 3 · Knowledge structure & linking (6)
Several items brush the decided-against "no graph" boundary.
| Gap | What | Tags |
|---|---|---|
| Typed / categorised relationships | depends-on / causes / supports, drivable in style/filter | `?·med·M·partial` |
| Transclusion / embedded references | live kept-in-sync view of another topic (single-parent-safe) | `?·med·L·missing` |
| Tags-as-navigation pane | tag browser with counts → filter/jump | `?·low·S·partial` |
| Topic aliases / alternate names | resolve links + search under multiple labels | `?·low·S·missing` |
| Directional / reverse relationship labels | "blocks" forward / "blocked by" reverse | `?·low·S·missing` |
| Unlinked mentions | suggest links where a topic names another | `?·low·M·missing` |

### 4 · Editing & restructuring (3)
| Gap | What | Tags |
|---|---|---|
| Drag a branch between two open maps | HTML5 DnD serialization | `?·med·M·partial` |
| Compare / diff two versions | added/removed/edited vs only restore/playback | `?·low·M·missing` |
| Undo history tree / branching undo | redo survives editing after an undo | `?·low·L·partial` |

### 5 · Styling, theming & visual encoding (7)
| Gap | What | Tags |
|---|---|---|
| Full emoji / Unicode marker picker | beyond the 45-entry catalog | `in·med·M·partial` |
| Custom / savable themes & palettes | theme designer + import/export | `?·med·L·partial` |
| Gradient direction / radial gradient | currently a hardcoded vertical linear gradient | `?·low·M·partial` |
| Canvas background pattern | dot/line grid (React Flow `<Background>`) | `?·low·S·missing` |
| Per-node opacity | de-emphasise / watermark a card | `?·low·S·missing` |
| Named font choices beyond 3 generic families | a named-font dropdown (not uploaded fonts) | `?·low·S·partial` |
| One-click "colourful/rainbow node fills" | tint each branch's node fills by palette | `?·low·S·partial` |

### 6 · Layout, canvas & scale (6)
| Gap | What | Tags |
|---|---|---|
| Auto-fit / keep-in-view after structural edits | pan/zoom so new/remaining content stays visible | `in·med·M·partial` |
| Partial / touch marquee + no-modifier lasso | select any node a marquee touches; plain left-drag | `in·med·S·partial` |
| Snap-to-grid on free canvas | optional 8/16px grid, distinct from neighbour guides | `in·low·S·missing` |
| Auto-arrange / tidy free-canvas command | re-flow manual positions to a clean tree | `?·low·S·missing` |
| Tree-table / matrix layout | XMind "Tree Table" / "Matrix" | `?·low·M·missing` |
| Minimap match/selection highlighting | show search/filter hits + clearer viewport frame | `?·low·S·partial` |

### 7 · Presentation, sharing & export (12)
The largest remaining lens.
| Gap | What | Tags |
|---|---|---|
| Speaker notes in exported deck / PPTX | the script travels with the artifact | `in·med·M·partial` |
| PPTX honours the curated deck order/notes | currently builds the auto deck | `in·med·S·partial` |
| Export branch / selection only | share one part (image/SVG/HTML/deck) | `in·med·M·missing` |
| Interactive HTML carries visual fidelity | images, fills, markers, colours, shapes (today it's a text outline) | `in·med·M·partial` |
| Poster / multi-page tiled print | A0 across N×M sheets with crop marks | `in·med·M·missing` |
| Laser pointer / spotlight / pen | draw the audience's eye | `in·med·M·missing` |
| Incremental bullet reveal (fragments) | reveal points one click at a time | `in·med·M·missing` |
| Embeddable read-only visual viewer | single-file iframe/web-component of the visual map | `?·med·L·partial` |
| Slide transitions | fade/slide/zoom between slides | `?·low·S·missing` |
| Auto-advance / loop / kiosk mode | hands-free booth/lobby replay | `?·low·S·missing` |
| Print/export options dialog | size/scale/margins/contents before producing | `?·low·M·missing` |
| Animated GIF / WebM map export | short animation of a walk/history (MediaRecorder) | `?·low·L·missing` |

### 8 · Task & metadata layer — light, in-scope (4)
Wire up fields the model already carries without crossing into the decided-against PM engine.
| Gap | What | Tags |
|---|---|---|
| Natural-language / relative due-date entry | "today"/"next fri"/"+7d" → ISO (`addDaysISO` exists) | `in·med·M·missing` |
| Quick date set / reschedule chip on canvas | inline Today / +1wk like the progress pie (DateChip is display-only) | `?·med·M·missing` |
| Duration & resources editing UI | model carries + import fills them; user can't set them | `?·med·M·partial` |
| Resource / assignee index & filter | a filterable facet paralleling markers & tags | `?·low·M·partial` |

### 9 · Files, library & autosave durability (9)
| Gap | What | Tags |
|---|---|---|
| Library folders / organization | group maps beyond a flat list | `?·med·L·missing` |
| Bulk library ops | multi-select export/delete/move | `in·med·M·missing` |
| Library restore merge/dedup | replace-only today | `in·med·M·partial` |
| Named versions + configurable cap + diff | label key versions; diff two | `?·med·M·partial` |
| Revert-to-saved / read-only open / Save-a-Copy | file-level affordances | `in·low·M·missing` |
| Preferences export & import | theme, styles, filters, layout → file | `in·low·S·missing` |
| Flush autosave-to-disk on tab-hide | last edit reaches the bound file, not just IndexedDB | `?·low·M·partial` |
| Settings shortcut + start-screen palette entry | ✅ chord `Ctrl/⌘+,` shipped; start-screen ⌘K Settings entry still open | `in·low·S·partial` |
| PWA app shortcuts / richer manifest | `shortcuts` + `screenshots` for install UI | `?·low·S·partial` |

### 10 · Accessibility & input modalities (7)
A11y is already strong; these are the genuine remaining deltas.
| Gap | What | Tags |
|---|---|---|
| Touch drag-and-drop fallback | outline/board/marker DnD use HTML5 drag → dead on touch | `in·high·M·partial` |
| i18n / localization | UI strings English-only, no locale layer | `?·med·L·missing` |
| RTL layout support | `dir=rtl`, logical CSS, right-growing maps | `?·low·L·missing` |
| Focus trap + return-focus for hand-rolled overlays | Find/Replace, BulkNodeMenu, NodePopover | `in·low·S·partial` |
| `aria-keyshortcuts` on actionable controls | expose the shortcut set to AT | `in·low·S·missing` |
| Stylus / pen affordances | pressure, palm rejection (`pointerType==='pen'`) | `?·low·M·missing` |
| Page-zoom reflow to 200–400% | docks use fixed pixel widths (WCAG 1.4.10) | `?·low·M·partial` |

### 11 · Cross-cutting / modality — audit additions (4)
Categories none of the 10 lenses surfaced.
| Gap | What | Tags |
|---|---|---|
| Map document properties | author/subject/keywords → PPTX/DOCX core props | `in·med·S·missing` |
| Local map encryption / passcode | at-rest protection on a shared/work laptop | `?·med·M·missing` |
| Zen / distraction-free *edit* mode | hide chrome for editing (distinct from Present) | `?·low·S·missing` |
| Per-node review comments | margin remarks separate from the note body | `?·low·M·partial` |

---

## Stays decided-against (no change recommended)

Sound existing decisions for a no-backend local-first app, listed so they're not mistaken for oversights:
real-time collaboration / multiplayer; a networked/cyclic multi-parent graph (TheBrain-style); the
project-management engine (Gantt, dependencies, resources, formulas, custom attributes — and its
fellow-travellers the scan flagged: **due-date reminders/notifications, recurring tasks,
repeat-last-edit**); AI assist; voice/audio capture; LaTeX/math; arbitrary custom fonts; true split-pane
multi-map editing; an infinite Miro-style object canvas; live web/data embeds; and any **hosted** share
link — the shipped offline interactive-HTML export is the local-first answer to that need.

---

## Recommended slice

The three original recommended bundles (quick-wins sprint, "serious maps" pack, "Present like Prezi"
pack) and the "if you build only three things" pick are **all fully shipped** — see `CHANGELOG.md`.
No fresh curated slice is proposed here: what's left in the grouped tables above skews to lower-impact
or product-judgment-gated items (`?` scope), so the next move is opportunistic — pick whatever a real
workflow need surfaces, rather than a speculative priority order.

## Method & sources

Inventory is code-grounded (this repo). The gap scan ran as a 23-agent fan-out (inventory → 10 lenses →
per-lens skeptic verification against the code → dedupe/group → completeness audit), so every "already
shipped" exclusion and every gap status (`missing`/`partial`) is checked against the source — the
skeptic pass is what caught this doc's own first-draft errors (interactive-HTML export and in-map
jump-to-topic, both already shipped). External best-in-class references: XMind (New Sheet from Topic,
Tree Table, ZEN, Pitch), MindNode (stickers, Quick Entry, Colorful), SimpleMind (smart roll-up, colour
wheel), Obsidian (search operators, backlinks/outgoing panes, aliases, quick-switcher, tags pane),
Roam/Logseq (typed links, transclusion, unlinked mentions), Heptabase (mirrors), TheBrain (link-centred
graph, nav history), Notion (slash menu, `@`-date, paste intelligence), Workflowy (quick-add tokens),
Prezi / XMind Pitch (cinematic present), reveal.js / Keynote / PowerPoint (presenter timer, pacing,
fragments, blackout), VS Code (go-to, back/forward, settings sync).
