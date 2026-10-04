import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { matchRanges, queryTerms } from "@/lib/srd/match";
import type { IndexEntry } from "@/lib/srd/schema";
import { createSearch } from "@/lib/srd/search";

const entries = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "src", "data", "srd", "index.json"),
    "utf8",
  ),
) as IndexEntry[];
const search = createSearch(entries);
const names = (query: string, type?: IndexEntry["type"]) =>
  search.search(query, type ? { types: [type] } : {}).map((e) => e.name);

describe("search", () => {
  it("matches any part of a name", () => {
    expect(names("ball", "spell")).toContain("Fireball");
    expect(names("sword", "equipment")).toEqual(
      expect.arrayContaining(["Longsword", "Greatsword", "Shortsword"]),
    );
  });

  it("ignores case and apostrophes", () => {
    expect(names("ALCHEMISTS FIRE")[0]).toBe("Alchemist’s Fire");
  });

  it("requires every word to match", () => {
    expect(names("goblin warrior")).toContain("Goblin Warrior");
    expect(names("goblin warrior")).not.toContain("Goblin Boss");
    expect(names("goblin xyzzy")).toEqual([]);
  });

  it("ranks exact, then prefix, then word-start matches", () => {
    expect(names("shield", "spell")[0]).toBe("Shield");
    const fire = names("fire", "spell");
    const at = (n: string) => fire.indexOf(n);
    for (const prefix of ["Fire Bolt", "Fireball", "Fire Shield"])
      expect(at(prefix)).toBeLessThan(at("Wall of Fire"));
    expect(at("Wall of Fire")).toBeGreaterThan(-1);
  });

  it("ranks name word starts, then mid-word, then subtitle matches", () => {
    expect(names("goblin warrior")).toEqual([
      "Goblin Warrior",
      "Hobgoblin Warrior",
      "Bugbear Warrior", // "Medium Fey (Goblinoid)"
    ]);
  });

  it("matches subtitles only at word starts", () => {
    // "evoc" starts "Evocation"; "voca" is inside it and in no spell name.
    expect(names("evoc", "spell").length).toBeGreaterThan(10);
    expect(names("voca", "spell")).toEqual([]);
  });

  it("returns everything in default order for an empty query", () => {
    expect(search.search("  ")).toHaveLength(entries.length);
  });
});

describe("matchRanges", () => {
  it("maps matches back to the original text", () => {
    expect(matchRanges("Alchemist’s Fire", queryTerms("ts fi"))).toEqual([
      [8, 11],
      [12, 14],
    ]);
  });

  it("merges overlapping ranges", () => {
    expect(matchRanges("Fireball", ["fire", "reb"])).toEqual([[0, 5]]);
  });

  it("honours word starts", () => {
    expect(matchRanges("Wall of Fire", ["f"], true)).toEqual([[8, 9]]);
  });
});
