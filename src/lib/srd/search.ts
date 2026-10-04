import { normalize, occurrences, queryTerms } from "./match";
import type { IndexEntry, SrdType } from "./schema";

export type FacetValue = string | number | boolean | string[];

export interface SrdFilters {
  types?: SrdType[];
  /** Facet filters: an entry matches when its facet equals (or, for arrays, contains) any listed value. */
  facets?: Record<string, (string | number | boolean)[]>;
  /** Numeric range filters, e.g. { cr: [0, 5] }. */
  ranges?: Record<string, [number, number]>;
}

export interface SrdSearch {
  search(query: string, filters?: SrdFilters): IndexEntry[];
}

function matchesFilters(entry: IndexEntry, filters: SrdFilters): boolean {
  if (filters.types?.length && !filters.types.includes(entry.type))
    return false;
  for (const [facet, values] of Object.entries(filters.facets ?? {})) {
    if (!values.length) continue;
    const value = entry.facets[facet];
    if (value === undefined) return false;
    const has = Array.isArray(value)
      ? value.some((v) => values.includes(v))
      : values.includes(value);
    if (!has) return false;
  }
  for (const [facet, [min, max]] of Object.entries(filters.ranges ?? {})) {
    const value = entry.facets[facet];
    if (typeof value !== "number" || value < min || value > max) return false;
  }
  return true;
}

/** Default ordering: by type order, then sort key (level, CR), then name. */
export function compareEntries(
  a: IndexEntry,
  b: IndexEntry,
  typeOrder: SrdType[] = [],
): number {
  return (
    typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type) ||
    (a.sort ?? 0) - (b.sort ?? 0) ||
    a.name.localeCompare(b.name, "en")
  );
}

/**
 * Ranks a match: exact name, name starting with the query, every word at a word
 * start in the name, every word anywhere in the name, then matches that need the
 * subtitle or keywords. -1 when some word matches nowhere.
 */
function rank(name: string, other: string, terms: string[]): number {
  const phrase = terms.join(" ");
  if (name === phrase) return 0;
  if (name.startsWith(phrase)) return 1;
  if (terms.every((t) => occurrences(name, t, true).length)) return 2;
  if (terms.every((t) => name.includes(t))) return 3;
  // Subtitles and keywords only match at word starts: "con" in the middle of a word is noise there.
  if (
    terms.every((t) => name.includes(t) || occurrences(other, t, true).length)
  )
    return 4;
  return -1;
}

/**
 * An in-memory search over the index. A query's words must each appear in the
 * name (anywhere) or at the start of a word in the subtitle or keywords.
 */
export function createSearch(
  entries: IndexEntry[],
  typeOrder: SrdType[] = [],
): SrdSearch {
  const sorted = [...entries]
    .sort((a, b) => compareEntries(a, b, typeOrder))
    .map((entry) => ({
      entry,
      name: normalize(entry.name).text,
      other: normalize(
        [entry.subtitle, entry.keywords].filter(Boolean).join(" · "),
      ).text,
    }));

  return {
    search(query, filters = {}) {
      const terms = queryTerms(query);
      const hits: { entry: IndexEntry; rank: number }[] = [];
      for (const doc of sorted) {
        const r = terms.length ? rank(doc.name, doc.other, terms) : 0;
        if (r >= 0 && matchesFilters(doc.entry, filters))
          hits.push({ entry: doc.entry, rank: r });
      }
      // Stable: entries keep the default order within a rank.
      return hits.sort((a, b) => a.rank - b.rank).map((h) => h.entry);
    },
  };
}

export { matchesFilters };
