/**
 * Debug helper: prints the styled lines of a page range.
 *   pnpm tsx scripts/srd/pdf/dump.ts 258 260
 */
import { loadPdfLines } from "./extract";

const [from, to = from] = process.argv.slice(2).map(Number);
const { pages } = await loadPdfLines();
for (let p = from; p <= to; p++) {
  console.log(`===== page ${p} =====`);
  for (const line of pages[p - 1]) {
    const spans = line.spans
      .map(
        (s) =>
          `[${s.font}${s.size !== line.size ? `@${s.size}` : ""}${s.x !== line.x ? ` x${Math.round(s.x)}` : ""}]${s.text}`,
      )
      .join("");
    console.log(
      `${String(Math.round(line.x)).padStart(3)} ${String(Math.round(line.y)).padStart(3)} ${String(line.size).padEnd(4)} ${spans}`,
    );
  }
}
