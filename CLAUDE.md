# CLAUDE.md

Guidance for working in this repo. `README.md` covers setup and architecture; this file
records rules, gotchas, and learnings. Add to **Learnings** when you discover something
non-obvious.

## Ground rules

- **Never `git commit` or `git push`.** The user reviews every change and commits
  themselves. Leave work uncommitted. (Remote: `origin` → github.com/torch-supply/srd-cards-v2, branch `main`.)
- **SRD 5.2.1 is the source of truth.** All reference content comes from the official
  PDF at `docs/SRD_CC_v5.2.1.pdf` (gitignored, along with all of `docs/`). Never
  paraphrase SRD text; keep the PDF's curly quotes and dashes.
- **Attribution:** show the SRD 5.2.1 statement verbatim (`src/lib/attribution.ts`) and
  add **no other attribution to Wizards** — no "not affiliated" line, no D&D trademarks in
  branding. "5E compatible" is allowed.
- Package manager is **pnpm**. Run `pnpm format && pnpm typecheck && pnpm lint && pnpm test`
  before calling work done; run `pnpm test:e2e` for UI changes.
- Formatting is Prettier with its **default config** (`.prettierrc.json` is `{}`); ESLint
  handles code quality only (`eslint-config-prettier` turns off style rules). Don't
  hand-format or add style rules to ESLint. Generated SRD data is in `.prettierignore`.
- **Git hooks (Husky, installed by `pnpm install` via `prepare`):** pre-commit runs
  lint-staged (`.lintstagedrc.json`: Prettier, then ESLint `--fix`, on staged files; lint errors
  block the commit), pre-push runs `pnpm test` (failures block the push). Don't bypass with
  `--no-verify`.

## Commands

| Task                                                       | Command                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| Rebuild SRD data from the PDF (also re-emits public files) | `pnpm srd:import`                                                  |
| Check data against the PDF → `scripts/srd/report.md`       | `pnpm srd:verify`                                                  |
| Debug PDF lines / blocks for a page range                  | `pnpm exec tsx scripts/srd/pdf/dump.ts 258 259` · `dump-blocks.ts` |
| Unit / e2e tests                                           | `pnpm test` · `pnpm test:e2e`                                      |
| Format / check formatting                                  | `pnpm format` · `pnpm format:check`                                |
| Lint / auto-fix                                            | `pnpm lint` · `pnpm lint:fix`                                      |

## SRD data pipeline gotchas

- Expected counts live in `scripts/srd/expected.ts` (339 spells, 330 monsters, 12 classes,
  12 subclasses, 258 magic items, 17 feats, 15 conditions). The import fails if they drift.
- **Card ids are permanent.** `scripts/srd/ids.lock.json` lists every published id. If a
  rename is unavoidable, add `old → new` to `scripts/srd/aliases.json`.
- Before changing shared parsing code (`scripts/srd/pdf/*`, `parse/common.ts`), snapshot
  all parser output, change, and diff — fixes for one chapter often shift others.
- pdf.js emits **whitespace-only items** spanning gaps between table cells; treat them as
  space hints, never as width (otherwise cells merge).
- pdf.js turns "½" into "1/2", so "1½" arrives as "11/2"; `extract.ts` fixes this at item
  and line level.
- Some headings are set in **small caps** (`gill-sc`, e.g. "Acid Splash"); smaller glyph
  runs are the lowercase letters.
- **Tables and stat blocks can sit out of reading order** in the content stream. Tables are
  re-homed by title (`relocateTables`), embedded stat blocks by "<Name> stat block"
  references (`parse/embedded.ts`), and paragraphs split by a table are rejoined in
  `buildBlocks`.
- `buildBlocks` keeps **multi-panel tables in one block** on purpose: the class and
  equipment parsers split panels themselves. Prose parsers use `proseBlocksFor`, which
  splits differing tables and reattaches continuation panels.
- Bullet text hangs ~12pt right of the bullet; any other x starts a new paragraph.
- `srd:verify` coverage misses are mostly artifacts (sentences across column/page breaks,
  stat-block fields). Investigate a chapter only if its coverage drops.
- Open datasets (Open5e, 5e-bits) are SRD **5.2**, not 5.2.1, and contain errors; they're
  cross-checks only. When they disagree with the PDF, the PDF wins.

## App gotchas

- **Never import `src/lib/srd/schema.ts` (full zod) or `src/lib/srd/server.ts` at runtime in
  client code.** Use `import type`, or zod-free `src/lib/srd/constants.ts` /
  `src/lib/model/core.ts`. Client validation uses `zod/mini` imported as
  `import * as z from "zod/mini"` (named `{ z }` import defeats tree-shaking: +65KB).
- The SRD data version is rendered into `<html data-srd-hash>` by the root layout, not baked
  into env — a running dev server picks up new data after `pnpm srd:import`.
- **React Compiler is on.** Components using TanStack Virtual need `"use no memo"` (the
  compiler memoizes the virtualizer and the list renders empty). `useVirtualizer` also
  triggers the `react-hooks/incompatible-library` warning even with the opt-out; silence it
  on that line with an `eslint-disable-next-line … --` comment saying why. Don't call `setState`
  synchronously in effects (lint error); use stores / `useSyncExternalStore`.
- On the board, don't subscribe a parent to frequently changing UI state (e.g. the
  expanded-card list): re-rendering `DndContext` re-renders every sortable card.
- Prose fields are always named `description`: markdown in `src/data/srd/`, sanitized HTML
  once rendered (`src/lib/srd/render.ts`). Detail components expect HTML.
- Tailwind can't see dynamically built class names: card-type colors come from the fixed
  map in `src/lib/srd/card-types.ts`.

## Testing gotchas

- `tests/unit/srd-snapshots.test.ts` pins the parser output for ~30 tricky entries (each
  sample says which layout it covers). After a parser change + `pnpm srd:import`, review the
  snapshot diff; if every change is intended, run `pnpm test -u`. Add a sample whenever you
  fix a parsing bug.
- CI (`.github/workflows/ci.yml`) runs typecheck, lint, unit tests, build, and e2e against
  the production build. It doesn't have the PDF, so `srd:import` / `srd:verify` run locally only.
- Playwright's `dragTo` is unreliable with dnd-kit; use `drag()` in `tests/e2e/helpers.ts`
  (real mouse moves). Drop targets must be visible — columns scroll internally.
- `playwright.config.ts` reuses a dev server on port 3000 if one is running.
- Shell is zsh: don't name a loop variable `path` (it clobbers `PATH`).

## Learnings

- Performance (production build, 2026-10-02): first-load JS ≈ 215KB gz on reference detail
  pages, ≈ 295KB on the collection page (React + Next alone ≈ 130KB). On a 500-card board
  with 50 cards expanded at 4× CPU throttle, expanding a card takes ~150ms; drag jank there
  comes from browser layout/paint of the large DOM, not JS — column virtualization is the
  next step if needed.
- Known gaps: class spell lists store names only (no School/Special columns); the Rules
  Glossary "conventions" intro isn't imported.
