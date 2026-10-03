/**
 * Turns styled lines into blocks: headings, paragraphs, sidebars and tables.
 *
 * Typesetting conventions in the SRD 5.2.1 PDF:
 * - GillSans SemiBold ≥ 11.5pt: headings (26 chapter, 18 section, 14 subsection, 12 entry).
 * - GillSans SemiBold ~10.5pt: table titles; GillSans ~9.3–10pt: table cells.
 * - GillSans small caps ≥ 10pt: sidebar titles; GillSans ~9pt: sidebar prose.
 * - Cambria / Optima: body text. Paragraphs start with a first-line indent,
 *   a bold(-italic) run-in heading, or a bullet.
 */
import type { FontKey, Line, Span } from "./extract";
import { appendLine, Dictionary, endsSentence, spansText, spansToMarkdown } from "./text";

export interface HeadingBlock {
  kind: "heading";
  text: string;
  size: number;
  font: FontKey;
  page: number;
  x: number;
  y: number;
}

export interface ParaBlock {
  kind: "para";
  spans: Span[];
  size: number;
  page: number;
  bullet: boolean;
  /** Paragraph began with a bold or bold-italic run-in ("Amphibious."). */
  runIn: boolean;
  /** Source lines, for parsers that need line structure (stat block headers). */
  lines: Line[];
}

export interface SidebarBlock {
  kind: "sidebar";
  title?: string;
  paras: Span[][];
  page: number;
}

export interface TableBlock {
  kind: "table";
  title?: string;
  lines: Line[];
  page: number;
}

export type Block = HeadingBlock | ParaBlock | SidebarBlock | TableBlock;

type LineKind = "heading" | "tableTitle" | "table" | "sidebarTitle" | "sidebar" | "body";

const GILL = new Set<FontKey>(["gill", "gill-sb", "gill-i", "gill-sc"]);

function classify(line: Line): LineKind {
  const fonts = new Set(line.spans.map((s) => s.font));
  const allGill = [...fonts].every((f) => GILL.has(f));
  if (!allGill) return "body";
  const size = Math.max(...line.spans.map((s) => s.size));
  if (fonts.has("gill-sc")) return size >= 11.5 ? "heading" : size >= 10.5 ? "sidebarTitle" : "table";
  if (size >= 11.5 && !fonts.has("gill-i")) return "heading";
  if (size >= 10.2 && fonts.size === 1 && fonts.has("gill-sb") && line.spans.length === 1) return "tableTitle";
  if (size >= 8.5 && size <= 9.2) return "sidebar";
  return "table";
}

const BULLET = /^[•●▪]\s*/;

/**
 * Small caps come out as full-size capitals plus reduced-size glyphs for the
 * lowercase letters ("Acid Spl" + "ASh"). Lowercases the reduced-size runs.
 */
function smallCapsText(spans: Span[]): string {
  const max = Math.max(...spans.map((s) => s.size));
  if (!spans.some((s) => s.font === "gill-sc")) return spansText(spans);
  return spansText(spans.map((s) => (s.size < max - 1 ? { ...s, text: s.text.toLowerCase() } : s)));
}

/** Left edges of the two text columns on a page (most common x of body lines). */
function columnEdges(lines: Line[]): [number, number] {
  const counts = [new Map<number, number>(), new Map<number, number>()];
  for (const line of lines) {
    if (classify(line) !== "body") continue;
    const col = line.x < 300 ? 0 : 1;
    const x = Math.round(line.x);
    counts[col].set(x, (counts[col].get(x) ?? 0) + 1);
  }
  const mode = (m: Map<number, number>, fallback: number) =>
    [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
  return [mode(counts[0], 63), mode(counts[1], 314)];
}

interface ParaState {
  block: ParaBlock;
  firstLine: Line;
  last: Line;
  hanging: boolean;
  /** x of hanging continuation lines (set on the second line of a hanging paragraph). */
  hangX?: number;
  /** Already in the block list (reopened after an out-of-order table or sidebar). */
  pushed?: boolean;
  /** An all-italic line right after a heading ("Wondrous Item, Rare"): kept as its own paragraph. */
  meta: boolean;
}

interface SidebarState {
  block: SidebarBlock;
  /** Left edge of sidebar prose; a line further right starts a new paragraph. */
  left: number;
  last: Line;
}

export function buildBlocks(pages: Line[][], fromPage: number, toPage: number, dict: Dictionary): Block[] {
  const blocks: Block[] = [];
  let para: ParaState | null = null;
  let sidebar: SidebarState | null = null;
  /** The paragraph a table or sidebar interrupted; text after it may continue that paragraph. */
  let interrupted: ParaState | null = null;

  const closePara = () => {
    if (para && !para.pushed) blocks.push(para.block);
    para = null;
  };


  for (let p = fromPage; p <= toPage; p++) {
    const lines = pages[p - 1];
    const edges = columnEdges(lines);
    for (const line of lines) {
      const kind = classify(line);
      if (kind !== "sidebar") sidebar = null;
      // Non-body lines end the open paragraph before we look at the previous block.
      if (kind !== "body") {
        if (para && kind !== "heading") interrupted = para;
        if (kind === "heading") interrupted = null;
        closePara();
      }
      const prev = blocks[blocks.length - 1];

      if (kind === "heading") {
        closePara();
        const text = smallCapsText(line.spans);
        const size = line.size;
        if (
          prev?.kind === "heading" &&
          prev.page === p &&
          Math.abs(prev.size - size) < 0.3 &&
          Math.abs(prev.x - line.x) < 3 &&
          prev.y - line.y > 0 &&
          prev.y - line.y <= size * 1.35
        ) {
          prev.text = `${prev.text} ${text}`.replace(/\s+/g, " ");
          prev.y = line.y;
        } else {
          blocks.push({ kind: "heading", text, size, font: line.spans[0].font, page: p, x: line.x, y: line.y });
        }
        continue;
      }

      if (kind === "tableTitle" || kind === "table") {
        closePara();
        // Multi-panel tables (side-by-side halves, continued headers) stay in one
        // block; parsers that need panels split them (see parse/classes.ts, parse/equipment.ts).
        if (kind === "tableTitle" && prev?.kind === "table" && prev.title && !prev.lines.length) {
          // Two-line table title ("Multiclass Spellcaster:" / "Spell Slots per Spell Level").
          prev.title = `${prev.title} ${spansText(line.spans)}`;
        } else if (kind === "table" && prev?.kind === "table") {
          prev.lines.push(line);
        } else {
          blocks.push({
            kind: "table",
            title: kind === "tableTitle" ? spansText(line.spans) : undefined,
            lines: kind === "tableTitle" ? [] : [line],
            page: p,
          });
        }
        continue;
      }

      if (kind === "sidebarTitle") {
        closePara();
        blocks.push({ kind: "sidebar", title: spansText(line.spans), paras: [], page: p });
        continue;
      }

      if (kind === "sidebar") {
        closePara();
        if (!sidebar) {
          const block: SidebarBlock =
            prev?.kind === "sidebar" && !prev.paras.length ? prev : { kind: "sidebar", paras: [], page: p };
          if (block !== prev) blocks.push(block);
          sidebar = { block, left: line.x, last: line };
          block.paras.push(line.spans.map((s) => ({ ...s })));
          continue;
        }
        const current = sidebar.block.paras[sidebar.block.paras.length - 1];
        const indented = line.x > sidebar.left + 4;
        if (indented && endsSentence(spansText(current))) {
          sidebar.block.paras.push(line.spans.map((s) => ({ ...s })));
        } else {
          appendLine(current, line.spans, dict);
        }
        sidebar.left = Math.min(sidebar.left, line.x);
        sidebar.last = line;
        continue;
      }

      // Body text.
      const colLeft = edges[line.x < 300 ? 0 : 1];
      const firstSpan = line.spans[0];
      const bullet = BULLET.test(firstSpan.text);
      const runIn = firstSpan.font === "body-bi" || firstSpan.font === "body-b";
      const indented = line.x - colLeft >= 4;
      const size = line.size;

      // Continue a paragraph that an out-of-order table or sidebar split: new
      // paragraphs start indented (or with a run-in/bullet); a flush line, or text
      // after an unfinished sentence, belongs to the interrupted paragraph.
      if (!para && interrupted && !interrupted.meta && (prev?.kind === "table" || prev?.kind === "sidebar") && !bullet && !runIn) {
        const last = interrupted.last.spans[interrupted.last.spans.length - 1].text;
        if (Math.abs(size - interrupted.block.size) < 0.4 && (!indented || !endsSentence(last))) {
          para = interrupted;
          para.pushed = true;
          appendLine(para.block.spans, line.spans, dict);
          para.block.lines.push(line);
          para.last = line;
          interrupted = null;
          continue;
        }
      }
      interrupted = null;

      let startNew = true;
      if (para) {
        const state: ParaState = para;
        const lastSpans = state.last.spans;
        const sentenceDone = endsSentence(lastSpans[lastSpans.length - 1].text);
        const sameColumn = state.last.page === p && state.last.x < 300 === line.x < 300;
        const gap = sameColumn ? state.last.y - line.y : 0;
        const secondLine = state.last === state.firstLine;
        const hangingStart =
          secondLine &&
          sameColumn &&
          indented &&
          state.firstLine.x <= colLeft + 2 &&
          (state.block.runIn || state.block.bullet);

        const allItalic = line.spans.every((s) => s.font === "body-i");
        if (state.meta) startNew = !allItalic;
        else if (bullet) startNew = true;
        else if (Math.abs(size - state.block.size) >= 0.4) startNew = true;
        else if (runIn && (sentenceDone || state.block.bullet)) startNew = true;
        else if (sameColumn && gap > size * 1.75) startNew = true;
        // Bullet text hangs right of the bullet; a line back at the bullet's edge is a new paragraph.
        else if (state.block.bullet && sameColumn) {
          // Bullet text hangs about 12pt right of the bullet; any other x is a new paragraph.
          const hang = state.hangX ?? state.firstLine.x + 12;
          startNew = Math.abs(line.x - hang) > 3;
          if (!startNew) {
            state.hanging = true;
            state.hangX = line.x;
          }
        } else if (hangingStart) {
          state.hanging = true;
          state.hangX = line.x;
          startNew = false;
        } else if (state.hanging) startNew = !indented && sentenceDone;
        else startNew = indented && sentenceDone;
      }

      if (startNew) {
        closePara();
        const spans = line.spans.map((s) => ({ ...s }));
        if (bullet) spans[0].text = spans[0].text.replace(BULLET, "");
        para = {
          block: { kind: "para", spans: spans.filter((s) => s.text.length), size, page: p, bullet, runIn, lines: [line] },
          firstLine: line,
          last: line,
          hanging: false,
          meta: prev?.kind === "heading" && line.spans.every((s) => s.font === "body-i"),
        };
      } else {
        appendLine(para!.block.spans, line.spans, dict);
        para!.block.lines.push(line);
        para!.last = line;
      }
    }
  }
  closePara();
  return blocks;
}

// --- Tables ---------------------------------------------------------------

export interface TableRow {
  cells: string[];
  /** A full-width group label row ("Simple Melee Weapons"). */
  group?: boolean;
  y: number;
  page: number;
}

export interface Table {
  title?: string;
  header: string[];
  rows: TableRow[];
}

interface Cell {
  text: string;
  /** Styled runs making up the cell (for markdown rendering). */
  spans: Span[];
  x: number;
  x2: number;
  y: number;
  page: number;
  /** Reading position that increases down the page and across pages. */
  pos: number;
  font: FontKey;
}

/** Reading position: down a column, then the next column, then the next page. */
const position = (page: number, half: number, y: number) => page * 2000 + half * 1000 + (1000 - y);

/**
 * Joins runs separated by no more than a word space (bold "Red." followed by
 * italic "Failed Save:") into one cell; wider gaps separate cells.
 */
function lineCells(line: Line, shift = 0, half = 0): Cell[] {
  const cells: Cell[] = [];
  for (const raw of line.spans) {
    const s = { ...raw, x: raw.x - shift, x2: raw.x2 - shift };
    const prev = cells[cells.length - 1];
    if (prev && s.x - prev.x2 < 6) {
      const last = prev.spans[prev.spans.length - 1];
      if (!/\s$/.test(last.text) && s.x - prev.x2 > 1) last.text += " ";
      prev.spans.push({ ...s });
      prev.text += (/\s$/.test(prev.text) || s.x - prev.x2 <= 1 ? "" : " ") + s.text;
      prev.x2 = s.x2;
      continue;
    }
    cells.push({
      text: s.text,
      spans: [{ ...s }],
      x: s.x,
      x2: s.x2,
      y: line.y,
      page: line.page,
      pos: position(line.page, half, line.y),
      font: s.font,
    });
  }
  return cells.map((c) => ({ ...c, text: c.text.trim() })).filter((c) => c.text);
}

/**
 * Rebuilds a table from positioned spans. Columns are found from recurring cell
 * start positions; rows are anchored on first-column cells, and wrapped
 * continuation lines are attached to the row above them. Header fragments go to
 * the nearest column (headers are often centered over their data).
 */
export function parseTable(
  block: TableBlock,
  dict: Dictionary,
  opts: { minRowGap?: number; columns?: number[]; markdown?: boolean } = {},
): Table {
  if (!block.lines.length) return { title: block.title, header: [], rows: [] };
  const minRowGap = opts.minRowGap ?? 13.6;
  const header: Cell[] = [];
  let groups: Cell[] = [];
  const data: Cell[] = [];
  let seenData = false;

  // A table continued on another page or column ("panel") is shifted to line
  // up with the first panel. Narrow tables are grouped by column half.
  const narrow = block.lines.every((l) => (l.x < 300 ? l.x2 < 310 : true));
  const panelKey = (l: Line) => `${l.page}:${narrow && l.x >= 300 ? 1 : 0}`;
  const panelLeft = new Map<string, number>();
  for (const l of block.lines) panelLeft.set(panelKey(l), Math.min(panelLeft.get(panelKey(l)) ?? Infinity, l.x));
  const baseLeft = block.lines.length ? (panelLeft.get(panelKey(block.lines[0])) ?? 0) : 0;
  const headerTexts = new Set<string>();

  for (const line of block.lines) {
    const half = narrow && line.x >= 300 ? 1 : 0;
    const cells = lineCells(line, (panelLeft.get(panelKey(line)) ?? baseLeft) - baseLeft, half);
    if (!cells.length) continue;
    const allHeader = line.spans.every((s) => s.font === "gill-sb");
    const text = spansText(line.spans);
    if (seenData && allHeader && headerTexts.has(text)) continue; // header repeated on a continuation panel
    if (!seenData && allHeader) {
      header.push(...cells);
      headerTexts.add(text);
      continue;
    }
    if (cells.length === 1 && line.spans.every((s) => s.font === "gill-i")) {
      groups.push(cells[0]);
      continue;
    }
    seenData = true;
    data.push(...cells);
  }

  // A header with no data rows (a lone label/value block set in SemiBold) is data.
  if (!data.length) data.push(...header.splice(0));

  // Column starts: from options, or from clusters of cell start positions that
  // recur across rows. Centered cells (numbers) vary by a few points.
  let starts = opts.columns?.length ? opts.columns : undefined;
  if (!starts) {
    const xs = data.map((c) => c.x).sort((a, b) => a - b);
    const clusters: number[][] = [];
    for (const x of xs) {
      const last = clusters[clusters.length - 1];
      if (last && x - last[last.length - 1] <= 8) last.push(x);
      else clusters.push([x]);
    }
    const rowCount = new Set(data.map((c) => Math.round(c.pos))).size;
    const support = Math.min(2, rowCount);
    starts = clusters.filter((c) => c.length >= support).map((c) => c[0]);
    if (!starts.length && xs.length) starts = [xs[0]];
  }
  const cols = starts;
  const colOf = (c: { x: number }) => {
    let best = 0;
    for (let i = 0; i < cols.length; i++) if (c.x >= cols[i] - 8) best = i;
    return best;
  };

  // A lone italic line that doesn't start at the left edge is a wrapped cell, not a group label.
  groups = groups.filter((g) => {
    if (g.x <= cols[0] + 10) return true;
    data.push(g);
    return false;
  });

  // A run that crosses into the next column ("9–10 The target chooses…") is
  // split by estimating each word's position from its character offset.
  const splitWords = (c: Cell, assign: (wx: number, first: number) => number): Cell[] => {
    const first = colOf(c);
    if (first + 1 >= cols.length || c.x2 <= cols[first + 1] + 2) return [c];
    const perChar = (c.x2 - c.x) / Math.max(c.text.length, 1);
    const pieces = new Map<number, string[]>();
    let offset = 0;
    for (const word of c.text.split(/(\s+)/)) {
      if (word.trim()) {
        const col = assign(c.x + offset * perChar, first);
        pieces.set(col, [...(pieces.get(col) ?? []), word]);
      }
      offset += word.length;
    }
    return [...pieces.entries()].map(([col, words]) => {
      const text = words.join(" ");
      return { ...c, text, spans: [{ ...c.spans[0], text }], x: cols[col], x2: cols[col] + 1 };
    });
  };
  const byStart = (wx: number, first: number) => {
    let col = first;
    for (let i = first; i < cols.length; i++) if (wx >= cols[i] - 8) col = i;
    return col;
  };
  const splitData = data.flatMap((c) => splitWords(c, byStart));
  data.length = 0;
  data.push(...splitData);

  // Row anchors: first-column cells far enough below the previous anchor.
  const ordered = [...data].sort((a, b) => a.pos - b.pos || a.x - b.x);
  const anchors: number[] = [];
  for (const c of ordered) {
    if (colOf(c) !== 0) continue;
    const last = anchors[anchors.length - 1];
    if (last === undefined || c.pos - last >= minRowGap || Math.floor(c.pos / 1000) !== Math.floor(last / 1000)) {
      anchors.push(c.pos);
    }
  }
  for (const g of groups) anchors.push(g.pos);
  anchors.sort((a, b) => a - b);
  if (!anchors.length && ordered.length) anchors.push(ordered[0].pos);

  const rowIndex = (pos: number) => {
    let idx = 0;
    for (let i = 0; i < anchors.length; i++) if (anchors[i] <= pos + 2.5) idx = i;
    return idx;
  };

  const groupAt = new Map(groups.map((g) => [g.pos, g]));
  const rows: TableRow[] = anchors.map((pos) => {
    const g = groupAt.get(pos);
    return {
      cells: g ? [g.text] : cols.map(() => ""),
      group: g ? true : undefined,
      y: 1000 - (pos % 1000),
      page: Math.floor(pos / 2000) || block.page,
    };
  });
  const parts: Span[][][] = rows.map((r) => r.cells.map(() => []));
  for (const c of ordered) {
    const r = rowIndex(c.pos);
    if (rows[r].group) continue;
    appendLine(parts[r][colOf(c)], c.spans, dict);
  }
  rows.forEach((row, r) => {
    if (!row.group) row.cells = parts[r].map((spans) => (opts.markdown ? spansToMarkdown(spans) : spansText(spans)));
  });

  // Header: nearest data column by horizontal extent; multi-line fragments join top to bottom.
  const extents = cols.map((start, i) => {
    const inCol = data.filter((c) => colOf(c) === i);
    return inCol.length
      ? [Math.min(...inCol.map((c) => c.x)), Math.max(...inCol.map((c) => c.x2))]
      : [start, start + 10];
  });
  const nearest = (cx: number) => {
    let best = 0;
    let bestDist = Infinity;
    extents.forEach(([a, b], i) => {
      const d = cx < a ? a - cx : cx > b ? cx - b : 0;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  };
  const headerCols: Cell[][] = cols.map(() => []);
  for (const h of [...header].sort((a, b) => a.pos - b.pos || a.x - b.x)) {
    const spansMany = extents.filter(([a, b]) => h.x < b && h.x2 > a).length > 1;
    if (!spansMany) {
      headerCols[nearest((h.x + h.x2) / 2)].push(h);
      continue;
    }
    const perChar = (h.x2 - h.x) / Math.max(h.text.length, 1);
    let offset = 0;
    for (const word of h.text.split(/(\s+)/)) {
      if (word.trim()) {
        const wx = h.x + (offset + word.length / 2) * perChar;
        headerCols[nearest(wx)].push({ ...h, text: word });
      }
      offset += word.length;
    }
  }
  const headerText = headerCols.map((cells) => cells.map((c) => c.text).join(" ").replace(/\s+/g, " ").trim());

  return { title: block.title, header: headerText, rows };
}

/** Renders a parsed table as a GitHub-flavored markdown table. */
export function tableToMarkdown(table: Table): string {
  const header = table.header.some(Boolean) ? table.header : table.rows[0]?.cells ?? [];
  const body = table.header.some(Boolean) ? table.rows : table.rows.slice(1);
  const esc = (s: string) => s.replace(/\|/g, "\\|");
  const lines = [
    `| ${header.map(esc).join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...body.map((r) =>
      r.group
        ? `| *${esc(r.cells[0])}* |${" |".repeat(Math.max(header.length - 1, 0))}`
        : `| ${r.cells.map(esc).join(" | ")} |`,
    ),
  ];
  return (table.title ? `**${table.title}**\n\n` : "") + lines.join("\n");
}
