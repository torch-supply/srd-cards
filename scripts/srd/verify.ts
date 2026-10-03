/**
 * Verifies src/data/srd/ against the SRD 5.2.1 PDF and writes scripts/srd/report.md.
 *
 *   pnpm srd:verify
 *
 * 1. Counts per type (spells, stat blocks, classes, …) match the PDF.
 * 2. Coverage: every prose sentence on the content pages appears in the output.
 * 3. Cross-checks structured values against two open datasets (pinned commits):
 *    monster AC/HP/CR/abilities (Open5e) and spell level/school (5e-bits).
 */
import fs from "node:fs";
import path from "node:path";
import type { MonsterEntry, SpellEntry, SrdEntry, SrdType } from "../../src/lib/srd/schema";
import { EXPECTED_COUNTS } from "./expected";
import { lineText, loadPdfLines } from "./pdf/extract";
import { CHAPTERS } from "./parse/common";

const ROOT = path.resolve(import.meta.dirname, "../..");
const DATA = path.join(ROOT, "src", "data", "srd");
const CACHE = path.join(ROOT, ".cache", "srd", "sources");
const REPORT = path.join(import.meta.dirname, "report.md");

const SOURCES = {
  open5eCreatures:
    "https://raw.githubusercontent.com/open5e/open5e-api/a1a3e700902da188e97d15b073e8c1c788f54586/data/v2/wizards-of-the-coast/srd-2024/Creature.json",
  bitsSpells:
    "https://raw.githubusercontent.com/5e-bits/5e-database/a6212beb4b278917c2cff41c2b04c4ef4f3e0d6f/src/2024/en/5e-SRD-Spells.json",
};

async function source<T>(name: keyof typeof SOURCES): Promise<T | undefined> {
  const file = path.join(CACHE, `${name}.json`);
  if (!fs.existsSync(file)) {
    try {
      const res = await fetch(SOURCES[name]);
      if (!res.ok) throw new Error(String(res.status));
      fs.mkdirSync(CACHE, { recursive: true });
      fs.writeFileSync(file, await res.text());
    } catch (error) {
      console.warn(`Skipping cross-check ${name}: ${(error as Error).message}`);
      return undefined;
    }
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function load<T extends SrdEntry>(type: SrdType): T[] {
  return JSON.parse(fs.readFileSync(path.join(DATA, `${type}.json`), "utf8")) as T[];
}

const normalize = (s: string) =>
  s
    .replace(/[*_\\|#>`]/g, " ")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** All strings in an entry, flattened (markdown included). */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => strings(v, out));
  return out;
}

async function main() {
  const lines: string[] = ["# SRD 5.2.1 verification report", ""];
  let problems = 0;

  // 1. Counts.
  const meta = JSON.parse(fs.readFileSync(path.join(DATA, "meta.json"), "utf8")) as { counts: Record<string, number> };
  lines.push("## Counts", "", "| Type | Entries | Expected (PDF) |", "| --- | --- | --- |");
  for (const [type, count] of Object.entries(meta.counts)) {
    const expected = EXPECTED_COUNTS[type as SrdType];
    if (expected !== undefined && expected !== count) problems++;
    lines.push(`| ${type} | ${count} | ${expected ?? "—"} ${expected !== undefined && expected !== count ? "❌" : ""} |`);
  }

  // 2. Coverage of prose sentences, page by page.
  const { pages } = await loadPdfLines();
  const corpus = normalize(
    (["class", "subclass", "spell", "monster", "equipment", "magic-item", "feat", "condition", "rule"] as SrdType[])
      .flatMap((t) => load(t).flatMap((e) => strings(e)))
      .join(" \n "),
  );
  const ranges: [string, readonly [number, number]][] = [
    ["Playing the Game", CHAPTERS.playingTheGame],
    ["Character Creation", CHAPTERS.characterCreation],
    ["Classes", CHAPTERS.classes],
    ["Feats", CHAPTERS.feats],
    ["Equipment", CHAPTERS.equipment],
    ["Spells", CHAPTERS.spellDescriptions],
    ["Rules Glossary", CHAPTERS.rulesGlossary],
    ["Spellcasting", CHAPTERS.spellcasting],
    ["Gameplay Toolbox", CHAPTERS.gameplayToolbox],
    ["Magic Items (intro)", CHAPTERS.magicItemsIntro],
    ["Magic Items", CHAPTERS.magicItemsAZ],
    ["Monsters (intro)", CHAPTERS.monstersIntro],
    ["Monsters", CHAPTERS.monstersAZ],
    ["Animals", CHAPTERS.animals],
  ];
  lines.push("", "## Prose coverage", "", "Sentences of 8+ words from body text found verbatim in the output.", "");
  lines.push("| Chapter | Pages | Sentences | Found | Coverage |", "| --- | --- | --- | --- | --- |");
  const missing: string[] = [];
  for (const [name, [from, to]] of ranges) {
    let total = 0;
    let found = 0;
    for (let p = from; p <= to; p++) {
      // Join body lines (Cambria/Optima), undoing line-end hyphenation roughly.
      // Prose only: skip stat block fields (9pt), and keep all-italic lines
      // (category/meta lines) as separate units.
      const text = pages[p - 1]
        .filter((l) => l.spans.some((s) => s.font.startsWith("body")) && l.size >= 9.4)
        .map((l) => (l.spans.every((s) => s.font === "body-i") ? `\u0000${lineText(l)}\u0000` : lineText(l)))
        .join("\n")
        .replace(/(\p{Ll})-\n(\p{Ll})/gu, "$1$2")
        .replace(/\n/g, " ");
      for (const sentence of text.split(/(?<=[.!?])\s+(?=[A-Z“])|\u0000/)) {
        const s = normalize(sentence);
        if (s.split(" ").length < 8) continue;
        total++;
        if (corpus.includes(s)) found++;
        else missing.push(`p${p}: ${sentence.trim().slice(0, 160)}`);
      }
    }
    const pct = total ? (100 * found) / total : 100;
    lines.push(`| ${name} | ${from}–${to} | ${total} | ${found} | ${pct.toFixed(1)}% |`);
  }
  lines.push(
    "",
    "Sentences that span a column or page break, or sit next to an out-of-order table, often show up below even though the text is present; review them by hand.",
    "",
    "<details><summary>Sentences not found verbatim (" + missing.length + ")</summary>",
    "",
    ...missing.map((m) => `- ${m}`),
    "",
    "</details>",
  );

  // 3. Cross-checks.
  lines.push("", "## Cross-checks against open datasets", "");
  const creatures = await source<{ fields: Record<string, unknown> }[]>("open5eCreatures");
  if (creatures) {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
    const byName = new Map(creatures.map((c) => [norm(String(c.fields.name)), c.fields]));
    const diffs: string[] = [];
    for (const m of load<MonsterEntry>("monster")) {
      const o = byName.get(norm(m.name));
      if (!o) {
        diffs.push(`${m.name}: not in Open5e`);
        continue;
      }
      const checks: [string, unknown, unknown][] = [
        ["AC", Number(m.ac.match(/^\d+/)?.[0]), o.armor_class],
        ["HP", Number(m.hp.match(/^\d+/)?.[0]), o.hit_points],
        ["CR", m.crValue, Number(o.challenge_rating)],
        ["Str", m.abilities.str.score, o.ability_score_strength],
        ["Dex", m.abilities.dex.score, o.ability_score_dexterity],
        ["Con", m.abilities.con.score, o.ability_score_constitution],
        ["Int", m.abilities.int.score, o.ability_score_intelligence],
        ["Wis", m.abilities.wis.score, o.ability_score_wisdom],
        ["Cha", m.abilities.cha.score, o.ability_score_charisma],
      ];
      for (const [label, ours, theirs] of checks) if (ours !== theirs) diffs.push(`${m.name}: ${label} ${ours} (PDF) vs ${theirs} (Open5e)`);
    }
    lines.push(`### Monsters vs Open5e (${creatures.length} creatures)`, "", diffs.length ? diffs.map((d) => `- ${d}`).join("\n") : "No differences.", "");
  }
  const bitsSpells = await source<{ name: string; level: number; school: { name: string } }[]>("bitsSpells");
  if (bitsSpells) {
    const byName = new Map(bitsSpells.map((s) => [s.name.toLowerCase().replace(/[’']/g, "'"), s]));
    const diffs: string[] = [];
    for (const s of load<SpellEntry>("spell")) {
      const b = byName.get(s.name.toLowerCase().replace(/[’']/g, "'"));
      if (!b) diffs.push(`${s.name}: not in 5e-bits`);
      else if (b.level !== s.level || b.school.name !== s.school) {
        diffs.push(`${s.name}: Level ${s.level} ${s.school} (PDF) vs Level ${b.level} ${b.school.name} (5e-bits)`);
      }
    }
    lines.push(`### Spells vs 5e-bits (${bitsSpells.length} spells)`, "", diffs.length ? diffs.map((d) => `- ${d}`).join("\n") : "No differences.", "");
  }

  // Import warnings.
  const warningsFile = path.join(ROOT, ".cache", "srd", "import-warnings.json");
  if (fs.existsSync(warningsFile)) {
    const warnings = JSON.parse(fs.readFileSync(warningsFile, "utf8")) as string[];
    lines.push("## Import warnings", "", warnings.length ? warnings.map((w) => `- ${w}`).join("\n") : "None.", "");
  }

  fs.writeFileSync(REPORT, `${lines.join("\n")}\n`);
  console.log(lines.filter((l) => l.startsWith("|")).join("\n"));
  console.log(`\nReport: ${path.relative(ROOT, REPORT)}${problems ? ` — ${problems} count problem(s)` : ""}`);
  if (problems) process.exit(1);
}

await main();
