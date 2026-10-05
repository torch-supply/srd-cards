import type {
  BackgroundEntry,
  LabelValue,
  RuleEntry,
  SpeciesEntry,
} from "../../../src/lib/srd/schema";
import type { Block, TableBlock } from "../pdf/blocks";
import type { Span } from "../pdf/extract";
import { appendLine, slugify, spansText, spansToMarkdown } from "../pdf/text";
import {
  blocksToMarkdown,
  CHAPTERS,
  type Ctx,
  type Draft,
  proseBlocksFor,
  splitAtHeadings,
} from "./common";
import { makeRule } from "./rules";

/**
 * Character Origins: backgrounds and species (12pt entries under the 14pt
 * "… Descriptions" subsections), plus one rule per 18pt section for the
 * introductions ("Character Backgrounds" with "Parts of a Background", …).
 */
export function parseOrigins(
  ctx: Ctx,
  taken: Set<string>,
): {
  backgrounds: BackgroundEntry[];
  species: SpeciesEntry[];
  rules: RuleEntry[];
} {
  const blocks = proseBlocksFor(ctx, CHAPTERS.origins);
  const sections = splitAtHeadings(blocks, (h) => h.size >= 17 && h.size < 25);
  const backgrounds: BackgroundEntry[] = [];
  const species: SpeciesEntry[] = [];
  const rules: RuleEntry[] = [];
  for (const section of sections) {
    const start = section.blocks.findIndex(
      (b) =>
        b.kind === "heading" && b.size >= 13.5 && / Descriptions$/.test(b.text),
    );
    if (start === -1) {
      ctx.warnings.push(
        `Character Origins: no descriptions in "${section.heading.text}".`,
      );
      continue;
    }
    rules.push(
      makeRule(
        ctx,
        taken,
        "Character Origins",
        section.heading,
        section.heading.text,
        section.blocks.slice(0, start),
        "Character Origins",
      ),
    );
    const drafts = splitAtHeadings(
      section.blocks.slice(start + 1),
      (h) => Math.abs(h.size - 12) < 0.3,
    );
    placeTables(drafts);
    for (const draft of drafts) {
      const labels = draft.blocks[0];
      if (labels?.kind !== "table" || labels.title) {
        ctx.warnings.push(
          `${section.heading.text}: "${draft.heading.text}" has no label lines.`,
        );
        continue;
      }
      const fields = labeledFields(labels, ctx);
      const rest = draft.blocks.slice(1);
      if (section.heading.text === "Character Backgrounds")
        backgrounds.push(background(draft, fields, rest, ctx));
      else if (section.heading.text === "Character Species")
        species.push(speciesEntry(draft, fields, rest, ctx));
    }
  }
  return { backgrounds, species, rules };
}

function background(
  draft: Draft,
  fields: LabelValue[],
  rest: Block[],
  ctx: Ctx,
): BackgroundEntry {
  const name = draft.heading.text;
  const plain = (label: string) => {
    const field = fields.find((f) => f.label === label);
    if (!field) ctx.warnings.push(`Background "${name}": no "${label}" line.`);
    return plainMarkdown(field?.value ?? "");
  };
  if (rest.length)
    ctx.warnings.push(
      `Background "${name}": unexpected text after the label lines.`,
    );
  // “Magic Initiate (Cleric) (see “Feats”)” → “Magic Initiate (Cleric)”, feat:magic-initiate
  const feat = plain("Feat").replace(/\s*\(see “[^”]+”\)$/, "");
  const skills = plain("Skill Proficiencies").split(/ and |, /);
  const slug = slugify(name);
  return {
    id: `background:${slug}`,
    type: "background",
    slug,
    name,
    subtitle: `${feat} · ${skills.join(" and ")}`,
    page: draft.heading.page,
    abilityScores: plain("Ability Scores").split(/, /),
    feat,
    featId: `feat:${slugify(feat.replace(/\s*\(.*\)$/, ""))}`,
    skillProficiencies: skills,
    fields,
  };
}

function speciesEntry(
  draft: Draft,
  fields: LabelValue[],
  rest: Block[],
  ctx: Ctx,
): SpeciesEntry {
  const name = draft.heading.text;
  const plain = (label: string) => {
    const field = fields.find((f) => f.label === label);
    if (!field) ctx.warnings.push(`Species "${name}": no "${label}" line.`);
    return plainMarkdown(field?.value ?? "");
  };
  const size = plain("Size");
  const speed = plain("Speed");
  // “Medium (about 4–7 feet tall) or Small (about 2–4 feet tall), chosen …” → “Medium or Small”
  const sizes = [...size.matchAll(/\b(Tiny|Small|Medium|Large)\b/g)].map(
    (m) => m[1],
  );
  const slug = slugify(name);
  return {
    id: `species:${slug}`,
    type: "species",
    slug,
    name,
    subtitle: `${sizes.join(" or ")} · Speed ${speed}`,
    page: draft.heading.page,
    creatureType: plain("Creature Type"),
    size,
    sizes,
    speed,
    description: blocksToMarkdown(rest, ctx),
  };
}

/**
 * GillSans label lines (“**Feat:** Alert (see “Feats”)”), one field per
 * semibold label; unlabeled lines continue the previous value.
 */
function labeledFields(block: TableBlock, ctx: Ctx): LabelValue[] {
  const fields: { label: string; spans: Span[] }[] = [];
  for (const line of block.lines) {
    const [first, ...others] = line.spans;
    const label =
      first?.font === "gill-sb" ? first.text.match(/^(.+?):\s*$/) : null;
    if (label) fields.push({ label: label[1], spans: others });
    else if (fields.length)
      appendLine(fields[fields.length - 1].spans, line.spans, ctx.dict);
  }
  return fields.map((f) => ({
    label: f.label,
    value: spansToMarkdown(f.spans, { plainFonts: ["gill"] }),
  }));
}

/** Markdown field value as plain text. */
function plainMarkdown(markdown: string) {
  return markdown.replace(/[*_]/g, "").trim();
}

/**
 * Titled tables can sit out of reading order (the Elven Lineages table is set
 * inside Goliath). Moves a table that its own entry doesn't mention to the end
 * of the trait that mentions “the <title> table” (before the next
 * “***Trait.***” paragraph).
 */
function placeTables(drafts: Draft[]) {
  const mentions = (b: Block, ref: string) =>
    b.kind === "para" && spansText(b.spans).toLowerCase().includes(ref);
  const startsTrait = (b: Block) =>
    b.kind === "para" && b.spans.find((s) => s.text.trim())?.font === "body-bi";
  for (const owner of drafts) {
    for (const table of owner.blocks.filter(
      (b): b is TableBlock => b.kind === "table" && !!b.title,
    )) {
      const ref = `${table.title} table`.toLowerCase();
      if (owner.blocks.some((b) => mentions(b, ref))) continue;
      const draft = drafts.find((d) => d.blocks.some((b) => mentions(b, ref)));
      if (!draft) continue;
      owner.blocks.splice(owner.blocks.indexOf(table), 1);
      const at = draft.blocks.findIndex((b) => mentions(b, ref));
      const next = draft.blocks.findIndex((b, i) => i > at && startsTrait(b));
      draft.blocks.splice(next === -1 ? draft.blocks.length : next, 0, table);
    }
  }
}
