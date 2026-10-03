import type { MagicItemEntry } from "../../../src/lib/srd/schema";
import { slugify } from "../pdf/text";
import { proseBlocksFor, blocksToMarkdown, CHAPTERS, type Ctx, relocateTables, splitAtHeadings, takeMeta } from "./common";
import { extractStatBlocks } from "./embedded";

const RARITY = /\b(Very Rare|Common|Uncommon|Rare|Legendary|Artifact|Rarity Varies|Varies)\b/g;
const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact", "Varies"];

export function parseMagicItems(ctx: Ctx): MagicItemEntry[] {
  const blocks = proseBlocksFor(ctx, CHAPTERS.magicItemsAZ);
  const drafts = splitAtHeadings(blocks, (h) => Math.abs(h.size - 12) < 0.3 && h.font !== "gill");
  relocateTables(drafts, ctx);
  const statBlocks = extractStatBlocks(drafts, ctx);

  return drafts.map((draft): MagicItemEntry => {
    const name = draft.heading.text;
    const meta = takeMeta(draft) ?? "";
    if (!meta) ctx.warnings.push(`Magic item "${name}": missing category/rarity line.`);
    const category = meta.match(/^([^,(]+)/)?.[1].trim() ?? "";
    const rarities = [...new Set([...meta.matchAll(RARITY)].map((m) => (m[1] === "Rarity Varies" ? "Varies" : m[1])))].sort(
      (a, b) => RARITY_ORDER.indexOf(a) - RARITY_ORDER.indexOf(b),
    );
    if (!rarities.length) ctx.warnings.push(`Magic item "${name}": no rarity in "${meta}".`);
    const attunement = /Requires Attunement/.test(meta);
    const rarityLabel =
      rarities.length > 1 ? `${rarities[0]}–${rarities[rarities.length - 1]}` : rarities[0] === "Varies" ? "Rarity Varies" : rarities[0];

    const slug = slugify(name);
    return {
      id: `magic-item:${slug}`,
      type: "magic-item",
      slug,
      name,
      subtitle: [category, rarityLabel, attunement ? "Attunement" : ""].filter(Boolean).join(" · "),
      page: draft.heading.page,
      meta,
      category,
      rarities,
      attunement,
      description: blocksToMarkdown(draft.blocks, ctx),
      ...(statBlocks.get(draft) ? { statBlocks: statBlocks.get(draft) } : {}),
    };
  });
}
