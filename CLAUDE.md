# CLAUDE.md

Guidance for working in this repo. `README.md` covers setup and architecture; this file
records rules, gotchas, and learnings. Add to **Learnings** when you discover something
non-obvious.

## Ground rules

- **Never `git commit` or `git push`.** The user reviews every change and commits
  themselves. Leave work uncommitted. (Remote: `origin` → github.com/torch-supply/srd-cards, branch `main`.)
- **SRD 5.2.1 is the source of truth.** All reference content comes from the official
  PDF at `docs/SRD_CC_v5.2.1.pdf` (gitignored, along with all of `docs/`). Never
  paraphrase SRD text; keep the PDF's curly quotes and dashes.
- **Attribution:** show the SRD 5.2.1 statement verbatim (`src/lib/attribution.ts`) and
  add **no other attribution to Wizards** — no "not affiliated" line, no D&D trademarks in
  branding. "5.5e compatible" is allowed (SRD 5.2.1 is the 5.5e ruleset; don't write "5E").
- Package manager is **pnpm**. Run `pnpm format && pnpm typecheck && pnpm lint && pnpm test`
  before calling work done; run `pnpm test:e2e` for UI changes.
- Formatting is Prettier with its **default config** (`.prettierrc.json` is `{}`); ESLint
  handles code quality only (`eslint-config-prettier` turns off style rules). Don't
  hand-format or add style rules to ESLint. Generated SRD data is in `.prettierignore`.
- Husky git hooks (`.husky/`, `.lintstagedrc.json`) run lint-staged on commit and
  typecheck + tests on push. Don't bypass with `--no-verify`.

## Commands

| Task                                                       | Command                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| Rebuild SRD data from the PDF (also re-emits public files) | `pnpm srd:import`                                                  |
| Check data against the PDF → `scripts/srd/report.md`       | `pnpm srd:verify`                                                  |
| Debug PDF lines / blocks for a page range                  | `pnpm exec tsx scripts/srd/pdf/dump.ts 258 259` · `dump-blocks.ts` |

## SRD data

- **Card ids are permanent.** `scripts/srd/ids.lock.json` lists every published id. If a
  rename is unavoidable, add `old → new` to `scripts/srd/aliases.json`.
- Parser gotchas live in `scripts/srd/CLAUDE.md` (loaded when working under `scripts/srd/`).

## App gotchas

- **Never import `src/lib/srd/schema.ts` (full zod) or `src/lib/srd/server.ts` at runtime in
  client code.** Use `import type`, or zod-free `src/lib/srd/constants.ts` /
  `src/lib/model/core.ts`. Client validation uses `zod/mini` imported as
  `import * as z from "zod/mini"` (named `{ z }` import defeats tree-shaking: +65KB).
- The SRD data version is rendered into `<html data-srd-hash>` by the root layout, not baked
  into env — a running dev server picks up new data after `pnpm srd:import`. The hash also
  covers `src/lib/srd/render.ts`, since `public/srd/<hash>/` holds rendered HTML that is
  cached forever; after editing the renderer, run `pnpm srd:emit` (dev/build do it too).
- **React Compiler is on.** Components using TanStack Virtual need `"use no memo"` (the
  compiler memoizes the virtualizer and the list renders empty). `useVirtualizer` also
  triggers the `react-hooks/incompatible-library` warning even with the opt-out; silence it
  on that line with an `eslint-disable-next-line … --` comment saying why. Don't call `setState`
  synchronously in effects (lint error); use stores / `useSyncExternalStore`.
- On the board, don't subscribe a parent to frequently changing UI state (e.g. the
  expanded-card list): re-rendering `DndContext` re-renders every sortable card.
- Prose fields are always named `description`: markdown in `src/data/srd/`, sanitized HTML
  once rendered (`src/lib/srd/render.ts`). Detail components expect HTML.
- Example collections (`/examples/<slug>`) are never stored: keep them out of
  `getRepository()` and `srdcards:*` localStorage keys. Their names end in "(example)"
  (a unit test checks). Custom cards that copy SRD text must set `quotes` (tested to match
  the SRD verbatim). Check each SRD claim in an example's descriptions and notes against the
  data (e.g. 5.2.1 says "Spirit Jar", not "phylactery").
- The home page's random example picks render only after the collection list loads on the
  client; keep it that way, or the random pick causes a hydration mismatch.
- The site header must fit a 360px-wide screen without horizontal scroll (an e2e test
  checks); on narrow screens the logo is icon-only and spacing is tighter.
- Tailwind can't see dynamically built class names: card-type colors come from the fixed
  map in `src/lib/srd/card-types.ts`.
- SEO: build page metadata with `pageMetadata()` (`src/lib/seo.ts`). A page's `openGraph`
  replaces the layout's (shallow merge), and it also sets the canonical URL.
- OG images are PNGs written by `pnpm og:emit` (`scripts/og.tsx`) into `public/og/<hash>/`,
  not Next `opengraph-image` routes: those bundle next/og's wasm (~1MB gzipped) into the
  server bundle. Never import `src/lib/og/card.tsx` from app code. Like `srd:emit`, it only runs when `dev` starts, so after editing an image input,
  restart dev or run `pnpm og:emit`.
- Reference list pages render every row on the server and switch to the virtualized list
  after hydration (`useHydrated`), so the HTML links to each entry. Keep it that way: the
  sitemap shouldn't be the only path crawlers have to entry pages. Example pages do the
  same: the server sends `ExampleOutline` (stacks and card links) until the board loads.
- Links between entries (`src/lib/srd/links.ts`) are added only on reference pages
  (`getRenderedEntry` passes the link index). Never put them in the board's card JSON
  (`public/srd/`): a click inside a draggable card shouldn't navigate away.

## Testing gotchas

- `tests/unit/srd-snapshots.test.ts` pins parser output; see `scripts/srd/CLAUDE.md`.
- Playwright's `dragTo` is unreliable with dnd-kit; use `drag()` in `tests/e2e/helpers.ts`
  (real mouse moves). Drop targets must be visible — columns scroll internally.
- `playwright.config.ts` reuses a dev server on port 3000 if one is running.
- `pnpm typecheck` runs `next typegen` first: `PageProps` / `LayoutProps` are global types
  Next generates into `.next/types`, so plain `tsc` fails on a fresh clone.
- A dev server on port 3000 is often the user's own: never kill it. `pnpm test:e2e` reuses
  it, and it only ran `srd:emit`/`og:emit` when it started, so ask the user to restart it if
  results look stale. Port 3000 may also be serving a different project (check with
  `lsof -iTCP:3000 -sTCP:LISTEN`); then run `E2E_PORT=3100 pnpm test:e2e` for a fresh server.
- Shell is zsh: don't name a loop variable `path` (it clobbers `PATH`).

## Learnings

- Performance (production build, 2026-10-02): first-load JS ≈ 215KB gz on reference detail
  pages, ≈ 295KB on the collection page (React + Next alone ≈ 130KB). On a 500-card board
  with 50 cards expanded at 4× CPU throttle, expanding a card takes ~150ms; drag jank there
  comes from browser layout/paint of the large DOM, not JS — column virtualization is the
  next step if needed.
- Hosting is Vercel (see README). Server code that runs at request time (only
  `/collections/[id]` today, plus the root layout it renders in) runs in a Vercel Function,
  which only has the files Next's output tracing found, so don't read project files there
  with `fs`. That's why `next.config.ts` bakes the content hashes into production builds
  (`src/lib/content-hashes.ts`). Keep new `fs` reads in build-time-only code (SSG pages with
  `dynamicParams = false`). `next start` won't catch a missing file; check a Vercel preview
  deployment. A build warning "Dynamic filesystem access causes tracing of the whole
  project" means the server function would ship all of `public/`: check
  `.next/server/app/collections/[id]/page.js.nft.json` (~160 files today).
- Known gaps: class spell lists store names only (no School/Special columns); the Rules
  Glossary "conventions" intro isn't imported.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
