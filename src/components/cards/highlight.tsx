import { matchRanges, normalize } from "@/lib/srd/match";

/** `text` with the parts matching `terms` (from `queryTerms`) marked. */
export function Highlight({
  text,
  terms,
  wordStart,
}: {
  text: string;
  terms: string[];
  /** Only mark matches at the start of a word, as the search does for subtitles. */
  wordStart?: boolean;
}) {
  const ranges = terms.length ? matchRanges(text, terms, wordStart) : [];
  if (!ranges.length) return text;
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (start > at) parts.push(text.slice(at, start));
    parts.push(
      <mark
        key={start}
        className="rounded-[2px] bg-yellow-300/60 text-inherit dark:bg-yellow-400/30"
      >
        {text.slice(start, end)}
      </mark>,
    );
    at = end;
  }
  if (at < text.length) parts.push(text.slice(at));
  return parts;
}

/** The terms a subtitle should mark: those the name doesn't already show. */
export function termsNotIn(name: string, terms: string[]): string[] {
  const norm = normalize(name).text;
  return terms.filter((t) => !norm.includes(t));
}
