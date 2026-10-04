/**
 * Pins the exact output of the SRD parsers for a sample of entries that
 * exercise tricky layouts. A parser change that alters any of them fails here.
 *
 * If the change is intended: review the diff, then run `pnpm test -u`.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SrdEntry, SrdType } from "@/lib/srd/schema";

const DIR = path.join(process.cwd(), "src", "data", "srd");
const cache = new Map<SrdType, SrdEntry[]>();
function entry(id: string): SrdEntry {
  const [type, slug] = id.split(":") as [SrdType, string];
  if (!cache.has(type))
    cache.set(
      type,
      JSON.parse(fs.readFileSync(path.join(DIR, `${type}.json`), "utf8")),
    );
  const found = cache.get(type)!.find((e) => e.slug === slug);
  if (!found) throw new Error(`Missing SRD entry ${id}`);
  return found;
}

/** Each sample covers a layout the parser has to get right. */
const SAMPLES: Record<string, string> = {
  "spell:fireball": "plain spell",
  "spell:acid-splash": "heading set in small caps",
  "spell:chill-touch": "header fields set in Cambria, not GillSans",
  "spell:confusion": "headerless-looking d10 table with a wrapped row",
  "spell:prismatic-spray":
    "table continued across a page, with bold/italic cells",
  "spell:teleport": "multi-line table header",
  "spell:find-steed": "embedded stat block placed out of reading order",
  "spell:magic-circle": "paragraph following a bullet list",
  "monster:aboleth": "legendary actions, lair XP",
  "monster:adult-white-dragon": "ability label set in SemiBold",
  "monster:werewolf": "single 5.2.1 stat block for a shapechanger",
  "monster:octopus": "added in 5.2.1 (5e-bits lacks it)",
  "monster:lich": "spellcasting action with spell lists",
  "class:barbarian": "core traits table and features table",
  "class:wizard": "caster table header groups, spell list, sidebar",
  "class:sorcerer": "metamagic options folded into a feature",
  "subclass:circle-of-the-land": "subclass spell tables",
  "equipment:hand-crossbow": "weapon row with wrapped properties",
  "equipment:plate-armor": "armor with don/doff fields",
  "equipment:smiths-tools": "tool block split across a page break",
  "magic-item:apparatus-of-the-crab": "table placed after another item",
  "magic-item:armor-of-resistance": "side-by-side table halves",
  "magic-item:cloak-of-invisibility": "added in 5.2.1",
  "magic-item:rod-of-alertness": "bullets followed by a run-in heading",
  "magic-item:figurine-of-wondrous-power": "embedded stat block",
  "feat:grappler": "prerequisite parsing",
  "condition:exhaustion": "condition from the Rules Glossary",
  "rule:long-rest": "bullet list followed by a paragraph",
  "rule:actions": "table continued on the next page under another table",
  "rule:level-advancement": "centered multi-line table headers",
};

describe("SRD parser output snapshots", () => {
  for (const [id, why] of Object.entries(SAMPLES)) {
    it(`${id} (${why})`, () => {
      expect(entry(id)).toMatchSnapshot();
    });
  }
});
