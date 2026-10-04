/**
 * Builds src/data/srd/*.json from the SRD 5.2.1 PDF.
 *
 *   pnpm srd:import
 *
 * The PDF is read from docs/SRD_CC_v5.2.1.pdf (or SRD_PDF_PATH, or downloaded
 * from the official URL into .cache/). Output is committed so builds never
 * need the PDF or the network.
 */
import fs from "node:fs";
import path from "node:path";
import {
  type IndexEntry,
  indexEntrySchema,
  type SrdEntry,
  srdEntrySchema,
  SRD_TYPES,
  type SrdType,
} from "../../src/lib/srd/schema";
import { emitPublic } from "./emit";
import { EXPECTED_COUNTS } from "./expected";
import { loadPdfLines, SRD_PDF_SHA256 } from "./pdf/extract";
import { parseClasses } from "./parse/classes";
import { createCtx } from "./parse/common";
import { parseEquipment } from "./parse/equipment";
import { parseFeats } from "./parse/feats";
import { parseMagicItems } from "./parse/magic-items";
import { parseMonsters } from "./parse/monsters";
import { parseGlossary, parseRuleChapters } from "./parse/rules";
import { parseSpells } from "./parse/spells";

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT_DIR = path.join(ROOT, "src", "data", "srd");
const LOCK_FILE = path.join(import.meta.dirname, "ids.lock.json");
const ALIASES_FILE = path.join(import.meta.dirname, "aliases.json");

const CREATURE_TYPES = [
  "Aberration",
  "Beast",
  "Celestial",
  "Construct",
  "Dragon",
  "Elemental",
  "Fey",
  "Fiend",
  "Giant",
  "Humanoid",
  "Monstrosity",
  "Ooze",
  "Plant",
  "Undead",
];

function baseCreatureType(text: string) {
  return (
    CREATURE_TYPES.find((t) => new RegExp(`\\b${t}s?\\b`).test(text)) ?? text
  );
}

function toIndex(entry: SrdEntry): IndexEntry {
  const common = {
    id: entry.id,
    type: entry.type,
    slug: entry.slug,
    name: entry.name,
    subtitle: entry.subtitle,
  };
  switch (entry.type) {
    case "spell":
      return {
        ...common,
        sort: entry.level,
        facets: {
          level: entry.level,
          school: entry.school,
          classes: entry.classes,
          concentration: entry.concentration,
          ritual: entry.ritual,
        },
      };
    case "monster":
      return {
        ...common,
        sort: entry.crValue ?? -1,
        facets: {
          cr: entry.crValue ?? -1,
          creatureType: baseCreatureType(entry.creatureType),
          size: entry.size.split(/,| or /)[0].trim(),
        },
        keywords: entry.group !== entry.name ? entry.group : undefined,
      };
    case "equipment":
      return {
        ...common,
        facets: {
          category: entry.category,
          ...(entry.subcategory ? { subcategory: entry.subcategory } : {}),
        },
      };
    case "magic-item":
      return {
        ...common,
        facets: {
          category: entry.category,
          rarity: entry.rarities,
          attunement: entry.attunement,
        },
      };
    case "feat":
      return { ...common, facets: { category: entry.category } };
    case "subclass":
      return {
        ...common,
        facets: { class: entry.className },
        keywords: entry.className,
      };
    case "rule":
      return {
        ...common,
        facets: {
          section: entry.section.split(" › ")[0],
          ...(entry.tag ? { tag: entry.tag } : {}),
        },
      };
    case "class":
    case "condition":
      return { ...common, facets: {} };
  }
}

function readJson<T>(file: string, fallback: T): T {
  return fs.existsSync(file)
    ? (JSON.parse(fs.readFileSync(file, "utf8")) as T)
    : fallback;
}

async function main() {
  const started = Date.now();
  const { pages } = await loadPdfLines();
  const ctx = createCtx(pages);

  const spells = parseSpells(ctx);
  const monsters = parseMonsters(ctx);
  const magicItems = parseMagicItems(ctx);
  const feats = parseFeats(ctx);
  const { classes, subclasses } = parseClasses(ctx);
  const glossary = parseGlossary(ctx);
  const equipment = parseEquipment(ctx);
  const taken = new Set(
    [...glossary.rules, ...equipment.rules].map((r) => r.id),
  );
  const chapterRules = parseRuleChapters(ctx, taken);

  const all: SrdEntry[] = [
    ...classes,
    ...subclasses,
    ...spells,
    ...monsters,
    ...equipment.equipment,
    ...magicItems,
    ...feats,
    ...glossary.conditions,
    ...glossary.rules,
    ...equipment.rules,
    ...chapterRules,
  ];

  // Validate.
  const errors: string[] = [];
  for (const entry of all) {
    const result = srdEntrySchema.safeParse(entry);
    if (!result.success) errors.push(`${entry.id}: ${result.error.message}`);
  }
  const seen = new Set<string>();
  for (const entry of all) {
    if (seen.has(entry.id)) errors.push(`Duplicate id ${entry.id}`);
    seen.add(entry.id);
  }
  const byType = new Map<SrdType, SrdEntry[]>(SRD_TYPES.map((t) => [t, []]));
  for (const entry of all) byType.get(entry.type)!.push(entry);
  for (const [type, expected] of Object.entries(EXPECTED_COUNTS)) {
    const actual = byType.get(type as SrdType)!.length;
    if (actual !== expected)
      errors.push(`Expected ${expected} ${type} entries, got ${actual}.`);
  }

  // Stable ids: every id ever published must still exist or have an alias.
  const lock = readJson<string[]>(LOCK_FILE, []);
  const aliases = readJson<Record<string, string>>(ALIASES_FILE, {});
  for (const id of lock) {
    if (!seen.has(id) && !(aliases[id] && seen.has(aliases[id]))) {
      errors.push(
        `Published id ${id} disappeared. Add it to scripts/srd/aliases.json.`,
      );
    }
  }

  if (errors.length) {
    console.error(
      `\n${errors.length} error(s):\n${errors.slice(0, 50).join("\n")}`,
    );
    process.exit(1);
  }

  // Write.
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const byName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, "en");
  for (const [type, entries] of byType) {
    fs.writeFileSync(
      path.join(OUT_DIR, `${type}.json`),
      `${JSON.stringify([...entries].sort(byName), null, 1)}\n`,
    );
  }
  const index = all
    .map(toIndex)
    .sort((a, b) => a.type.localeCompare(b.type) || byName(a, b));
  for (const entry of index) indexEntrySchema.parse(entry);
  fs.writeFileSync(
    path.join(OUT_DIR, "index.json"),
    `${JSON.stringify(index)}\n`,
  );
  const counts = Object.fromEntries([...byType].map(([t, e]) => [t, e.length]));
  fs.writeFileSync(
    path.join(OUT_DIR, "meta.json"),
    `${JSON.stringify({ source: "SRD 5.2.1", pdfSha256: SRD_PDF_SHA256, counts }, null, 2)}\n`,
  );
  const newLock = [...new Set([...lock, ...seen])].sort();
  fs.writeFileSync(LOCK_FILE, `${JSON.stringify(newLock, null, 1)}\n`);
  if (!fs.existsSync(ALIASES_FILE)) fs.writeFileSync(ALIASES_FILE, "{}\n");

  console.log(
    `Imported ${all.length} entries in ${((Date.now() - started) / 1000).toFixed(1)}s:`,
    counts,
  );
  if (ctx.warnings.length) {
    console.log(
      `\n${ctx.warnings.length} warning(s) (see pnpm srd:verify for the full report):`,
    );
    console.log(ctx.warnings.map((w) => `  - ${w}`).join("\n"));
  }
  fs.mkdirSync(path.join(ROOT, ".cache", "srd"), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, ".cache", "srd", "import-warnings.json"),
    JSON.stringify(ctx.warnings, null, 1),
  );
  emitPublic();
}

await main();
