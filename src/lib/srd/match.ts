/**
 * Text matching shared by the search and the result highlighting, so what is
 * highlighted is exactly what matched. Case and apostrophes are ignored
 * ("alchemists" finds "Alchemist’s").
 */

const IGNORED = /[’']/;

/** Lowercased text without apostrophes, plus each character's index in the original. */
export function normalize(text: string): { text: string; map: number[] } {
  let out = "";
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (IGNORED.test(text[i])) continue;
    for (const ch of text[i].toLowerCase()) {
      out += ch;
      map.push(i);
    }
  }
  return { text: out, map };
}

/** The query's words, normalized. */
export function queryTerms(query: string): string[] {
  return normalize(query).text.split(/\s+/).filter(Boolean);
}

const isWordChar = (ch: string | undefined) => !!ch && /[\p{L}\p{N}]/u.test(ch);

/** Start indexes of `term` in normalized `text`; with `wordStart`, only where a word begins. */
export function occurrences(
  text: string,
  term: string,
  wordStart = false,
): number[] {
  const out: number[] = [];
  for (let i = text.indexOf(term); i !== -1; i = text.indexOf(term, i + 1))
    if (!wordStart || !isWordChar(text[i - 1])) out.push(i);
  return out;
}

/** Merged [start, end) ranges of the original `text` that the terms match. */
export function matchRanges(
  text: string,
  terms: string[],
  wordStart = false,
): [number, number][] {
  const norm = normalize(text);
  const ranges: [number, number][] = [];
  for (const term of terms)
    for (const i of occurrences(norm.text, term, wordStart))
      ranges.push([norm.map[i], norm.map[i + term.length - 1] + 1]);
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push(r);
  }
  return merged;
}
