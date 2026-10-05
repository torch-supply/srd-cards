import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { type SrdEntry, SRD_TYPES } from "@/lib/srd/schema";
import {
  breadcrumbJsonLd,
  entryDescription,
  MAX_DESCRIPTION,
  plainText,
  truncate,
} from "@/lib/seo";

const DIR = path.join(process.cwd(), "src", "data", "srd");
const all: SrdEntry[] = SRD_TYPES.flatMap(
  (t) =>
    JSON.parse(
      fs.readFileSync(path.join(DIR, `${t}.json`), "utf8"),
    ) as SrdEntry[],
);
const byId = new Map(all.map((e) => [e.id, e]));

describe("entry meta descriptions", () => {
  it("are plain text of a useful length for every entry", () => {
    for (const e of all) {
      const d = entryDescription(e);
      expect(d.length, e.id).toBeGreaterThanOrEqual(30);
      expect(d.length, e.id).toBeLessThanOrEqual(MAX_DESCRIPTION);
      expect(d, e.id).not.toMatch(/[*#|<>]|\.\.|\s{2}/);
    }
  });

  it("lead with the facts, then quote the SRD", () => {
    expect(entryDescription(byId.get("spell:fireball")!)).toMatch(
      /^Level 3 Evocation spell \(Sorcerer, Wizard\)\. A bright streak flashes from you/,
    );
    expect(entryDescription(byId.get("monster:aboleth")!)).toBe(
      "CR 10 Large Aberration, Lawful Evil. AC 17 · HP 150 (20d10 + 40) · Speed 10 ft., Swim 40 ft.",
    );
    expect(entryDescription(byId.get("equipment:longsword")!)).toBe(
      "Martial Melee Weapon · 1d8 Slashing. Cost 15 GP · Weight 3 lb. · Properties: Versatile (1d10) · Mastery: Sap.",
    );
    // A subtitle that only repeats the type is left out.
    expect(entryDescription(byId.get("condition:blinded")!)).toMatch(
      /^While you have the Blinded condition/,
    );
  });
});

describe("plainText", () => {
  it("drops headings, tables, and taglines and strips markup", () => {
    expect(
      plainText(
        "#### Heading\n\n*A Tagline*\n\n***Run-in.*** Body with [a link](/x).\n\n| a | b |\n|---|---|\n\n- one\n- two",
      ),
    ).toBe("Run-in. Body with a link. one two");
  });
});

describe("truncate", () => {
  it("cuts at a word boundary and adds an ellipsis", () => {
    expect(truncate("short", 10)).toBe("short");
    expect(truncate("one two three, four", 15)).toBe("one two three…");
  });
});

describe("breadcrumbJsonLd", () => {
  it("numbers items and makes URLs absolute", () => {
    expect(
      breadcrumbJsonLd([
        { name: "srd.cards", path: "/" },
        { name: "Spells", path: "/spells" },
      ]).itemListElement,
    ).toEqual([
      {
        "@type": "ListItem",
        position: 1,
        name: "srd.cards",
        item: "https://srd.cards/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Spells",
        item: "https://srd.cards/spells",
      },
    ]);
  });
});
