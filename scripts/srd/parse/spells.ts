import type { SpellEntry } from "../../../src/lib/srd/schema";
import { slugify, spansText } from "../pdf/text";
import { proseBlocksFor, blocksToMarkdown, CHAPTERS, type Ctx, relocateTables, splitAtHeadings, takeMeta } from "./common";
import { extractStatBlocks } from "./embedded";

const META = /^(?:Level (\d) (\w+)|(\w+) Cantrip) \((.+)\)$/;

export function parseSpells(ctx: Ctx): SpellEntry[] {
  const blocks = proseBlocksFor(ctx, CHAPTERS.spellDescriptions);
  const drafts = splitAtHeadings(blocks, (h) => Math.abs(h.size - 12) < 0.3 && h.font !== "gill");
  relocateTables(drafts, ctx);
  const statBlocks = extractStatBlocks(drafts, ctx);

  return drafts.map((draft): SpellEntry => {
    const name = draft.heading.text;
    const meta = takeMeta(draft) ?? "";
    const m = meta.match(META);
    if (!m) ctx.warnings.push(`Spell "${name}": unrecognized level/school line "${meta}".`);
    const level = m?.[1] ? Number(m[1]) : 0;
    const school = m?.[2] ?? m?.[3] ?? "";
    const classes = (m?.[4] ?? "").split(",").map((c) => c.trim()).filter(Boolean);

    // Casting Time / Range / Components / Duration: a label/value block, usually
    // set in GillSans (a table block), occasionally in Cambria (a paragraph).
    const fields: Record<string, string> = {};
    const fieldBlock = draft.blocks[0];
    const fieldLines =
      fieldBlock?.kind === "table"
        ? fieldBlock.lines
        : fieldBlock?.kind === "para" && /^Casting Time:/.test(fieldBlock.spans[0]?.text ?? "")
          ? fieldBlock.lines
          : undefined;
    if (fieldLines) {
      draft.blocks.shift();
      let label = "";
      for (const line of fieldLines) {
        const first = line.spans[0];
        const isLabel = (first.font === "gill-sb" || first.font === "body-b") && /:\s*$/.test(first.text);
        const value = spansText(isLabel ? line.spans.slice(1) : line.spans);
        if (isLabel) {
          label = first.text.replace(/:\s*$/, "").trim();
          fields[label] = value;
        } else if (label) {
          fields[label] = joinWrapped(fields[label], value);
        }
      }
    } else {
      ctx.warnings.push(`Spell "${name}": missing casting time/range/components/duration block.`);
    }

    const castingTime = fields["Casting Time"] ?? "";
    const componentsText = fields["Components"] ?? "";
    const duration = fields["Duration"] ?? "";
    const material = componentsText.match(/\bM \((.+)\)$/);
    const ritual = /\bor Ritual\b/.test(castingTime);
    const concentration = /^Concentration\b/.test(duration);

    const subtitle = [
      level === 0 ? `${school} Cantrip` : `Level ${level} ${school}`,
      concentration ? "Concentration" : "",
      ritual ? "Ritual" : "",
    ]
      .filter(Boolean)
      .join(" · ");

    const slug = slugify(name);
    return {
      id: `spell:${slug}`,
      type: "spell",
      slug,
      name,
      subtitle,
      page: draft.heading.page,
      level,
      school,
      classes,
      castingTime,
      ritual,
      range: fields["Range"] ?? "",
      components: {
        verbal: /(^|, )V\b/.test(componentsText),
        somatic: /(^|, )S\b/.test(componentsText),
        material: /(^|, )M\b/.test(componentsText),
        materialText: material?.[1],
      },
      componentsText,
      duration,
      concentration,
      description: blocksToMarkdown(draft.blocks, ctx),
      ...(statBlocks.get(draft) ? { statBlocks: statBlocks.get(draft) } : {}),
    };
  });
}

function joinWrapped(a: string, b: string) {
  if (/[\p{L}]-$/u.test(a) && /^\p{Ll}/u.test(b)) return a.slice(0, -1) + b;
  return `${a} ${b}`;
}
