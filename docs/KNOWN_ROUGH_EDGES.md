# Known rough edges

Unprioritised observations about where MindMap Studio is thin — recorded so they aren't re-found by
the next survey. **This is not a backlog.** Open work lives in `NEXT_STEPS.md`; shipped work in
`CHANGELOG.md`. Nothing here is a commitment to build, and some of it is deliberate (a decision, not a
gap) — check *Deferred / blocked* and *Out of scope* in `NEXT_STEPS.md` before acting on any of it.

Compiled during the 2026-07-02 MindManager-inspired review; moved out of `NEXT_STEPS.md` on
2026-07-26 to keep that file to open items only.

## Category gaps left unbuilt (19-tool survey, concluded 2026-06-16)

The mind-mapping category was surveyed across 19 tools. The B–G gap clusters shipped (see
`CHANGELOG.md`) and the rest was decided. These are the **feasible-but-deprioritised** ones, kept for
awareness only — the *decided* and *blocked* ones live under *Deferred / blocked* and *Out of scope* in
`NEXT_STEPS.md`:

voice / audio-memo capture · idea bank (capture-then-place) · audio or video embed on a node ·
formulas / key-value attributes · spreadsheet data binding · embed-a-live-webpage · idea voting ·
arbitrary custom fonts · named bookmarks · native desktop / mobile shells · an infinite Miro-style
object canvas.

## Canvas / interaction

- Callout bubbles have no on-canvas drag (`dx`/`dy` are fixed at creation).
- Unlabelled boundaries are selectable only via their 6 px border rim.
- Type-to-edit **replaces** the topic text — people expecting append are surprised (Escape/undo
  recovers).
- Grid / timeline / radial spacing keys off the single largest node, so one image topic inflates every
  cell or ring.
- The wrap grip only appears on single-selected nodes ≥ 72 px tall, desktop only.
- Freeform **group** drags skip alignment guides and snapping.
- The relate grip is hidden on touch (the "Link to…" menu is the fallback).
- Floating topics auto-stack below the map in tree layouts; free placement needs freeform mode.

## Rich-text editing

Both editors (the Notes panel and the inline topic editor) run on selection/Range commands in
`src/richTextCommands.ts` — no `document.execCommand` anywhere. Two known behaviours:

- **Inline formatting requires a selection.** `execCommand` used to arm a "typing style" so the next
  characters you typed came out bold; there is no standards-track way to reproduce that, so Ctrl+B with
  a collapsed caret does nothing. Select, then format.
- **Un-listing a *subset* of a list's items lifts them out above the list** rather than splitting the
  list in place, so a partial toggle-off can reorder items. Toggling a whole list off is exact.

## Views / panels

- Kanban has no column reorder, WIP limits, in-board card creation, or ordering (tags are
  alphabetical).
- The presentation keyboard lacks End / PageUp / PageDown, and the elapsed timer resets on exit.
- The brainstorm timer has no audible time's-up cue and no custom duration.
- The query grammar lacks `OR`, `completion:`, and date-range comparisons.
- Natural-language dates skip month-name forms ("Mar 14") and relative weeks/months.
- `markerSuggest` cue words are English-only. (Also noted under the deferred i18n analysis in
  `NEXT_STEPS.md` — same underlying gap.)
- Flat vector markers cover 21 of 46 glyphs; the rest fall back to platform emoji, which weakens the
  identical-everywhere rendering guarantee.

## Files / IO

- Version history is capped at 30 snapshots per map, with no diff view.
- Deep links resolve only on the same machine / library.
- Cross-tab editing of the same map is warn-only — ignoring the warning still loses the losing tab's
  autosave.
- The 5 MB attachment cap and 800 px image downscale limit document-heavy use.
- No `.txt` / `.csv` / `.html` **file** import (paste-only).
- Office imports are structure-only: `.docx` ignores hyperlinks and images, `.xlsx` expects
  depth-per-column.
- Save-back to disk and OS file association are Chromium-desktop-only (documented behaviour).
