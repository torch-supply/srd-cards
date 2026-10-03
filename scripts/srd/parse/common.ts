import { type Block, buildBlocks, type HeadingBlock, parseTable, type Table, type TableBlock, tableToMarkdown } from "../pdf/blocks";
import type { Line } from "../pdf/extract";
import { Dictionary, spansText, spansToMarkdown } from "../pdf/text";

export interface Ctx {
  pages: Line[][];
  dict: Dictionary;
  /** Problems to surface in the verify report. */
  warnings: string[];
}

export function createCtx(pages: Line[][]): Ctx {
  return { pages, dict: new Dictionary(pages), warnings: [] };
}

/** Page ranges of the SRD 5.2.1 chapters (from the table of contents). */
export const CHAPTERS = {
  playingTheGame: [5, 18],
  characterCreation: [19, 27],
  classes: [28, 82],
  origins: [83, 86],
  feats: [87, 88],
  equipment: [89, 103],
  spellcasting: [104, 106],
  spellDescriptions: [107, 175],
  rulesGlossary: [176, 191],
  gameplayToolbox: [192, 203],
  magicItemsIntro: [204, 208],
  magicItemsAZ: [209, 253],
  monstersIntro: [254, 257],
  monstersAZ: [258, 343],
  animals: [344, 364],
} as const satisfies Record<string, readonly [number, number]>;

export function blocksFor(ctx: Ctx, [from, to]: readonly [number, number]): Block[] {
  return buildBlocks(ctx.pages, from, to, ctx.dict);
}

/** An entry being assembled: its heading plus the blocks that follow it. */
export interface Draft {
  heading: HeadingBlock;
  blocks: Block[];
}

/** Splits blocks into drafts at headings matching `isEntryHeading`. Blocks before the first are dropped. */
export function splitAtHeadings(blocks: Block[], isEntryHeading: (h: HeadingBlock) => boolean): Draft[] {
  const drafts: Draft[] = [];
  for (const b of blocks) {
    if (b.kind === "heading" && isEntryHeading(b)) drafts.push({ heading: b, blocks: [] });
    else drafts[drafts.length - 1]?.blocks.push(b);
  }
  return drafts;
}

function draftText(d: Draft) {
  return d.blocks
    .filter((b) => b.kind === "para")
    .map((b) => spansText(b.spans))
    .join(" ");
}

/**
 * Titled tables can sit out of reading order in the PDF's content stream.
 * Moves each titled table to the draft whose text refers to it ("… the X table").
 */
export function relocateTables(drafts: Draft[], ctx: Ctx) {
  const texts = drafts.map(draftText);
  for (const [i, draft] of drafts.entries()) {
    for (const block of [...draft.blocks]) {
      if (block.kind !== "table" || !block.title) continue;
      const ref = block.title.toLowerCase();
      if (texts[i].toLowerCase().includes(ref)) continue;
      const owner = texts.findIndex((t) => t.toLowerCase().includes(`${ref} table`));
      if (owner === -1 || owner === i) continue;
      draft.blocks.splice(draft.blocks.indexOf(block), 1);
      drafts[owner].blocks.push(block);
      ctx.warnings.push(`Moved table "${block.title}" from "${draft.heading.text}" to "${drafts[owner].heading.text}".`);
    }
  }
}

const isHeaderLine = (line: Line) => line.spans.length >= 2 && line.spans.every((s) => s.font === "gill-sb");

/**
 * Splits a table block where a different table starts: a new header row after
 * data rows whose text differs from the first table's header. (Repeated
 * headers on continuation panels stay; `parseTable` skips them.)
 */
export function splitTables(block: TableBlock): TableBlock[] {
  const out: TableBlock[] = [{ ...block, lines: [] }];
  let headers = new Set<string>();
  let seenData = false;
  for (const line of block.lines) {
    const current = out[out.length - 1];
    const header = isHeaderLine(line);
    const text = spansText(line.spans);
    if (header && seenData && !headers.has(text)) {
      out.push({ kind: "table", lines: [line], page: line.page });
      headers = new Set([text]);
      seenData = false;
      continue;
    }
    if (header && !seenData) headers.add(text);
    if (!line.spans.every((s) => s.font === "gill-sb")) seenData = true;
    current.lines.push(line);
  }
  return out.filter((b) => b.lines.length);
}

function headerText(block: TableBlock): string | undefined {
  const first = block.lines[0];
  return first && isHeaderLine(first) ? spansText(first.spans) : undefined;
}

/**
 * Splits blocks that hold several different tables, and reattaches an untitled
 * continuation panel to the earlier titled table with the same header (a table
 * that continues on the next page often lands inside another table's block).
 */
export function normalizeTables(blocks: Block[]): Block[] {
  const out: Block[] = [];
  const titledByHeader = new Map<string, TableBlock>();
  for (const b of blocks) {
    if (b.kind !== "table") {
      out.push(b);
      continue;
    }
    splitTables(b).forEach((panel, i) => {
      const header = headerText(panel);
      const owner = header && !panel.title && i > 0 ? titledByHeader.get(header) : undefined;
      if (owner) {
        owner.lines.push(...panel.lines);
        return;
      }
      if (panel.title && header) titledByHeader.set(header, panel);
      out.push(panel);
    });
  }
  return out;
}

/** Blocks for prose chapters, with tables normalized (see `normalizeTables`). */
export function proseBlocksFor(ctx: Ctx, range: readonly [number, number]): Block[] {
  return normalizeTables(blocksFor(ctx, range));
}

/** Parses a table for markdown output (cells keep bold/italic runs). */
export function table(block: TableBlock, ctx: Ctx): Table {
  return parseTable(block, ctx.dict, { markdown: true });
}

/** Renders blocks as markdown: paragraphs, bullet lists, tables, sidebars, sub-headings. */
export function blocksToMarkdown(blocks: Block[], ctx: Ctx, opts: { headingDepth?: number } = {}): string {
  const out: string[] = [];
  let prevBullet = false;
  for (const b of blocks) {
    let text = "";
    const bullet = b.kind === "para" && b.bullet;
    if (b.kind === "para") text = (b.bullet ? "- " : "") + spansToMarkdown(b.spans);
    else if (b.kind === "table") text = splitTables(b).map((t) => tableToMarkdown(table(t, ctx))).join("\n\n");
    else if (b.kind === "heading") text = `${"#".repeat(opts.headingDepth ?? 4)} ${b.text}`;
    else if (b.kind === "sidebar")
      text = [b.title ? `> **${titleCase(b.title)}**` : "", ...b.paras.map((p) => `> ${spansToMarkdown(p)}`)]
        .filter(Boolean)
        .join("\n>\n");
    if (!text.trim()) continue;
    out.push((out.length ? (bullet && prevBullet ? "\n" : "\n\n") : "") + text);
    prevBullet = bullet;
  }
  return out.join("").trim();
}

/** Sidebar titles are set in small caps and come out as "IMPROVISED WEAPONS"/"iMprovisEd". */
export function titleCase(text: string) {
  return text
    .toLowerCase()
    .replace(/(^|[\s(/-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(/\b(Of|The|And|Or|In|On|To|A|An|For|With)\b/g, (w, _1, offset: number) => (offset === 0 ? w : w.toLowerCase()));
}

/** Plain text of the first paragraph if it is an all-italic meta line. */
export function takeMeta(draft: Draft): string | undefined {
  const first = draft.blocks[0];
  if (first?.kind === "para" && first.spans.every((s) => s.font === "body-i" || !s.text.trim())) {
    draft.blocks.shift();
    return spansText(first.spans);
  }
  return undefined;
}

/** "1/4" → 0.25, "10" → 10 */
export function parseFraction(text: string): number {
  const m = text.trim().match(/^(\d+)\/(\d+)$/);
  return m ? Number(m[1]) / Number(m[2]) : Number(text);
}
