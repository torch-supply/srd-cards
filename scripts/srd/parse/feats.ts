import type { FeatEntry } from "../../../src/lib/srd/schema";
import { slugify } from "../pdf/text";
import { proseBlocksFor, blocksToMarkdown, CHAPTERS, type Ctx, splitAtHeadings, takeMeta } from "./common";

const META = /^(Origin|General|Fighting Style|Epic Boon) Feat(?: \(Prerequisite: (.+)\))?$/;

export function parseFeats(ctx: Ctx): FeatEntry[] {
  const blocks = proseBlocksFor(ctx, CHAPTERS.feats);
  // Entries are 12pt headings inside the "… Feats" category sections (14pt).
  let inCategory = false;
  const drafts = splitAtHeadings(blocks, (h) => {
    if (h.size >= 13.5 && h.size < 17) inCategory = / Feats$/.test(h.text);
    return inCategory && Math.abs(h.size - 12) < 0.3;
  });

  return drafts.map((draft): FeatEntry => {
    const name = draft.heading.text;
    const meta = takeMeta(draft) ?? "";
    const m = meta.match(META);
    if (!m) ctx.warnings.push(`Feat "${name}": unrecognized category line "${meta}".`);
    const category = m?.[1] ?? "";
    const prerequisite = m?.[2];
    const slug = slugify(name);
    return {
      id: `feat:${slug}`,
      type: "feat",
      slug,
      name,
      subtitle: prerequisite ? `${category} Feat · ${prerequisite}` : `${category} Feat`,
      page: draft.heading.page,
      meta,
      category,
      ...(prerequisite ? { prerequisite } : {}),
      description: blocksToMarkdown(draft.blocks, ctx),
    };
  });
}
