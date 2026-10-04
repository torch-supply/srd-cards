# srd.cards

Browse the **System Reference Document 5.2.1** and organize its content as cards.
**Collections** (a campaign, an encounter) hold ordered **stacks** (a character, an
encounter setup), which hold **cards**: classes, subclasses, spells, monsters,
equipment, magic items, feats, conditions, rules, and custom homebrew cards.
Everything is saved in the browser (localStorage) behind a storage interface that a
backend can replace later.

## Getting started

```bash
pnpm install
pnpm dev          # http://localhost:3000 (runs `srd:emit` first)
```

Requires Node 20.9+ (developed on Node 24) and pnpm 11.

| Script                                   | What it does                                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js. `dev` and `build` run `srd:emit` first.                                               |
| `pnpm srd:import`                        | Rebuilds `src/data/srd/*.json` from the SRD 5.2.1 PDF, then runs `srd:emit`.                   |
| `pnpm srd:verify`                        | Checks the data against the PDF and writes `scripts/srd/report.md`.                            |
| `pnpm srd:emit`                          | Writes browser data to `public/srd/<hash>/` (generated, gitignored).                           |
| `pnpm typecheck` / `pnpm lint`           | TypeScript and ESLint (`pnpm lint:fix` applies auto-fixes).                                    |
| `pnpm format` / `pnpm format:check`      | Prettier (default config): write or check formatting.                                          |
| `pnpm test`                              | Vitest unit tests (`tests/unit`).                                                              |
| `pnpm test:e2e`                          | Playwright end-to-end tests (`tests/e2e`). Reuses a dev server on port 3000 if one is running. |

## SRD data pipeline

The SRD 5.2.1 PDF is the source of truth. `pnpm srd:import` parses it directly:

1. **Extract** (`scripts/srd/pdf/extract.ts`): pdf.js turns each page into styled lines
   (font, size, position). The PDF is read from `docs/SRD_CC_v5.2.1.pdf` (gitignored),
   `SRD_PDF_PATH`, or downloaded from the official URL; its SHA-256 is checked.
2. **Blocks** (`scripts/srd/pdf/blocks.ts`): headings, paragraphs (with bold/italic run-ins
   and de-hyphenation), bullets, sidebars, and tables rebuilt from cell positions.
3. **Parsers** (`scripts/srd/parse/*.ts`): one per chapter (spells, monsters, classes,
   equipment, magic items, feats, rules glossary + conditions, rules chapters). Embedded stat
   blocks (Find Steed, Figurine of Wondrous Power, …) are attached to their spell or item.
4. **Validate and write**: every entry is validated with zod (`src/lib/srd/schema.ts`);
   counts must match the PDF (`scripts/srd/expected.ts`); ids are locked.

Output: `src/data/srd/<type>.json` (prose as markdown), `index.json` (lightweight search
index), `meta.json`. These files are committed, so builds never need the PDF.

**Stable ids.** Entry ids are `type:slug` (e.g. `spell:fireball`) and are referenced by saved
cards. `scripts/srd/ids.lock.json` records every published id; the import fails if one
disappears unless `scripts/srd/aliases.json` maps it to its new id.

**Verification.** `pnpm srd:verify` reports counts, prose coverage per chapter (sentences
found verbatim in the output), and cross-checks monster and spell values against two open
datasets (Open5e, 5e-bits) downloaded at pinned commits into `.cache/`. Where they disagree,
the PDF wins; the report lists the differences.

## Architecture

```
src/app/                      routes: / (collections), /collections/[id] (board),
                              /[type] and /[type]/[slug] (static reference pages), /about
src/components/cards/         card header, type icons, detail views (spell, stat block, class…)
src/components/collection/    board, columns, cards, browser panel, drag and drop
src/components/collections/   home page (collections grid, dialogs)
src/components/reference/     reference list, filters, "Add to collection"
src/lib/srd/                  schema, card types/colors, server loader, client loader, search
src/lib/model/                collection model (zod/mini), commands (pure reducer)
src/lib/storage/              CollectionRepository interface + localStorage implementation
src/lib/export/               JSON export/import
src/stores/                   zustand stores (open collection with autosave/undo; home list)
```

- **Reference pages** are statically generated (~1,500 pages). Prose is rendered from
  markdown to sanitized HTML on the server, so no markdown parser ships for SRD content.
- **The board** loads nothing from the SRD until needed: collapsed cards render from a
  snapshot stored on the card; the search index (~34KB gzipped) loads when idle or when the
  browser panel opens; an expanded card fetches one small JSON file. SRD files live under a
  content hash (`public/srd/<hash>/`) and are served with immutable caching. The current hash
  is rendered into `<html data-srd-hash>` by the root layout.
- **Changes** are serializable commands (`src/lib/model/commands.ts`) applied by a pure
  reducer: that gives undo/redo now and a path to syncing operations with a backend later.
  Autosave is debounced and flushed on navigation, tab hide, and page hide.
- **Storage** is behind `CollectionRepository` (`src/lib/storage/repository.ts`); swap the
  implementation in `src/lib/storage/index.ts` to add a backend. Corrupt data is never
  overwritten, collections saved by a newer schema open read-only, and quota errors show a
  banner suggesting an export.

## Licensing

This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

The attribution appears in the site footer, on `/about`, and in exported JSON. See
`src/data/srd/LICENSES.md` for data credits.
