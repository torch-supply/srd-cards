/**
 * Debug helper: prints blocks for a page range.
 *   pnpm tsx scripts/srd/pdf/dump-blocks.ts 258 259
 */
import { buildBlocks, parseTable, tableToMarkdown } from "./blocks";
import { loadPdfLines } from "./extract";
import { Dictionary, spansToMarkdown } from "./text";

const [from, to = from] = process.argv.slice(2).map(Number);
const { pages } = await loadPdfLines();
const dict = new Dictionary(pages);
for (const b of buildBlocks(pages, from, to, dict)) {
  if (b.kind === "heading") console.log(`\n${"#".repeat(b.size >= 25 ? 1 : b.size >= 17 ? 2 : b.size >= 13.5 ? 3 : 4)} ${b.text}  (${b.size} ${b.font} p${b.page})`);
  else if (b.kind === "para") console.log(`${b.bullet ? "- " : ""}${spansToMarkdown(b.spans)}\n`);
  else if (b.kind === "sidebar") console.log(`> [sidebar] ${b.title ?? ""}\n${b.paras.map((p) => "> " + spansToMarkdown(p)).join("\n")}\n`);
  else console.log(tableToMarkdown(parseTable(b, dict)) + "\n");
}
