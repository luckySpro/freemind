# MindMap Studio — working agreement

A local-first, offline mind-mapping PWA replacing Corel/Mindjet MindManager.
React 19 + Vite + TypeScript, built on **React Flow** (`@xyflow/react`, MIT). Sibling
to TP Studio and MECE Studio. These habits override default behavior — hold both
of us to them.

## The ship loop — "green before done"

The full local gate is **one** command, fail-fast, in this order:

```sh
pnpm gate
# tsc --noEmit → biome check . → knip → feature-coverage → vitest run --coverage → vite build → size budget
```

The `vitest run --coverage` step enforces a no-regression coverage floor
(`vitest.config.ts` → `coverage.thresholds`); raise it as coverage climbs.

- Run `pnpm gate` before every push. Nothing is "done" until the gate is green
  **and** CI is green.
- After pushing, watch CI (`.github/workflows/ci.yml`). If it goes red,
  goal-seek from the **actual** failure logs (`gh run view --log-failed`), not
  guesses, and re-push until green. Then say what landed.
- Never report success over failing checks. If a test fails, show the output.
  When something is verified, say so plainly — lead with the evidence.

## Plan before big changes

- **L-effort** (3+ files, a new module, a schema/data migration, or real design
  ambiguity): pause and give a short plan first — files to touch, the approach,
  alternatives rejected, how it'll be verified. Small, clear changes: just do it.
- Risky or cross-cutting: land a behavior-preserving **PREP** commit first (pin
  current behavior with a test + extract the seam the change needs), then build
  the change on top. Keep prep and feature as separate commits.

## Verify your own work

- Anything observable (the canvas, an import result, CLI output): run it and
  verify before handing back. For visual/canvas changes, render it and confirm
  it looks right (dev-server screenshot via the `mindmap-dev` preview), and back
  it with a deterministic test where possible.
- Lead with evidence (run output / screenshot / passing test), not "should work".

## Commit & docs hygiene

- Small, focused commits. **Conventional Commits** (feat / fix / refactor /
  chore / docs). The message explains WHY. Don't bundle a refactor into a feature.
- Before pushing a feature, take a maintainability pass (naming, dead code,
  simpler shape), then re-run the gate.
- Update docs in the **same session** as the code: `README.md`, `CHANGELOG.md`,
  any user guide. When a fact changes, grep for the old reality and fix every
  stale mention. `NEXT_STEPS.md` holds **OPEN items only** — shipped work lives
  in `CHANGELOG.md`.

## Code quality bars

- Keep a **framework-free core** that's pure and unit-tested. The canonical model
  (`src/model/`) and the import/export adapters (`src/io/`, plus the heavy `.mmap`
  importer in `src/import/`) are deterministic with no DOM coupling. The React Flow canvas is
  wrapped behind a thin contract (`src/mindmap/contract.ts`) so the renderer stays replaceable.
- **One source of truth** for any cross-cutting rule: the canonical model
  (`src/model/types.ts`), the bundle budget (`scripts/bundle-budget.mjs`, imported by both the gate
  and the stats dashboard — it was a hand-copied constant in two files and drifted 21 kB),
  validation — no drift between call sites.
- New capabilities **additive and opt-in / off-by-default**. Prefer an optional
  field over a data migration.

## Fix what's broken — honestly

- Spot something stale / wrong / dead → fix it this session (don't defer); chase
  the root cause but stay bounded to the fix + its siblings. Respect "leave it".
- Don't paper over warnings to hit zero. A real issue gets fixed; a false
  positive gets a **documented suppression** (a `biome-ignore` with a reason, a
  knip `@public` tag / config entry). The warning list should mean something.

## Work efficiently

- When a question spans 2+ areas of the code, fan out parallel exploration
  sub-agents instead of serial grepping; use the cheapest model that's enough.

## Stack notes / gotchas (this machine)

- Package manager is **pnpm** (npm's PowerShell shim is CLM-blocked). pnpm 11
  build approvals live in `pnpm-workspace.yaml` (`allowBuilds`), **not**
  package.json. Drive pnpm/node directly.
- `C:\devtools` is AppLocker-allowlisted, so `node_modules` binaries run there.
- Dev server is registered for preview as **`mindmap-dev`** on port **5175**.
- Engine: React Flow (`src/mindmap/flow/`). Canonical model: `src/model/types.ts`.
  Import/export adapters: `src/io/`. The `.mmap` importer (`src/import/`) is **one-way + lossy by design**.
- Scope: **brainstorming/knowledge + presentations/sharing**. The task / Gantt /
  SmartRules / resource PM layer is **out of scope** unless we decide otherwise.

## Response style

- **Terse.** Answer the question; cut filler. No preamble ("Sure, here's…") and no
  postamble ("Let me know if…").
- **No plan narration** unless the task is genuinely ambiguous — then a short plan,
  otherwise just do it.
- **Explain decisions only when non-obvious.** Skip the rationale for routine choices;
  spell it out when a reader would otherwise wonder "why this way?".
- **Show only changed code**, not whole files — the diff/hunk, with just enough
  surrounding context to place it.
- **Keep reasoning visible enough to catch wrong turns** — surface the key assumption
  or step so a wrong one is obvious, without narrating every move.
