# SRD data pipeline

Gotchas for the PDF importer. Root `CLAUDE.md` has the ground rules (SRD 5.2.1 source of
truth, permanent card ids).

## Parsing gotchas

- Expected counts live in `scripts/srd/expected.ts`. The import fails if they drift.
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
- Some **lists are set in GillSans like tables**: term lists in columns ("Attack Dodge
  Influence…", read down each column) and one bulleted list (Difficult Terrain).
  `listItems` in `parse/common.ts` turns them into markdown lists; `render.ts` gives
  short-term lists the `srd-terms` class (CSS columns).
- A paragraph ending in a colon introduces the table after it, so `buildBlocks` never
  rejoins text after that table to it (the text after a list is often flush, not indented).
- `srd:verify` coverage misses are mostly artifacts (sentences across column/page breaks,
  stat-block fields). Investigate a chapter only if its coverage drops.
- Open datasets (Open5e, 5e-bits) are SRD **5.2**, not 5.2.1, and contain errors; they're
  cross-checks only. When they disagree with the PDF, the PDF wins.

## Snapshot tests

- `tests/unit/srd-snapshots.test.ts` pins the parser output for ~30 tricky entries (each
  sample says which layout it covers). After a parser change + `pnpm srd:import`, review the
  snapshot diff; if every change is intended, run `pnpm test -u`. Add a sample whenever you
  fix a parsing bug.
