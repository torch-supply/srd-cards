import type { MonsterEntry, StatBlock } from "../../../src/lib/srd/schema";
import type { Block } from "../pdf/blocks";
import type { Line, Span } from "../pdf/extract";
import { slugify, spansText, spansToMarkdown } from "../pdf/text";
import { blocksFor, CHAPTERS, type Ctx, parseFraction } from "./common";

const SIZES = "Tiny|Small|Medium|Large|Huge|Gargantuan";
const META = new RegExp(
  `^((?:${SIZES})(?:(?:, | or )(?:${SIZES}))*) (.+), ([^,]+)$`,
);
const SECTION_TITLES = new Set([
  "Traits",
  "Actions",
  "Bonus Actions",
  "Reactions",
  "Legendary Actions",
]);
const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;

/** A stat block heading (14–15pt GillSans SemiBold). */
export function isStatBlockHeading(b: Block) {
  return (
    b.kind === "heading" &&
    b.size >= 14.3 &&
    b.size <= 15 &&
    b.font === "gill-sb"
  );
}

export function parseMonsters(ctx: Ctx): MonsterEntry[] {
  const monsters: MonsterEntry[] = [];
  for (const [range, chapterGroup] of [
    [CHAPTERS.monstersAZ, undefined],
    [CHAPTERS.animals, "Animals"],
  ] as const) {
    const blocks = blocksFor(ctx, range);
    let group = chapterGroup ?? "";
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.kind === "heading" && b.size >= 17 && b.size < 20 && !chapterGroup)
        group = b.text;
      if (!isStatBlockHeading(b)) continue;
      const end = blocks.findIndex(
        (x, j) =>
          j > i &&
          (isStatBlockHeading(x) || (x.kind === "heading" && x.size >= 17)),
      );
      const body = blocks.slice(i + 1, end === -1 ? undefined : end);
      const statBlock = parseStatBlock(
        b.kind === "heading" ? b.text : "",
        body,
        ctx,
      );
      if (!statBlock) continue;
      const slug = slugify(statBlock.name);
      monsters.push({
        id: `monster:${slug}`,
        type: "monster",
        slug,
        subtitle: monsterSubtitle(statBlock),
        page: b.page,
        group,
        ...statBlock,
      });
    }
  }
  return monsters;
}

export function monsterSubtitle(s: StatBlock) {
  return `CR ${s.cr} · ${s.size} ${s.creatureType}`;
}

/**
 * Parses a stat block from the blocks following its heading.
 * Header fields (AC, HP, Speed, ability grid, Skills…CR) are read line by line;
 * sections (Traits, Actions, …) from paragraphs with bold-italic run-ins.
 */
export function parseStatBlock(
  name: string,
  blocks: Block[],
  ctx: Ctx,
): StatBlock | undefined {
  const sectionStart = blocks.findIndex(
    (b) => b.kind === "heading" && SECTION_TITLES.has(b.text),
  );
  const headerBlocks =
    sectionStart === -1 ? blocks : blocks.slice(0, sectionStart);
  const lines: Line[] = headerBlocks.flatMap((b) =>
    b.kind === "para" ? b.lines : b.kind === "table" ? b.lines : [],
  );
  if (!lines.length) {
    ctx.warnings.push(`Stat block "${name}": no header lines.`);
    return undefined;
  }

  // Meta line: "Large Aberration, Lawful Evil" (may wrap).
  let meta = "";
  let idx = 0;
  while (
    idx < lines.length &&
    lines[idx].spans.every((s) => s.font === "body-i")
  ) {
    meta = meta
      ? `${meta} ${spansText(lines[idx].spans)}`
      : spansText(lines[idx].spans);
    idx++;
  }
  const metaMatch = meta.match(META);
  if (!metaMatch)
    ctx.warnings.push(
      `Stat block "${name}": unrecognized meta line "${meta}".`,
    );

  // Labeled fields and the ability grid.
  const fields: { label: string; value: Span[] }[] = [];
  const abilityLines: Line[] = [];
  for (const line of lines.slice(idx)) {
    if (line.spans.every((s) => s.font.startsWith("gill"))) {
      abilityLines.push(line);
      continue;
    }
    for (const span of line.spans) {
      if (span.font === "body-b")
        fields.push({ label: span.text.trim(), value: [] });
      else if (fields.length) {
        const value = fields[fields.length - 1].value;
        if (value.length && line.spans[0] === span) {
          // Continuation line: join with a space (or drop a soft hyphen).
          const last = value[value.length - 1];
          if (/[\p{L}]-$/u.test(last.text) && /^\p{Ll}/u.test(span.text))
            last.text = last.text.slice(0, -1);
          else last.text += " ";
        }
        value.push({ ...span });
      }
    }
  }
  const fieldText = (label: string) => {
    const f = fields.find((x) => x.label === label);
    return f ? spansText(f.value) : undefined;
  };

  const abilities = parseAbilities(abilityLines);
  if (!abilities)
    ctx.warnings.push(`Stat block "${name}": could not parse ability scores.`);

  const crRaw = fieldText("CR") ?? "";
  const crMatch = crRaw.match(/^(\S+)\s*\((.*)\)$/);
  const cr = crMatch?.[1] ?? crRaw;
  const crValue = /^\d+(\/\d+)?$/.test(cr) ? parseFraction(cr) : null;

  const known = new Set(["AC", "Initiative", "HP", "Speed", "CR"]);
  const extraFields = fields
    .filter((f) => !known.has(f.label))
    .map((f) => ({
      label: f.label,
      value: spansToMarkdown(f.value, { plainFonts: ["body"] }),
    }));

  for (const required of ["AC", "HP", "Speed", "CR"]) {
    if (!fieldText(required))
      ctx.warnings.push(`Stat block "${name}": missing ${required}.`);
  }

  return {
    name,
    meta,
    size: metaMatch?.[1] ?? "",
    creatureType: metaMatch?.[2] ?? "",
    alignment: metaMatch?.[3] ?? "",
    ac: fieldText("AC") ?? "",
    initiative: fieldText("Initiative") ?? "",
    hp: fieldText("HP") ?? "",
    speed: fieldText("Speed") ?? "",
    abilities: abilities ?? emptyAbilities(),
    fields: extraFields,
    cr,
    crValue,
    crDetail: crMatch?.[2] ?? "",
    sections: parseSections(
      sectionStart === -1 ? [] : blocks.slice(sectionStart),
      name,
      ctx,
    ),
  };
}

function emptyAbilities(): StatBlock["abilities"] {
  const a = { score: 0, mod: "", save: "" };
  return { str: a, dex: a, con: a, int: a, wis: a, cha: a };
}

/** Ability grid rows: "Str 21 +5 +5 Dex 9 −1 +3 Con 15 +2 +6" (labels in small caps). */
function parseAbilities(lines: Line[]): StatBlock["abilities"] | undefined {
  const result: Partial<StatBlock["abilities"]> = {};
  for (const line of lines) {
    let label = "";
    let nums: string[] = [];
    const flush = () => {
      const key = label
        .toLowerCase()
        .slice(0, 3) as (typeof ABILITY_KEYS)[number];
      if (ABILITY_KEYS.includes(key) && nums.length >= 3) {
        result[key] = { score: Number(nums[0]), mod: nums[1], save: nums[2] };
      }
      label = "";
      nums = [];
    };
    for (const span of line.spans) {
      if (span.font === "gill-sc" || span.font === "gill-sb") {
        // Labels are small caps split across spans ("W" + "IS"), once set in SemiBold;
        // numbers follow in one or more spans.
        if (nums.length) flush();
        label += span.text.replace(/\s+/g, "");
      } else {
        nums.push(...span.text.trim().split(/\s+/).filter(Boolean));
      }
    }
    flush();
  }
  return ABILITY_KEYS.every((k) => result[k])
    ? (result as StatBlock["abilities"])
    : undefined;
}

function parseSections(
  blocks: Block[],
  name: string,
  ctx: Ctx,
): StatBlock["sections"] {
  const sections: StatBlock["sections"] = [];
  for (const b of blocks) {
    if (b.kind === "heading") {
      if (SECTION_TITLES.has(b.text))
        sections.push({ title: b.text, entries: [] });
      else
        ctx.warnings.push(
          `Stat block "${name}": unexpected heading "${b.text}".`,
        );
      continue;
    }
    const section = sections[sections.length - 1];
    if (!section) continue;
    if (b.kind !== "para") {
      ctx.warnings.push(
        `Stat block "${name}": unexpected ${b.kind} in ${section.title}.`,
      );
      continue;
    }
    const first = b.spans[0];
    if (b.runIn && first.font === "body-bi") {
      const entryName = first.text.trim().replace(/\.$/, "");
      section.entries.push({
        name: entryName,
        description: spansToMarkdown(b.spans.slice(1)),
      });
    } else if (section.entries.length) {
      const entry = section.entries[section.entries.length - 1];
      entry.description += `\n\n${(b.bullet ? "- " : "") + spansToMarkdown(b.spans)}`;
    } else {
      const text = spansToMarkdown(b.spans);
      section.intro = section.intro ? `${section.intro}\n\n${text}` : text;
    }
  }
  return sections;
}
