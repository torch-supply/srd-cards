import MiniSearch from "minisearch";
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
  if (filters.types?.length && !filters.types.includes(entry.type)) return false;
  for (const [facet, values] of Object.entries(filters.facets ?? {})) {
    if (!values.length) continue;
    const value = entry.facets[facet];
    if (value === undefined) return false;
    const has = Array.isArray(value) ? value.some((v) => values.includes(v)) : values.includes(value);
    if (!has) return false;
  }
  for (const [facet, [min, max]] of Object.entries(filters.ranges ?? {})) {
    const value = entry.facets[facet];
    if (typeof value !== "number" || value < min || value > max) return false;
  }
  return true;
}

/** Default ordering: by type order, then sort key (level, CR), then name. */
export function compareEntries(a: IndexEntry, b: IndexEntry, typeOrder: SrdType[] = []): number {
  return (
    typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type) ||
    (a.sort ?? 0) - (b.sort ?? 0) ||
    a.name.localeCompare(b.name, "en")
  );
}

/** Builds an in-memory search over the index (~30ms for the full SRD). */
export function createSearch(entries: IndexEntry[], typeOrder: SrdType[] = []): SrdSearch {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const mini = new MiniSearch<IndexEntry>({
    fields: ["name", "subtitle", "keywords"],
    storeFields: [],
    searchOptions: { boost: { name: 4, keywords: 1.5 }, prefix: true, fuzzy: 0.15, combineWith: "AND" },
    processTerm: (term) => term.toLowerCase().replace(/[’']/g, ""),
  });
  mini.addAll(entries);
  const sorted = [...entries].sort((a, b) => compareEntries(a, b, typeOrder));

  return {
    search(query, filters = {}) {
      const q = query.trim();
      if (!q) return sorted.filter((e) => matchesFilters(e, filters));
      return mini
        .search(q)
        .map((r) => byId.get(r.id as string)!)
        .filter((e) => e && matchesFilters(e, filters));
    },
  };
}

export { matchesFilters };
