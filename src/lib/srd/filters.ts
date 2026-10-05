import type { IndexEntry, SrdType } from "./schema";

export interface FacetFilterDef {
  key: string;
  label: string;
  /** select: one value of a string/number facet; toggle: boolean facet must be true; bucket: numeric range. */
  kind: "select" | "toggle" | "bucket";
  /** Fixed options; otherwise derived from the data. */
  options?: { value: string; label: string }[];
  buckets?: { value: string; label: string; min: number; max: number }[];
}

const SPELL_LEVELS = [
  { value: "0", label: "Cantrip" },
  ...Array.from({ length: 9 }, (_, i) => ({
    value: String(i + 1),
    label: `Level ${i + 1}`,
  })),
];

const CR_BUCKETS = [
  { value: "0-1", label: "CR 0–1", min: 0, max: 1 },
  { value: "2-4", label: "CR 2–4", min: 2, max: 4 },
  { value: "5-10", label: "CR 5–10", min: 5, max: 10 },
  { value: "11-16", label: "CR 11–16", min: 11, max: 16 },
  { value: "17-30", label: "CR 17+", min: 17, max: 30 },
];

const RARITIES = [
  "Common",
  "Uncommon",
  "Rare",
  "Very Rare",
  "Legendary",
  "Artifact",
  "Varies",
].map((r) => ({
  value: r,
  label: r === "Varies" ? "Rarity Varies" : r,
}));

export const FILTERS: Record<SrdType, FacetFilterDef[]> = {
  spell: [
    { key: "level", label: "Level", kind: "select", options: SPELL_LEVELS },
    { key: "school", label: "School", kind: "select" },
    { key: "classes", label: "Class", kind: "select" },
    { key: "concentration", label: "Concentration", kind: "toggle" },
    { key: "ritual", label: "Ritual", kind: "toggle" },
  ],
  monster: [
    { key: "cr", label: "Challenge", kind: "bucket", buckets: CR_BUCKETS },
    { key: "creatureType", label: "Type", kind: "select" },
    { key: "size", label: "Size", kind: "select" },
  ],
  equipment: [
    { key: "category", label: "Category", kind: "select" },
    { key: "subcategory", label: "Kind", kind: "select" },
  ],
  "magic-item": [
    { key: "rarity", label: "Rarity", kind: "select", options: RARITIES },
    { key: "category", label: "Category", kind: "select" },
    { key: "attunement", label: "Attunement", kind: "toggle" },
  ],
  feat: [{ key: "category", label: "Category", kind: "select" }],
  class: [],
  background: [],
  species: [],
  subclass: [{ key: "class", label: "Class", kind: "select" }],
  condition: [],
  rule: [{ key: "section", label: "Section", kind: "select" }],
};

const SIZE_ORDER = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];

/** Options for a select facet, from the data when not fixed. */
export function facetOptions(
  def: FacetFilterDef,
  entries: IndexEntry[],
): { value: string; label: string }[] {
  if (def.options) return def.options;
  const values = new Set<string>();
  for (const e of entries) {
    const v = e.facets[def.key];
    if (Array.isArray(v)) v.forEach((x) => values.add(x));
    else if (v !== undefined && typeof v !== "boolean") values.add(String(v));
  }
  const list = [...values];
  if (def.key === "size")
    list.sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b));
  else list.sort((a, b) => a.localeCompare(b));
  return list.map((v) => ({ value: v, label: v }));
}

/** Selected filter values for one type: facet key → value ("" = any; "true" for toggles). */
export type FilterState = Record<string, string>;

export function matchesFilterState(
  entry: IndexEntry,
  defs: FacetFilterDef[],
  state: FilterState,
): boolean {
  for (const def of defs) {
    const selected = state[def.key];
    if (!selected) continue;
    const value = entry.facets[def.key];
    if (def.kind === "toggle") {
      if (value !== true) return false;
    } else if (def.kind === "bucket") {
      const bucket = def.buckets?.find((b) => b.value === selected);
      if (
        !bucket ||
        typeof value !== "number" ||
        value < bucket.min ||
        value > bucket.max
      )
        return false;
    } else if (Array.isArray(value)) {
      if (!value.includes(selected)) return false;
    } else if (String(value) !== selected) {
      return false;
    }
  }
  return true;
}
