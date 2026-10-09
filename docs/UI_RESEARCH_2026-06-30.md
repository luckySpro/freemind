# UI improvement research — 2026-06-30

A deep research pass on how to improve MindMap Studio's UI. Grounded four ways:

1. **The app run live and screenshotted** — Start (light + dark), the editor canvas, and a 390px
   mobile viewport (Playwright + the bundled Chromium).
2. **A full code inventory** of the design system, chrome layout, node rendering, and inspector.
3. **External research** (six fan-out agents) on 2025–2026 mind-map / canvas-app UX, infinite-canvas
   interaction patterns, visual-design-system trends, React-Flow accessibility, and onboarding.
4. **Cross-checks back into the code** to confirm each recommendation isn't already done.

Every external claim is cited inline; a consolidated source list is at the end.

---

## TL;DR

The app is **already polished and feature-complete** — it has been through ~12 phases of UX/UI
remediation (`NEXT_STEPS.md` / `CHANGELOG.md`), and it shows: a coherent emerald brand, real
app-wide dark mode, `:focus-visible` rings, a `⌘K` palette, themed Start dialogs, responsive bottom
sheets, animated layout. So this is **not** a "fix what's broken" list. It's the next tier — closing
the gap between *polished-functional* and *best-in-class feel*. Highest-leverage moves, in order:

1. **A transient, selection-anchored contextual action bar on the canvas** — the single biggest
   convention every modern canvas tool shares that we don't. (§2)
2. **Finish the themed-dialog migration** — native `window.prompt`/`confirm` still live in the
   editor canvas, though Start was already migrated. A real dark-mode/PWA breakage. (§3)
3. **Mature the design tokens** — add type, weight, motion, elevation, and opacity scales; the
   chrome should read as *designed*, not *assembled*. Inline styles are pervasive in the node layer
   and one (`RichEditToolbar`) hard-codes `#fff` and breaks in dark mode. (§1)
4. **Give the map more room** — ~44% of a 1440px width is chrome; the 768px tablet tier is cramped.
   The contextual bar (#1) is what lets us reclaim it. (§4)
5. **Go React-Flow-native on keyboard a11y** — we have landmarks + a live region but not the
   Tab-to-node / arrow-move / announced-selection model RF now gives for free. (§5)

A suggested additive phasing is at the end. The guiding tension from the research: **transient,
selection-anchored floating *toolbars* are loved; persistent floating *panels* that occlude the
canvas are not** — Figma shipped floating panels in UI3 and **reverted to fixed-but-resizable** ones
after heavy users reported the canvas felt cramped
([Figma UI3 approach](https://www.figma.com/blog/our-approach-to-designing-ui3/),
[Fixed panels are back](https://forum.figma.com/suggest-a-feature-11/launched-fixed-panels-are-back-23789)).
Scope every "floating" idea below to *transient + auto-dismissing*, never persistent occlusion.

---

## 1. Visual design system — mature the tokens

**Current state** (`src/design/tokens.ts`, `src/mindmap/theme.ts`, `src/design/editor.css`,
`src/useAppearance.ts`):

- **Strong:** semantic, theme-reactive color (`--ed-*` / `--st-*`), an 8-step spacing scale, a
  5-step radius scale, focus rings, and `prefers-reduced-motion` already handled in `editor.css:1346`,
  `start.css:769`, and `animateLayout.ts`.
- **Thin:**
  - **Type scale** is only 5 sizes (11–16px) with no header tier; weight jumps 400→600→700 (no 500).
    Titles render ~15px via ad-hoc inline styles, off-scale.
  - **No motion tokens** — durations (`0.12s`/`0.16s`/`0.18s`/`1s`) are hard-coded inline. No
    `--ease`/`--dur-*` vocabulary.
  - **Elevation is two flat shadows** (`--ed-shadow`, pop). No semantic ramp (resting / raised /
    overlay / dialog).
  - **No opacity scale** — `rgba(…, 0.06/0.08/0.1/0.18/0.22…)` literals scattered.
  - **Inline styles pervasive** in the node layer (`TopicNode.tsx`); the `RichEditToolbar` uses a
    literal `#fff` background + inline shadow that **won't follow dark mode**; there are **two `Chip`
    implementations** (`src/Chip.tsx` on-node vs `primitives.tsx` filter chip).

**What the 2025–2026 token consensus says:**

- **One token layer, two semantic tiers.** shadcn's now-standard pattern is *base + `-foreground`
  pairs* (`background`/`foreground`, `card`/`card-foreground`, `popover`, `primary`, `muted`, `accent`,
  `destructive`, plus `border`/`input`/`ring`); components reference only semantic tokens, never raw
  colors ([shadcn theming](https://ui.shadcn.com/docs/theming)).
- **Map onto Radix's 12-step roles.** Steps 1–2 backgrounds, 3–5 component/interactive fills (incl.
  hover/active), 6–8 borders/separators, 9–10 solid brand, 11–12 text — with **alpha variants** for
  tinting over a textured/colored backdrop. For a mind-map this maps cleanly: node fills = 3–5, node
  borders = 6–8, connectors = 9, labels = 11–12; the alpha variants are exactly right for node tints
  over the dotted canvas ([Radix Colors](https://www.radix-ui.com/colors),
  [understanding the scale](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)).
- **OKLCH for perceptually even palettes** (shadcn + Tailwind v4 both moved to it)
  ([Tailwind v4](https://tailwindcss.com/blog/tailwindcss-v4)).
- **DTCG is now a stable spec (2025.10).** If tokens are ever externalized, emit Design-Tokens-
  Format-Module JSON so they round-trip through Figma / Style Dictionary instead of a bespoke shape
  ([W3C DTCG stable](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/)).
- **Type as role presets**, not loose sizes — each token bundles size + line-height + tracking +
  weight (Vercel Geist's model); use a mono face for IDs/labels/keyboard-hints
  ([Geist typography](https://vercel.com/geist/typography)).

**Recommendation**
- Extend `tokens.ts` with `type` (role presets), `weight` (incl. 500), `elevation` (4 rungs),
  `motion` (`dur-fast/base/slow` + `ease-standard`/`ease-spring`), and `opacity` scales — the one
  source of truth the working agreement already mandates.
- Sweep the worst inline-style offenders: fix `RichEditToolbar`'s dark-mode bug first, unify the two
  `Chip`s. This is the maintainability pass CLAUDE.md asks for, doubling as a design win.
- **Add an automated contrast assertion to `pnpm gate`** for the node-fill/label token pairs (the
  canvas renders text over arbitrary node colors). Keep a WCAG 4.5:1 check for legal cover and design
  to **APCA Lc ≥ 75** (Radix steps 11/12 already guarantee Lc 60/90; APCA is the WCAG-3 candidate and
  far more reliable in dark mode) ([WCAG vs APCA](https://weable.pro/products/weable-color/blog/wcag-vs-apca-comparison),
  [APCA in a nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html)).

---

## 2. On-canvas interaction — adopt the contextual action bar (marquee change)

**Current state** (`TopicNode.tsx`, screenshot `03-editor-light`): a selected node carries an
always-on `＋` circle, a hover action pill (note / open-note / priority), a right-edge relate grip, a
left task checkbox, and a collapse toggle. The inventory's phrase: *node hover crowding* — up to five
affordances compete at the node edge, several hover-gated so they pop in and out.

**What the leaders do** — a floating, contextual toolbar anchored to the selection is now the default:

| Tool | On-selection control | Properties surface |
|------|----------------------|--------------------|
| **MindMeister** | floating "topic toolbar" — "no big toolbars stealing screen real estate, just a few small ones around the perimeter" ([editor makeover](https://support.mindmeister.com/hc/en-us/articles/21638441529362-MindMeister-Map-Editor-Makeover)) | right vertical styling toolbar (5 icons) |
| **Whimsical** | "contextual toolbars that place all relevant controls at your fingertips… without browsing menus or memorizing shortcuts" ([Whimsical mind-maps](https://help.whimsical.com/get-started/mind-maps)) | inline |
| **tldraw** | floating contextual toolbar rendered above the selected shape ([tldraw contextual toolbar](https://tldraw.dev/examples/contextual-toolbar)) | left floating props |
| **Excalidraw** | left-side props panel appears on selection ([Excalidraw UIOptions](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/ui-options)) | left panel |
| **Adobe Ps/Ai** | "Contextual Task Bar" surfacing the most relevant next actions ([Adobe task bar](https://helpx.adobe.com/illustrator/using/contextual-task-bar.html)) | — |

Design specifics from the research:
- **Keep it small** (<10–12 items; for <5, order by popularity), **adjacent to the selection**, and
  **gone when nothing is selected** ([NN/G contextual menus](https://www.nngroup.com/articles/contextual-menus/)).
- **Debounce appearance/reposition** so it settles instead of jittering — Tiptap's BubbleMenu (the
  canonical floating-selection toolbar) debounces selection-change updates at **250ms**
  ([Tiptap BubbleMenu](https://tiptap.dev/docs/editor/extensions/functionality/bubble-menu)).
- **Transient, not persistent.** This is exactly the line Figma found: a selection-anchored toolbar
  is welcomed; a persistent floating *panel* that occludes the canvas is what they reverted
  ([Figma UI3](https://www.figma.com/blog/our-approach-to-designing-ui3/)).

**Recommendation**
- Consolidate the scattered on-node affordances into **one transient action bar anchored above the
  selection** (color/shape · add-child · note · marker · more → the existing rich context menu).
  Keep the inline `＋` for the discoverable "grow" gesture; move the rest into the bar so the node
  edge stops competing. This extends the Phase-7 C6 popover→"More…" pattern from a fallback into the
  primary surface, and it fits the thin `src/mindmap/contract.ts` seam (tldraw is the reference for a
  slot-based UI contract over a canvas).
- This is the highest-impact single change *and* it's what frees the chrome budget in §4.

---

## 3. Consistency — finish the themed-dialog migration

**Concrete finding:** Start was migrated off native dialogs to themed ones (`MapDialogs.tsx`,
`renameMapTitle`), but the **editor canvas still uses native `window.prompt`/`window.confirm`**:

- `FlowMindMap.tsx:1024` summary label · `:1893` relationship label · `:1951` delete-relationship
- `App.tsx:1255` name-a-view · `Panels.tsx:2926` image URL · `:2939` link URL · plus `App.tsx` confirms

These ignore the app theme, look wrong in dark mode, and — per the team's own `MapDialogs.tsx:7`
comment — "in some PWAs return null silently." The team already decided against native dialogs on
Start; the canvas simply wasn't swept.

**Recommendation:** reuse the existing `Dialog`/`MapDialogs` primitive for these editor prompts.
Mechanical, low-risk, removes a whole class of dark-mode/PWA breakage — a good first PREP-style commit.

---

## 4. Layout density & responsive — make the map the hero

**Current state** (inventory + screenshots): desktop chrome = 56px rail + 280px dock + 300px
inspector ≈ **636px / 44%** of a 1440px width; the two-row toolbar's Row 2 wraps on narrow widths;
the 641–1024px tablet tier keeps rail+dock+inspector and gets cramped (~768px portrait → a thin
canvas). Mobile itself is genuinely good (sheets, safe-area, `dvh`, touch sizing).

**What the research says:**
- Dedicated mappers win by giving the *map* the room; MindMeister is dinged because depth "past five
  levels feels cramped" ([MindMeister 2026](https://www.mindmeister.com/blog/the-easiest-mind-mapping-software-to-use-in-2026)).
- **Don't silently re-lay-out** — stable positions build the user's cognitive map; auto-layout that
  moves everything destroys spatial memory, so make it user-triggered and *animated*
  ([cognitive maps for hierarchical spaces](https://pmc.ncbi.nlm.nih.gov/articles/PMC12452280/)).
- Figma's reversal again: fixed-but-resizable panels beat floating ones for dense work
  ([Figma UI3](https://www.figma.com/blog/our-approach-to-designing-ui3/)).

**Recommendation**
- Make the left dock **collapsed-by-default** (icon rail that expands on demand) so the canvas is the
  default hero — the tabbed dock already exists; this is a default + a collapse affordance, *not* a
  floating panel.
- Add a **tablet breakpoint** that auto-collapses the dock and presents the inspector as an overlay
  sheet rather than stealing canvas width.
- Once §2 lands, audit whether Row 2 can shed controls into the contextual bar / `⌘K`.

---

## 5. Accessibility — go React-Flow-native

**Current state:** good landmarks (`aria-roledescription="mind map canvas"`, a labelled region), a
polite live region (`FlowMindMap.tsx:1852`), announced save-state, focus-visible rings, skip-to-canvas.
But the `<ReactFlow>` config (`:1855`) doesn't opt into RF's built-in graph keyboard model, and custom
nodes aren't individually announced.

**What RF gives for free now**
([React Flow accessibility](https://reactflow.dev/docs/guides/accessibility/),
[Synergy Codes — accessible diagrams with React Flow](https://www.synergycodes.com/blog/building-usable-and-accessible-diagrams-with-react-flow)):
- `nodesFocusable`/`edgesFocusable` → **Tab between nodes/edges**, Enter/Space to select, Esc to clear.
- Arrow-key node movement (Shift = faster); `autoPanOnNodeFocus` pans the focused node into view.
- An `aria-live="assertive"` descriptions region announces moves; `AriaLabelConfig` localizes labels.
- **Canvas content is invisible to screen readers unless each custom node is individually accessible**
  — our nodes are rich custom components, so they need a per-node accessible name/role.

**The mind-map advantage (and the under-solved problem):** free-form canvases (tldraw, Figma,
Excalidraw) struggle to linearize a 2D graph for a screen reader — tldraw is candid it's still in a
research phase, and W3C calls "what is the document" genuinely hard
([tldraw a11y megathread](https://github.com/tldraw/tldraw/issues/5215),
[W3C canvas a11y use cases](https://www.w3.org/WAI/PF/HTML/wiki/Canvas_Accessibility_Use_Cases)). But a
**mind map *is* a tree** — so the tractable, best-in-class move is to expose a synchronized
`role="tree"` / `role="treeitem"` DOM view (set RF's per-node `ariaRole="treeitem"`) as the
*screen-reader-primary* surface, announcing per-node child/sibling counts. We already have an Outline
panel that's structurally a tree — wiring it (or a mirror) to proper tree ARIA gets most of the way.

**WCAG 2.2 specifics that bite canvas apps** (the four to audit):
- **2.5.7 Dragging Movements (AA):** drag-to-relate needs a *single-pointer* alternative (keyboard
  alone doesn't satisfy it). We **already have this** — right-click → *Link to…* → click the target is
  exactly click-to-connect. Make sure node *move* has a non-drag path too
  ([Understanding 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)).
- **2.5.8 Target Size (AA):** node handles / edge buttons / zoom controls ≥ **24×24px** (touch already
  bumps to 44px; verify the desktop 20–24px affordances).
- **2.4.11 Focus Not Obscured (AA):** the floating toolbar / minimap must not cover the focused node —
  `autoPanOnNodeFocus` helps; confirm.
- **2.4.7 / 2.4.13 Focus Appearance:** the focus ring must be visually distinct from the *selection*
  highlight (canvases often conflate them).
([WCAG 2.2 new criteria](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/))

**Recommendation:** decide explicitly how RF's keyboard model coexists with the app's custom keymap
(`keyIntent.ts`) — adopt RF Tab/arrow nav *or* document why the custom map supersedes it; build the
canvas as a **composite widget** (one tab stop, roving tabindex, arrow keys move focus to the nearest
neighbour — RF's arrows move the *selected node*, not focus, so this part is on us); give `TopicNode`
a proper accessible name/role; wire the Outline to `role="tree"`; and route selection changes through
the assertive region. Keep ARIA minimal (WebAIM 2024: more ARIA correlated with *more* detected
errors) and test on real NVDA + VoiceOver. This is the difference between "has a live region" and
"navigable by keyboard alone."

---

## 6. Canvas navigation polish (zoom / fit / minimap)

Mostly already good (RF defaults, a corner minimap, `defaultViewport` restore, `minZoom 0.2`/`maxZoom 3`).
Worth confirming against the conventions:
- **Zoom origin = cursor, not center** — the single most-cited zoom-feel rule
  ([infinite-whiteboard](https://medium.com/@tom.humph/creating-an-infinite-whiteboard-97527e886712)).
  RF does this by default; keep it.
- **Offer both fit-all and fit-selection**, with conventional **Shift+1 / Shift+2** (and `⌘0` = 100%)
  ([Figma zoom](https://help.figma.com/hc/en-us/articles/360041065034-Adjust-your-zoom-and-view-options)).
- **Animate viewport changes** (RF exposes `duration` on `fitView`/`setViewport`/`setCenter`) and
  **clamp `fitView` `maxZoom`** so fitting a single node doesn't slam to max zoom
  ([FitViewOptions](https://reactflow.dev/api-reference/types/fit-view-options)).
- **Minimap: progressive disclosure** — keep it toggleable and default-off for small maps; it's
  redundant clutter until the graph is large ([minimap research](https://alejandro61299.github.io/Minimaps_Personal_Research/)).
  (We already have a `Minimap ▾` toggle — good.)

---

## 7. Motion & depth (high polish, after §1)

- **Motion is functional, not decoration** — communicate status, guide attention, confirm actions;
  keep micro-interactions ≤ ~500ms ([motion UI 2025](https://epixs.in/motion-ui-micro-interactions-2025/),
  [M3 easing & duration](https://m3.material.io/styles/motion/easing-and-duration/tokens-specs)).
- **Spring-settle for *spatial* changes** (node appears, branch expands — overshoot reads as "alive");
  linear/standard for *state* changes (selection highlight). M3 Expressive (May 2025) formalized this
  spatial-spring vs effects split ([M3 Expressive](https://m3.material.io/blog/building-with-m3-expressive)).
- **Depth = floating chrome only.** Two-layer soft shadows (a sharp "key" + a soft "ambient",
  Fluent-2 style) for toolbars/menus/minimap/palette; keep the canvas and nodes flat so elevation
  *means* "this floats above the map" ([Fluent 2 elevation](https://fluent2.microsoft.design/elevation)).
- **In dark mode, elevation = surface lightness, not shadow.** Shadows vanish on dark; raise surfaces
  by lightening them, never pure black — baseline **#121212** (pure white-on-black causes halation).
  Desaturate brand/node colors on dark so they don't vibrate
  ([Material dark theme](https://m2.material.io/design/color/dark-theme.html)).
- Everything reduced-motion-gated (already the project's habit) plus, ideally, an in-app toggle.

**Glassmorphism / Apple "Liquid Glass" (June 2025):** trendy but contested for readability; the
consensus for dense productivity tools is **glass as a thin garnish at most** — a frosted *floating
toolbar* over a solid scrim is fine; **frosted text-bearing nodes are not**
([Axess Lab on glass a11y](https://axesslab.com/glassmorphism-meets-accessibility-can-frosted-glass-be-inclusive/),
[Setproduct glass vs liquid glass](https://www.setproduct.com/blog/liquid-glass-vs-glassmorphism)).
Recommendation: **skip it on the working surface.**

---

## 8. Onboarding & empty states (already strong — small refinements)

The app is in good shape here (first-run card, template/example gallery with node counts, `⌘K`,
"Learn the app" tips, actionable empty states, a visible "Saved locally" cue). Against the research:

- **Never open to a literally empty viewport** — NN/G says an empty screen "creates confusion."
  We already seed a starter map and a "3 things to try" card (screenshot `03-editor-light`). ✓
  ([NN/G empty states](https://www.nngroup.com/articles/empty-state-interface-design/))
- **Onboarding by doing > tours** — Grammarly's "play with error-filled demo content" model; **78% of
  users abandon tours by step three**, so avoid an upfront overlay tour (we don't have one — keep it
  that way) and prefer behavior-triggered contextual hints, 3–5 max
  ([Appcues tours](https://www.appcues.com/blog/product-tours-ui-patterns),
  [SaaSFactor](https://www.saasfactor.co/blogs/why-most-product-tours-fail-and-how-to-implement-contextual-onboarding)).
- **Distinguish two empty states**: first-run (onboarding) vs everything-deleted (a lightweight
  "create / browse templates" prompt, *not* a replay of onboarding)
  ([Pencil & Paper](https://www.pencilandpaper.io/articles/empty-states)). Worth a quick audit.
- **Templates should encode a *method*, not just a shape** (Miro's design-sprint zones / affinity
  staging area). Our SWOT / Project-plan / Brainstorm templates already lean this way; consider adding
  inline method hints inside the seeded map ([Miro review](https://www.uxguides.com/tools/miro-review)).
- **No-signup personalization on-canvas:** since there's no signup to ask "what are you mapping?", a
  lightweight first-run intent picker (brainstorm / notes / plan / decision) that swaps the seeded
  template recreates the HubSpot/Pinterest "feels relevant" effect without a backend
  ([Appcues onboarding](https://www.appcues.com/user-onboarding)). Optional, low-cost.

---

## 9. The AI question (context, not a recommendation)

Every 2026 roundup now frames the category around AI ("AI-tested", XMind Copilot brought "directly
into the map-building workflow", Whimsical/Storyflow text-prompt generation)
([best mind mapping tools 2026](https://storyflow.so/blog/best-mind-mapping-tools-2025),
[Atlas roundup](https://www.atlasworkspace.ai/blog/best-mind-mapping-software)). The project **decided
against AI assist (2026-06-15)** for sound local-first reasons (`NEXT_STEPS.md`). **No reversal
recommended** — flagging only that the *positioning* gap is now universal, and the manual
paste-outline→map path remains the honest answer. If ever revisited, a keyless copy-prompt → paste-
result bridge is the only no-backend fit, as already noted in the backlog.

---

## Suggested phasing (additive, each landed green via `pnpm gate`)

| Phase | Work | Impact | Effort |
|------|------|--------|--------|
| **UI-1** | Themed dialogs for the editor canvas (§3) | Med — removes dark-mode/PWA breakage | **S** |
| **UI-2** | Token maturation: type/weight/motion/elevation/opacity scales; fix `RichEditToolbar` dark-mode; unify `Chip`; add a contrast assertion to the gate (§1, §7) | High — everything downstream reads *designed* | **M** |
| **UI-3** | Transient selection-anchored contextual action bar; de-crowd node affordances (§2) | **Highest** — biggest convention gap | **M–L** |
| **UI-4** | Collapsible-dock default + tablet inspector-overlay breakpoint (§4) | High — canvas as hero | **M** |
| **UI-5** | React-Flow-native keyboard a11y + per-node accessible names (§5) | Med–High — real a11y | **M** |
| **UI-6** | Motion/depth polish on the new tokens; zoom-to-selection + Shift+1/2 (§6, §7) | Polish | **S–M** |
| **UI-7** | Empty-state split + optional first-run intent picker (§8) | Low–Med | **S** |

UI-3 is the marquee change; UI-1/UI-2 are the cheap groundwork that makes the rest clean. Land UI-2 as
a PREP-style token commit *before* UI-3/UI-6 build on it (matches CLAUDE.md's PREP-then-feature rule).

---

## Appendix — cross-tool convention cheat-sheet (2025–2026)

- **Node creation:** Tab = child, Enter = sibling is the structured-mapper standard (XMind,
  MindMeister, MindNode, classic MindManager — which this app replaces). Miro uses Insert/Enter; FigJam
  uses ⌘-Return combos. We already do Tab/Enter — keep it; offer alternates as remappable.
- **On-selection control:** transient floating contextual toolbar (MindMeister, Whimsical, tldraw,
  Adobe). *Not* a persistent floating panel (Figma reverted those).
- **Properties surface:** right-side format/layout panel for structured mappers (XMind, MindMeister,
  MindNode); left-side props panel for freeform whiteboards (Excalidraw). We use a right inspector — on
  convention.
- **Auto-layout:** on by default with a per-node toggle (Miro); never silently re-layout (animate +
  user-trigger). We have Free-layout — keep auto-layout changes animated.
- **Zoom:** cursor-origin, animated transitions, fit-all + fit-selection (Shift+1 / Shift+2), clamp
  fit max-zoom.
- **Minimap:** corner, toggleable, default-off for small maps.

## Sources

**Design system / tokens / color**
- [shadcn/ui — Theming](https://ui.shadcn.com/docs/theming) ·
  [Radix Colors](https://www.radix-ui.com/colors) ·
  [understanding the scale](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale) ·
  [W3C DTCG — first stable version](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/) ·
  [Tailwind v4](https://tailwindcss.com/blog/tailwindcss-v4) ·
  [Vercel Geist typography](https://vercel.com/geist/typography) ·
  [Scalable design system with tokens](https://shadisbaih.medium.com/building-a-scalable-design-system-with-shadcn-ui-tailwind-css-and-design-tokens-031474b03690) ·
  [React UI libraries in 2025](https://makersden.io/blog/react-ui-libs-2025-comparing-shadcn-radix-mantine-mui-chakra)

**Depth / dark mode / motion / glass**
- [Fluent 2 — Elevation](https://fluent2.microsoft.design/elevation) ·
  [designsystems.surf — elevation](https://designsystems.surf/articles/depth-with-purpose-how-elevation-adds-realism-and-hierarchy) ·
  [Material — Dark theme](https://m2.material.io/design/color/dark-theme.html) ·
  [M3 Expressive](https://m3.material.io/blog/building-with-m3-expressive) ·
  [M3 — easing & duration](https://m3.material.io/styles/motion/easing-and-duration/tokens-specs) ·
  [Motion UI & micro-interactions 2025](https://epixs.in/motion-ui-micro-interactions-2025/) ·
  [Axess Lab — glass & accessibility](https://axesslab.com/glassmorphism-meets-accessibility-can-frosted-glass-be-inclusive/) ·
  [Setproduct — glass vs liquid glass](https://www.setproduct.com/blog/liquid-glass-vs-glassmorphism)

**Accessibility / color contrast**
- [React Flow — Accessibility](https://reactflow.dev/docs/guides/accessibility/) ·
  [Synergy Codes — accessible diagrams with React Flow](https://www.synergycodes.com/blog/building-usable-and-accessible-diagrams-with-react-flow) ·
  [JointJS — diagram accessibility](https://www.jointjs.com/blog/diagram-accessibility) ·
  [WCAG vs APCA](https://weable.pro/products/weable-color/blog/wcag-vs-apca-comparison) ·
  [APCA in a nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html) ·
  [WCAG 2.2 — what's new](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/) ·
  [Understanding 2.5.7 Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) ·
  [W3C APG — keyboard interface (roving tabindex / composite)](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) ·
  [W3C — canvas accessibility use cases](https://www.w3.org/WAI/PF/HTML/wiki/Canvas_Accessibility_Use_Cases) ·
  [Figma — keyboard accessibility](https://www.figma.com/blog/introducing-keyboard-accessibility-features/) ·
  [Miro — accessibility for screen readers](https://help.miro.com/hc/en-us/articles/4403828752274-Miro-accessibility-features-for-screen-reader-users) ·
  [tldraw — a11y megathread](https://github.com/tldraw/tldraw/issues/5215)

**Canvas interaction / contextual UI / zoom**
- [Adobe — Contextual Task Bar](https://helpx.adobe.com/illustrator/using/contextual-task-bar.html) ·
  [tldraw — contextual toolbar](https://tldraw.dev/examples/contextual-toolbar) ·
  [tldraw — review of hover areas](https://tldraw.dev/blog/a-review-of-design-tool-hover-areas) ·
  [Tiptap — BubbleMenu](https://tiptap.dev/docs/editor/extensions/functionality/bubble-menu) ·
  [NN/G — contextual menus](https://www.nngroup.com/articles/contextual-menus/) ·
  [NN/G — expandable menus (pie/radial)](https://www.nngroup.com/articles/expandable-menus/) ·
  [Figma — designing UI3](https://www.figma.com/blog/our-approach-to-designing-ui3/) ·
  [Figma — fixed panels are back](https://forum.figma.com/suggest-a-feature-11/launched-fixed-panels-are-back-23789) ·
  [React Flow — viewport](https://reactflow.dev/learn/concepts/the-viewport) ·
  [React Flow — FitViewOptions](https://reactflow.dev/api-reference/types/fit-view-options) ·
  [React Flow — MiniMap](https://reactflow.dev/api-reference/components/minimap) ·
  [Steve Ruiz — creating a zoom UI](https://www.steveruiz.me/posts/zoom-ui) ·
  [Cognitive maps for hierarchical spaces](https://pmc.ncbi.nlm.nih.gov/articles/PMC12452280/)

**Competitor UIs**
- [Best visual thinking tools 2026 — Storyflow](https://storyflow.so/blog/best-visual-thinking-tools-2026) ·
  [Best mind mapping tools 2026 — Storyflow](https://storyflow.so/blog/best-mind-mapping-tools-2025) ·
  [Easiest mind mapping software 2026 — MindMeister](https://www.mindmeister.com/blog/the-easiest-mind-mapping-software-to-use-in-2026) ·
  [9 best mind mapping software — Atlas](https://www.atlasworkspace.ai/blog/best-mind-mapping-software) ·
  [MindMeister editor makeover](https://support.mindmeister.com/hc/en-us/articles/21638441529362-MindMeister-Map-Editor-Makeover) ·
  [Miro — mind map](https://help.miro.com/hc/en-us/articles/360017730753-Mind-map) ·
  [Whimsical — mind maps](https://help.whimsical.com/get-started/mind-maps) ·
  [Heptabase — Sept 2025 redesign](https://wiki.heptabase.com/newsletters/2025-09-12) ·
  [Excalidraw — UIOptions](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/ui-options) ·
  [MindNode — keyboard shortcuts](https://www.mindnode.com/support/guides/keyboard-shortcuts) ·
  [Scapple — overview](https://www.literatureandlatte.com/scapple/overview)

**Onboarding / empty states**
- [NN/G — empty states](https://www.nngroup.com/articles/empty-state-interface-design/) ·
  [NN/G — progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) ·
  [NN/G — instructional overlays](https://www.nngroup.com/articles/mobile-instructional-overlay/) ·
  [Pencil & Paper — empty states](https://www.pencilandpaper.io/articles/empty-states) ·
  [Appcues — product tours](https://www.appcues.com/blog/product-tours-ui-patterns) ·
  [SaaSFactor — why tours fail](https://www.saasfactor.co/blogs/why-most-product-tours-fail-and-how-to-implement-contextual-onboarding) ·
  [Miro review — templates as method](https://www.uxguides.com/tools/miro-review)

---

*Method note: the external research was gathered via WebSearch (WebFetch was blocked by the egress
proxy for most design domains, so some primary-source phrasing is via search-result excerpts —
substantive claims are corroborated across multiple sources and cited to the canonical URL). The
codebase findings and screenshots were produced first-hand in this session against the live dev
server.*
