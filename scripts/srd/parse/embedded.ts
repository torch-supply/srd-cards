import type { StatBlock } from "../../../src/lib/srd/schema";
import type { Block } from "../pdf/blocks";
import { spansText } from "../pdf/text";
import type { Ctx, Draft } from "./common";
import { isStatBlockHeading, parseStatBlock } from "./monsters";

const STAT_SECTIONS = new Set(["Traits", "Actions", "Bonus Actions", "Reactions", "Legendary Actions"]);

/** Stat block body text is 9–9.5pt; regular prose is 10pt. */
function isStatBlockContent(b: Block) {
  if (b.kind === "heading") return STAT_SECTIONS.has(b.text);
  if (b.kind === "table") return true;
  if (b.kind === "para") return b.size <= 9.7;
  return false;
}

/**
 * Pulls stat blocks embedded in spell or magic item drafts out of the prose and
 * attaches each to the draft that refers to it ("… uses the Otherworldly Steed
 * stat block"). Stat blocks are separate frames in the PDF and often sit out
 * of reading order.
 */
export function extractStatBlocks(drafts: Draft[], ctx: Ctx): Map<Draft, StatBlock[]> {
  const found: { block: StatBlock; from: Draft }[] = [];
  for (const draft of drafts) {
    for (let i = 0; i < draft.blocks.length; i++) {
      const b = draft.blocks[i];
      if (!isStatBlockHeading(b) || b.kind !== "heading") continue;
      let end = i + 1;
      while (end < draft.blocks.length && isStatBlockContent(draft.blocks[end])) end++;
      const body = draft.blocks.slice(i + 1, end);
      draft.blocks.splice(i, end - i);
      i--;
      const statBlock = parseStatBlock(b.text, body, ctx);
      if (statBlock) found.push({ block: statBlock, from: draft });
    }
  }

  const texts = drafts.map((d) =>
    d.blocks
      .filter((b) => b.kind === "para")
      .map((b) => spansText(b.spans))
      .join(" ")
      .toLowerCase(),
  );
  const result = new Map<Draft, StatBlock[]>();
  for (const { block, from } of found) {
    const ref = `${block.name.toLowerCase()} stat block`;
    const ownerIdx = texts.findIndex((t) => t.includes(ref));
    const owner = ownerIdx === -1 ? from : drafts[ownerIdx];
    if (ownerIdx === -1) {
      ctx.warnings.push(`Stat block "${block.name}" isn't referenced by name; kept with "${from.heading.text}".`);
    }
    result.set(owner, [...(result.get(owner) ?? []), block]);
  }
  return result;
}
