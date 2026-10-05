import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { referenceHref } from "@/lib/srd/card-types";
import { buildSrdLinks, hrefFor } from "@/lib/srd/links";
import { renderEntry } from "@/lib/srd/render";
import { type SrdEntry, SRD_TYPES } from "@/lib/srd/schema";

const DIR = path.join(process.cwd(), "src", "data", "srd");
const all: SrdEntry[] = SRD_TYPES.flatMap(
  (t) =>
    JSON.parse(
      fs.readFileSync(path.join(DIR, `${t}.json`), "utf8"),
    ) as SrdEntry[],
);
const byId = new Map(all.map((e) => [e.id, e]));
const links = buildSrdLinks(all);
const hrefs = new Set(all.map((e) => referenceHref(e.type, e.slug)));

/** [text, href] of every link in an entry's rendered fields. */
function linksIn(entry: SrdEntry) {
  const json = JSON.stringify(renderEntry(entry, links));
  return [...json.matchAll(/<a href=\\"([^"\\]+)\\">(.*?)<\/a>/g)].map(
    (m) => [m[2].replace(/<[^>]+>/g, ""), m[1]] as const,
  );
}

describe("links between entries", () => {
  it("point at real entries, once per target, never at the entry itself", () => {
    for (const e of all) {
      const found = linksIn(e).map(([, href]) => href);
      for (const href of found)
        expect(hrefs, `${e.id} → ${href}`).toContain(href);
      expect(new Set(found).size, e.id).toBe(found.length);
      expect(found, e.id).not.toContain(referenceHref(e.type, e.slug));
    }
  });

  it("link italic spell names, defined terms, and quoted references", () => {
    expect(linksIn(byId.get("spell:fireball")!)).toEqual([
      ["Sphere", "/rules/sphere"],
    ]);
    const lich = linksIn(byId.get("monster:lich")!);
    expect(lich).toContainEqual(["Fireball", "/spells/fireball"]);
    expect(lich).toContainEqual(["Charmed", "/conditions/charmed"]);
    expect(lich).toContainEqual(["Truesight", "/rules/truesight"]);
    expect(linksIn(byId.get("rule:encounter")!)).toContainEqual([
      "Combat",
      "/rules/combat",
    ]);
    // Actions only as “<Name> action”, so a sentence starting “Attack …” isn’t linked.
    expect(links.terms.has("Attack")).toBe(false);
    expect(links.terms.get("Attack action")).toBe("/rules/attack");
  });

  it("leave bold run-in names and headings alone", () => {
    const html = JSON.stringify(
      renderEntry(byId.get("condition:blinded")!, links),
    );
    expect(html).toContain("<em><strong>Can’t See.</strong></em>");
    expect(html).not.toMatch(/<h\d>[^<]*<a /);
  });

  it("aren't added without a link index (the board's card data)", () => {
    for (const id of ["monster:lich", "class:wizard", "rule:encounter"])
      expect(JSON.stringify(renderEntry(byId.get(id)!))).not.toContain(
        "<a href",
      );
  });

  it("resolve structured names: classes, spells, weapon properties", () => {
    expect(hrefFor(links, "class", "Wizard")).toBe("/classes/wizard");
    expect(hrefFor(links, "spell", "Magic Missile")).toBe(
      "/spells/magic-missile",
    );
    expect(hrefFor(links, "Weapon Property", "Versatile")).toMatch(
      /^\/rules\//,
    );
    expect(hrefFor(links, "Mastery Property", "Sap")).toMatch(/^\/rules\//);
    // Every class spell-list name resolves to a spell.
    for (const e of all)
      if (e.type === "class")
        for (const group of e.spellList ?? [])
          for (const name of group.spells)
            expect(
              hrefFor(links, "spell", name),
              `${e.id}: ${name}`,
            ).toBeDefined();
  });
});
