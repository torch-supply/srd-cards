import type { ConditionEntry, RuleEntry } from "../../../src/lib/srd/schema";
import type { Block, HeadingBlock } from "../pdf/blocks";
import { slugify, spansText } from "../pdf/text";
import {
  proseBlocksFor,
  blocksToMarkdown,
  CHAPTERS,
  type Ctx,
  relocateTables,
  splitAtHeadings,
} from "./common";

/** Rules Glossary entries: "Attack [Action]", "Blinded [Condition]", "Bloodied". */
export function parseGlossary(ctx: Ctx): {
  rules: RuleEntry[];
  conditions: ConditionEntry[];
} {
  const blocks = proseBlocksFor(ctx, CHAPTERS.rulesGlossary);
  // Skip "Glossary Conventions" (the 18pt section before the entries).
  let inEntries = false;
  const drafts = splitAtHeadings(blocks, (h) => {
    if (h.size >= 17 && h.size < 25) inEntries = h.text === "Rules Definitions";
    return inEntries && Math.abs(h.size - 12) < 0.3;
  });
  if (!drafts.length)
    ctx.warnings.push(
      `Rules Glossary: no entries found (expected a "Rules Definitions" section).`,
    );
  relocateTables(drafts, ctx);

  const rules: RuleEntry[] = [];
  const conditions: ConditionEntry[] = [];
  for (const draft of drafts) {
    const m = draft.heading.text.match(/^(.+?)\s*\[(.+)\]$/);
    const name = m?.[1] ?? draft.heading.text;
    const tag = m?.[2];
    const slug = slugify(name);
    const description = blocksToMarkdown(draft.blocks, ctx);
    if (tag === "Condition") {
      conditions.push({
        id: `condition:${slug}`,
        type: "condition",
        slug,
        name,
        subtitle: "Condition",
        page: draft.heading.page,
        description,
      });
    } else {
      rules.push({
        id: `rule:${slug}`,
        type: "rule",
        slug,
        name,
        subtitle: tag ? `Rules Glossary · ${tag}` : "Rules Glossary",
        page: draft.heading.page,
        section: "Rules Glossary",
        ...(tag ? { tag } : {}),
        description,
      });
    }
  }
  return { rules, conditions };
}

/** Sections longer than this (in words) are split into one rule per subsection. */
const SPLIT_WORDS = 1200;

/**
 * Rules chapters (Playing the Game, Character Creation, Gameplay Toolbox):
 * one rule per 18pt section, or per 14pt subsection when the section is long.
 */
export function parseRuleChapters(ctx: Ctx, taken: Set<string>): RuleEntry[] {
  const rules: RuleEntry[] = [];
  const chapters: {
    chapter: string;
    range: readonly [number, number];
    until?: string;
  }[] = [
    { chapter: "Playing the Game", range: CHAPTERS.playingTheGame },
    { chapter: "Character Creation", range: CHAPTERS.characterCreation },
    // Chapter introductions before the A–Z entries.
    { chapter: "Feats", range: CHAPTERS.feats, until: "Origin Feats" },
    { chapter: "Spells", range: CHAPTERS.spellcasting },
    { chapter: "Gameplay Toolbox", range: CHAPTERS.gameplayToolbox },
    { chapter: "Magic Items", range: CHAPTERS.magicItemsIntro },
    { chapter: "Monsters", range: CHAPTERS.monstersIntro },
  ];
  for (const { chapter, range, until } of chapters) {
    let blocks = proseBlocksFor(ctx, range);
    if (until) {
      const stop = blocks.findIndex(
        (b) => b.kind === "heading" && b.text === until,
      );
      if (stop !== -1) blocks = blocks.slice(0, stop);
    }
    const sections = splitAtHeadings(
      blocks,
      (h) => h.size >= 17 && h.size < 25,
    );
    relocateTables(sections, ctx);
    for (const section of sections) {
      const words = section.blocks.reduce(
        (n, b) =>
          n + (b.kind === "para" ? spansText(b.spans).split(/\s+/).length : 0),
        0,
      );
      const hasSubsections = section.blocks.some(
        (b) => b.kind === "heading" && b.size >= 13.5,
      );
      if (words <= SPLIT_WORDS || !hasSubsections) {
        rules.push(
          makeRule(
            ctx,
            taken,
            chapter,
            section.heading,
            section.heading.text,
            section.blocks,
            `${chapter}`,
          ),
        );
        continue;
      }
      const intro: Block[] = [];
      const subs: { heading: HeadingBlock; blocks: Block[] }[] = [];
      for (const b of section.blocks) {
        if (b.kind === "heading" && b.size >= 13.5)
          subs.push({ heading: b, blocks: [] });
        else if (subs.length) subs[subs.length - 1].blocks.push(b);
        else intro.push(b);
      }
      const where = `${chapter} › ${section.heading.text}`;
      if (intro.length)
        rules.push(
          makeRule(
            ctx,
            taken,
            chapter,
            section.heading,
            section.heading.text,
            intro,
            chapter,
          ),
        );
      for (const sub of subs)
        rules.push(
          makeRule(
            ctx,
            taken,
            chapter,
            sub.heading,
            sub.heading.text,
            sub.blocks,
            where,
            section.heading.text,
          ),
        );
    }
  }
  return rules;
}

function makeRule(
  ctx: Ctx,
  taken: Set<string>,
  chapter: string,
  heading: HeadingBlock,
  name: string,
  blocks: Block[],
  section: string,
  parent?: string,
): RuleEntry {
  // Prefer the plain name; fall back to parent/chapter prefixes on collision.
  const candidates = [
    slugify(name),
    parent && slugify(`${parent} ${name}`),
    slugify(`${chapter} ${parent ?? ""} ${name}`),
  ];
  const slug =
    candidates.find((c) => c && !taken.has(`rule:${c}`)) ??
    `${slugify(`${chapter} ${name}`)}-${heading.page}`;
  taken.add(`rule:${slug}`);
  // Sub-headings: 14pt → ###, 12pt → ####.
  const md = blocksToMarkdown(
    blocks.map((b) =>
      b.kind === "heading" && b.size >= 13.5 ? { ...b, text: b.text } : b,
    ),
    ctx,
    { headingDepth: 4 },
  );
  return {
    id: `rule:${slug}`,
    type: "rule",
    slug,
    name,
    subtitle: section,
    page: heading.page,
    section,
    description: md,
  };
}
