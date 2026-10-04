/**
 * Classes chapter: 12 classes, each followed by its one SRD subclass.
 *
 * Layout per class: a size-18 class name, the "Core X Traits" table, then
 * size-14 sections ("Becoming a X …", "X Class Features", option lists,
 * "X Spell List", "X Subclass: Y") holding size-12 "Level N: Feature" headings.
 * The "X Features" table and sidebars sit out of reading order, often in the
 * middle of a paragraph, so they are pulled out and the paragraph is rejoined.
 */
import type { ClassEntry, SubclassEntry } from "../../../src/lib/srd/schema";
import {
  type Block,
  type HeadingBlock,
  type ParaBlock,
  parseTable,
  type Table,
  type TableBlock,
  tableToMarkdown,
} from "../pdf/blocks";
import type { Line, Span } from "../pdf/extract";
import { appendLine, endsSentence, slugify, spansText } from "../pdf/text";
import { blocksFor, blocksToMarkdown, CHAPTERS, type Ctx } from "./common";

const FEATURE = /^Level (\d+): (.+)$/;
const SUBCLASS = /^(.+?) Subclass: (.+)$/;
const SPELL_TABLE = /^(?:Cantrips \(Level 0 .+ Spells\)|Level (\d) .+ Spells)$/;
const BULLET = /^[•●▪]\s*/;

type Feature = ClassEntry["features"][number];
type FeaturesTable = ClassEntry["featuresTable"];

export function parseClasses(ctx: Ctx): {
  classes: ClassEntry[];
  subclasses: SubclassEntry[];
} {
  const blocks = normalize(blocksFor(ctx, CHAPTERS.classes), ctx);
  const classes: ClassEntry[] = [];
  const subclasses: SubclassEntry[] = [];

  for (const draft of splitAt(blocks, (h) => Math.abs(h.size - 18) < 0.5).slice(
    1,
  )) {
    const heading = draft.heading!;
    const name = heading.text;
    const slug = slugify(name);
    const id = `class:${slug}`;

    // Tables that belong to the class as a whole, wherever they sit.
    const traitsBlock = takeTable(draft.blocks, `Core ${name} Traits`);
    const featuresBlock = takeTable(draft.blocks, `${name} Features`);
    if (!traitsBlock)
      ctx.warnings.push(`Class "${name}": missing Core ${name} Traits table.`);
    if (!featuresBlock)
      ctx.warnings.push(`Class "${name}": missing ${name} Features table.`);

    const coreTraits = traitsBlock ? parseTraits(traitsBlock, ctx) : [];
    const trait = (label: string) =>
      coreTraits.find((t) => t.label === label)?.value ?? "";
    const primaryAbility = trait("Primary Ability");
    const hitDie = trait("Hit Point Die").match(/^D\d+/)?.[0] ?? "";
    if (!primaryAbility || !hitDie)
      ctx.warnings.push(`Class "${name}": missing primary ability or hit die.`);

    const description: Block[] = [];
    const sidebars: Block[] = [];
    let features: Feature[] = [];
    let spellList: ClassEntry["spellList"];
    const subclassIds: string[] = [];

    for (const section of splitAt(
      draft.blocks,
      (h) => Math.abs(h.size - 14) < 0.5,
    )) {
      const title = section.heading?.text ?? "";
      const subclass = title.match(SUBCLASS);
      if (!section.heading) {
        if (section.blocks.length)
          ctx.warnings.push(
            `Class "${name}": ${section.blocks.length} unexpected block(s) before the first section.`,
          );
        continue;
      }
      if (subclass) {
        const entry = parseSubclass(section, subclass[2], name, id, ctx);
        subclasses.push(entry);
        subclassIds.push(entry.id);
        continue;
      }
      if (/^Becoming an? /.test(title)) {
        description.push(section.heading, ...section.blocks);
        continue;
      }
      // Other sidebars are class-level asides set wherever they fit on the
      // page (e.g. mid-paragraph in Lay On Hands); keep them with the class description.
      sidebars.push(...section.blocks.filter((b) => b.kind === "sidebar"));
      const blocks = section.blocks.filter((b) => b.kind !== "sidebar");

      if (title === `${name} Class Features`) {
        const parsed = parseFeatures(blocks, `Class "${name}"`, ctx);
        description.push(section.heading, ...parsed.intro);
        features = parsed.features;
      } else if (/ Options$/.test(title)) {
        appendOptions(features, title, blocks, name, ctx);
      } else if (title === `${name} Spell List`) {
        spellList = parseSpellList(blocks, name, ctx);
      } else {
        ctx.warnings.push(`Class "${name}": unrecognized section "${title}".`);
        description.push(section.heading, ...blocks);
      }
    }

    const featuresTable = featuresBlock
      ? parseFeaturesTable(featuresBlock, name, ctx)
      : { header: [], rows: [] };
    checkFeatures(name, features, featuresTable, ctx);
    if (subclassIds.length !== 1)
      ctx.warnings.push(
        `Class "${name}": expected 1 subclass, found ${subclassIds.length}.`,
      );

    classes.push({
      id,
      type: "class",
      slug,
      name,
      subtitle: `${hitDie} Hit Die · ${primaryAbility}`,
      page: heading.page,
      primaryAbility,
      hitDie,
      coreTraits,
      description: toMarkdown([...description, ...sidebars], ctx),
      featuresTable,
      features,
      ...(spellList ? { spellList } : {}),
      subclassIds,
    });
  }

  if (classes.length !== 12)
    ctx.warnings.push(`Classes: expected 12 classes, found ${classes.length}.`);
  return { classes, subclasses };
}

function parseSubclass(
  section: Section,
  name: string,
  className: string,
  classId: string,
  ctx: Ctx,
): SubclassEntry {
  const heading = section.heading!;
  const slug = slugify(name);
  const owner = `Subclass "${name}"`;
  const sidebars = section.blocks.filter((b) => b.kind === "sidebar");
  const { intro, features } = parseFeatures(
    section.blocks.filter((b) => b.kind !== "sidebar"),
    owner,
    ctx,
  );
  if (!features.length) ctx.warnings.push(`${owner}: no features found.`);
  return {
    id: `subclass:${slug}`,
    type: "subclass",
    slug,
    name,
    subtitle: `${className} Subclass`,
    page: heading.page,
    className,
    classId,
    description: toMarkdown([...intro, ...sidebars], ctx),
    features,
  };
}

// --- Sections and features ---------------------------------------------------

interface Section {
  heading?: HeadingBlock;
  blocks: Block[];
}

/** Splits blocks at headings matching `isHeading`; blocks before the first heading form a heading-less section. */
function splitAt(
  blocks: Block[],
  isHeading: (h: HeadingBlock) => boolean,
): Section[] {
  const sections: Section[] = [{ blocks: [] }];
  for (const b of blocks) {
    if (b.kind === "heading" && isHeading(b))
      sections.push({ heading: b, blocks: [] });
    else sections[sections.length - 1].blocks.push(b);
  }
  return sections;
}

/** "Level 1: Rage" headings and the blocks under them; anything before the first is the intro. */
function parseFeatures(
  blocks: Block[],
  owner: string,
  ctx: Ctx,
): { intro: Block[]; features: Feature[] } {
  const sections = splitAt(blocks, (h) => FEATURE.test(h.text));
  const features = sections.slice(1).map((section): Feature => {
    const [, level, name] = section.heading!.text.match(FEATURE)!;
    for (const b of section.blocks) {
      if (b.kind === "heading")
        ctx.warnings.push(
          `${owner}: unexpected heading "${b.text}" inside "${section.heading!.text}".`,
        );
    }
    return {
      level: Number(level),
      name: name.trim(),
      description: toMarkdown(section.blocks, ctx),
    };
  });
  return { intro: sections[0].blocks, features };
}

/**
 * "Metamagic Options" / "Eldritch Invocation Options": the section intro and
 * one `#### Option` subsection per option, appended to the feature they serve.
 */
function appendOptions(
  features: Feature[],
  title: string,
  blocks: Block[],
  className: string,
  ctx: Ctx,
) {
  const stem = title.replace(/ Options$/, "");
  const feature = features.find(
    (f) => f.name === stem || f.name.startsWith(stem),
  );
  if (!feature) {
    ctx.warnings.push(`Class "${className}": no feature for "${title}".`);
    return;
  }
  const options = splitAt(blocks, (h) => Math.abs(h.size - 12) < 0.5);
  const parts = [feature.description, toMarkdown(options[0].blocks, ctx)];
  for (const option of options.slice(1)) {
    parts.push(
      `#### ${option.heading!.text}\n\n${toMarkdown(option.blocks, ctx)}`,
    );
  }
  feature.description = parts.filter(Boolean).join("\n\n");
}

/** Every feature heading should appear in the class table at its level, and vice versa. */
function checkFeatures(
  className: string,
  features: Feature[],
  table: FeaturesTable,
  ctx: Ctx,
) {
  const col = table.header.indexOf("Class Features");
  if (col === -1 || table.rows.length !== 20) {
    ctx.warnings.push(
      `Class "${className}": features table has ${table.rows.length} rows, header ${JSON.stringify(table.header)}.`,
    );
    return;
  }
  const listed = table.rows.flatMap((row, i) =>
    row[col]
      .split(/,\s*(?![^()]*\))/)
      .map((n) => n.replace(/\s*\(.*\)$/, "").trim())
      .filter((n) => n && n !== "—" && n !== "Subclass feature")
      .map((n) => ({ level: i + 1, name: n })),
  );
  for (const f of features) {
    if (!listed.some((l) => l.level === f.level && l.name === f.name)) {
      ctx.warnings.push(
        `Class "${className}": feature "Level ${f.level}: ${f.name}" not in the ${table.title} table.`,
      );
    }
  }
  for (const l of listed) {
    if (!features.some((f) => f.name === l.name)) {
      ctx.warnings.push(
        `Class "${className}": table lists "${l.name}" (level ${l.level}) but no such feature heading.`,
      );
    }
  }
}

// --- Block clean-up -----------------------------------------------------------

/**
 * Repairs paragraph structure around out-of-flow blocks:
 * - splits a paragraph that buildBlocks glued onto an unpunctuated hanging bullet;
 * - rejoins a paragraph that a table or sidebar interrupted mid-flow.
 */
function normalize(blocks: Block[], ctx: Ctx): Block[] {
  const out: Block[] = [];
  for (const block of blocks.flatMap((b) => splitHangingBullet(b, ctx))) {
    if (block.kind === "para") {
      let j = out.length - 1;
      while (j >= 0 && (out[j].kind === "table" || out[j].kind === "sidebar"))
        j--;
      const prev = out[j];
      if (
        j < out.length - 1 &&
        prev?.kind === "para" &&
        continues(prev, block, ctx)
      ) {
        const spans = prev.spans.map((s) => ({ ...s }));
        appendLine(spans, block.spans, ctx.dict);
        out[j] = { ...prev, spans, lines: [...prev.lines, ...block.lines] };
        continue;
      }
    }
    out.push(block);
  }
  return out;
}

/** Whether `next` (after an interrupting table/sidebar) continues paragraph `prev`. */
function continues(prev: ParaBlock, next: ParaBlock, ctx: Ctx): boolean {
  if (next.bullet || next.runIn || Math.abs(next.size - prev.size) >= 0.4)
    return false;
  const first = next.lines[0];
  const indented = first.x - columnLeft(ctx, first.page, first.x) >= 4;
  const done = endsSentence(spansText(prev.spans));
  // Bullet text continues on hanging-indented lines; a flush line is a new paragraph.
  if (prev.bullet) return indented && !done;
  return !done || !indented;
}

/** Left edge of the text column containing `x` (most common x of body lines). */
function columnLeft(ctx: Ctx, page: number, x: number): number {
  const right = x >= 300;
  const counts = new Map<number, number>();
  for (const line of ctx.pages[page - 1]) {
    if (
      line.x >= 300 !== right ||
      !line.spans.every((s) => s.font.startsWith("body"))
    )
      continue;
    const key = Math.round(line.x);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return (
    [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    (right ? 314 : 63)
  );
}

/**
 * buildBlocks can glue the paragraph after a bullet list onto the last bullet:
 * after an unpunctuated hanging bullet ("…that have the Light" / "property" +
 * "You gain the following benefits…"), or after a one-line bullet ("• Take a
 * Bonus Action to extend your Rage." + "Each time the Rage is extended…").
 * Bullet continuation lines always hang indented, so a line back at the
 * bullet's own x starts a new paragraph.
 */
function splitHangingBullet(block: Block, ctx: Ctx): Block[] {
  if (block.kind !== "para" || !block.bullet || block.lines.length < 2)
    return [block];
  const first = block.lines[0];
  const sameColumn = (l: Line) =>
    l.page === first.page && l.x >= 300 === first.x >= 300;
  const split = block.lines.findIndex(
    (l, i) => i >= 1 && sameColumn(l) && Math.abs(l.x - first.x) <= 2,
  );
  if (split === -1) return [block];
  ctx.warnings.push(
    `Split paragraph off bullet "${spansText(block.spans).slice(0, 50)}…" (p${first.page}).`,
  );
  return [
    paraFromLines(block.lines.slice(0, split), true, ctx),
    paraFromLines(block.lines.slice(split), false, ctx),
  ];
}

function paraFromLines(lines: Line[], bullet: boolean, ctx: Ctx): ParaBlock {
  const spans: Span[] = [];
  for (const [i, line] of lines.entries()) {
    const next = line.spans.map((s) => ({ ...s }));
    if (i === 0 && bullet) next[0].text = next[0].text.replace(BULLET, "");
    appendLine(
      spans,
      next.filter((s) => s.text.length),
      ctx.dict,
    );
  }
  const font = lines[0].spans[0].font;
  return {
    kind: "para",
    spans,
    size: lines[0].size,
    page: lines[0].page,
    bullet,
    runIn: font === "body-b" || font === "body-bi",
    lines,
  };
}

/** Removes and returns the table block with the given title. */
function takeTable(blocks: Block[], title: string): TableBlock | undefined {
  const index = blocks.findIndex(
    (b) => b.kind === "table" && b.title === title,
  );
  return index === -1 ? undefined : (blocks.splice(index, 1)[0] as TableBlock);
}

/** blocksToMarkdown, with tables rebuilt by `parseClassTable`. */
function toMarkdown(blocks: Block[], ctx: Ctx): string {
  const parts: string[] = [];
  let run: Block[] = [];
  const flush = () => {
    if (run.length) parts.push(blocksToMarkdown(run, ctx));
    run = [];
  };
  for (const b of blocks) {
    if (b.kind !== "table") {
      run.push(b);
      continue;
    }
    flush();
    const table = parseClassTable(b, ctx);
    if (table.groups.length)
      ctx.warnings.push(
        `Table "${b.title}": spanning header dropped in markdown.`,
      );
    parts.push(tableToMarkdown(table));
  }
  flush();
  return parts.filter(Boolean).join("\n\n");
}

// --- Tables -------------------------------------------------------------------

interface HeaderGroup {
  label: string;
  start: number;
  span: number;
}

interface ClassTable extends Table {
  groups: HeaderGroup[];
}

/**
 * Cells are often several spans (italic spell names and plain commas:
 * "Aid" ", " "Bless"), which parseTable would read as extra columns. Merges
 * touching spans into one plain cell; header (GillSans SemiBold) spans stay bold.
 */
function mergeCells(spans: Span[]): Span[] {
  const out: Span[] = [];
  for (const s of spans) {
    const prev = out[out.length - 1];
    const header = s.font === "gill-sb";
    if (prev && s.x - prev.x2 < 5 && (prev.font === "gill-sb") === header) {
      const space =
        s.x - prev.x2 > 1.5 && !/\s$/.test(prev.text) && !/^\s/.test(s.text);
      prev.text += (space ? " " : "") + s.text;
      prev.x2 = s.x2;
    } else {
      out.push({ ...s, font: header ? "gill-sb" : "gill" });
    }
  }
  return out;
}

const isHeaderLine = (line: Line) =>
  line.spans.every((s) => s.font === "gill-sb");

/**
 * Rebuilds a class table. Rows come from parseTable on merged cells; the header
 * is rebuilt here because its centered, multi-line labels ("Proficiency" over
 * "Bonus") start left of their column. A label spanning several columns
 * ("——Spell Slots per Spell Level——") becomes a header group.
 */
function parseClassTable(block: TableBlock, ctx: Ctx): ClassTable {
  const lines = block.lines.map((line) => ({
    ...line,
    spans: mergeCells(line.spans),
  }));
  const firstData = lines.findIndex((l) => !isHeaderLine(l));
  const headerLines = firstData === -1 ? lines : lines.slice(0, firstData);
  const dataLines = firstData === -1 ? [] : lines.slice(firstData);

  // Two copies of the same table side by side ("Nature's Ward"): stack them.
  const repeat = dataLines.find(
    (l) => isHeaderLine(l) && headerLines.some((h) => Math.abs(h.y - l.y) < 2),
  );
  if (repeat) {
    const splitX = repeat.x - 5;
    const left = parseClassTable(
      { ...block, lines: block.lines.filter((l) => l.x < splitX) },
      ctx,
    );
    const right = parseClassTable(
      { ...block, lines: block.lines.filter((l) => l.x >= splitX) },
      ctx,
    );
    if (left.header.join("|") === right.header.join("|"))
      return { ...left, rows: [...left.rows, ...right.rows] };
    ctx.warnings.push(
      `Table "${block.title}": side-by-side halves have different headers.`,
    );
  }

  const columns = columnStarts(dataLines);
  const parsed = parseTable({ ...block, lines }, ctx.dict, { columns });
  const colOf = (x: number) =>
    columns.reduce((best, start, i) => (x >= start - 8 ? i : best), 0);

  // Column centers from cells that stay within their column.
  const centers = columns.map((start, i) => {
    const next = columns[i + 1] ?? Infinity;
    const cs = dataLines
      .flatMap((l) => l.spans)
      .filter((s) => colOf(s.x) === i && s.x2 <= next + 2)
      .map((s) => (s.x + s.x2) / 2)
      .sort((a, b) => a - b);
    return cs.length ? cs[Math.floor(cs.length / 2)] : start;
  });

  const labels: string[][] = columns.map(() => []);
  const groups: HeaderGroup[] = [];
  const headerSpans = headerLines
    .flatMap((l) => l.spans.map((s) => ({ ...s, y: l.y })))
    .sort((a, b) => b.y - a.y || a.x - b.x);
  for (const s of headerSpans) {
    const text = s.text.trim();
    const inside = centers.flatMap((c, i) =>
      c >= s.x - 2 && c <= s.x2 + 2 ? [i] : [],
    );
    if (inside.length >= 2 && /^[—–]|[—–]$/.test(text)) {
      groups.push({
        label: text.replace(/^[—–\s]+|[—–\s]+$/g, ""),
        start: inside[0],
        span: inside.length,
      });
      continue;
    }
    const center = (s.x + s.x2) / 2;
    const col =
      inside[0] ??
      centers.reduce(
        (best, c, i) =>
          Math.abs(c - center) < Math.abs(centers[best] - center) ? i : best,
        0,
      );
    if (!columns.some((start, j) => j > col && s.x2 > start + 4)) {
      labels[col].push(text);
      continue;
    }
    // Labels of neighboring columns run together ("Warlock Level Spells"):
    // place each word by its estimated start.
    const perChar = (s.x2 - s.x) / Math.max(s.text.length, 1);
    let offset = 0;
    for (const word of s.text.split(/(\s+)/)) {
      const wx = s.x + offset * perChar;
      if (word.trim())
        labels[
          columns.reduce(
            (best, start, j) => (j > col && wx >= start - 6 ? j : best),
            col,
          )
        ].push(word);
      offset += word.length;
    }
  }
  const header = labels.map((parts) =>
    parts.join(" ").replace(/\s+/g, " ").trim(),
  );

  return {
    title: block.title,
    header,
    rows: parsed.rows.filter((r) => !r.group),
    groups,
  };
}

/** Column start positions: clusters of cell starts that recur across rows (as in parseTable). */
function columnStarts(lines: Line[]): number[] {
  const xs = lines
    .flatMap((l) => l.spans.map((s) => s.x))
    .sort((a, b) => a - b);
  const clusters: number[][] = [];
  for (const x of xs) {
    const last = clusters[clusters.length - 1];
    if (last && x - last[last.length - 1] <= 8) last.push(x);
    else clusters.push([x]);
  }
  const support = Math.min(2, new Set(lines.map((l) => Math.round(l.y))).size);
  const starts = clusters.filter((c) => c.length >= support).map((c) => c[0]);
  return starts.length ? starts : xs.slice(0, 1);
}

/** "Core Barbarian Traits": label/value rows with wrapped values. */
function parseTraits(block: TableBlock, ctx: Ctx): ClassEntry["coreTraits"] {
  const table = parseClassTable(block, ctx);
  const rows = table.header.some(Boolean)
    ? [{ cells: table.header }, ...table.rows]
    : table.rows;
  return rows.map((r) => ({
    label: r.cells[0] ?? "",
    value: r.cells.slice(1).join(" ").trim(),
  }));
}

function parseFeaturesTable(
  block: TableBlock,
  className: string,
  ctx: Ctx,
): FeaturesTable {
  const table = parseClassTable(block, ctx);
  const rows = table.rows.map((r) => r.cells);
  rows.forEach((row, i) => {
    if (row[0] !== String(i + 1))
      ctx.warnings.push(
        `Class "${className}": features table row ${i + 1} starts with "${row[0]}".`,
      );
  });
  return {
    title: table.title,
    header: table.header,
    rows,
    ...(table.groups.length ? { headerGroups: table.groups } : {}),
  };
}

/**
 * "Bard Spell List": per-level tables (Spell | School | Special) that wrap
 * into the next column or page, repeating the header. Spell names are the
 * cells under a "Spell" header label.
 */
function parseSpellList(
  blocks: Block[],
  className: string,
  ctx: Ctx,
): NonNullable<ClassEntry["spellList"]> {
  const list: NonNullable<ClassEntry["spellList"]> = [];
  for (const b of blocks) {
    if (b.kind !== "table") continue;
    const m = b.title?.match(SPELL_TABLE);
    if (!m) {
      ctx.warnings.push(
        `Class "${className}": unexpected table "${b.title}" in spell list.`,
      );
      continue;
    }
    const lines = b.lines.map((line) => ({
      ...line,
      spans: mergeCells(line.spans),
    }));
    const nameXs = lines.flatMap((l) =>
      isHeaderLine(l)
        ? l.spans.filter((s) => s.text.trim() === "Spell").map((s) => s.x)
        : [],
    );
    const spells: string[] = [];
    for (const line of lines) {
      if (isHeaderLine(line)) continue;
      for (const [i, s] of line.spans.entries()) {
        if (!nameXs.some((x) => Math.abs(s.x - x) < 6)) continue;
        const hasSchool =
          line.spans[i + 1] &&
          !nameXs.some((x) => Math.abs(line.spans[i + 1].x - x) < 6);
        if (!hasSchool)
          ctx.warnings.push(
            `Class "${className}": spell row without school: "${s.text.trim()}".`,
          );
        spells.push(s.text.trim());
      }
    }
    list.push({ level: m[1] ? Number(m[1]) : 0, spells });
  }
  return list;
}
