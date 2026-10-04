import { describe, expect, it } from "vitest";
import { exportCollections, parseImport } from "@/lib/export";
import { apply, createCollection } from "@/lib/model/commands";

function sample() {
  let c = createCollection({
    name: "Encounters",
    id: "c1",
    now: "2025-05-01T00:00:00.000Z",
  });
  c = apply(c, { type: "addStack", stackId: "s1", name: "Goblin ambush" });
  c = apply(c, {
    type: "addSrdCard",
    stackId: "s1",
    cardId: "k1",
    ref: "monster:goblin-warrior",
    snapshot: { name: "Goblin Warrior", subtitle: "" },
  });
  c = apply(c, {
    type: "addSrdCard",
    stackId: "s1",
    cardId: "k2",
    ref: "spell:no-such-spell",
    snapshot: { name: "Old Spell", subtitle: "" },
  });
  return c;
}

describe("export/import", () => {
  it("round-trips with fresh ids and the original creation date", () => {
    const json = exportCollections([sample()]);
    const { collections, unknownRefs } = parseImport(json, {
      knownRefs: new Set(["monster:goblin-warrior"]),
      now: "2026-10-02T00:00:00.000Z",
    });
    expect(collections).toHaveLength(1);
    const c = collections[0];
    expect(c.id).not.toBe("c1");
    expect(c.stacks[0].id).not.toBe("s1");
    expect(c.stacks[0].cards.map((k) => k.id)).not.toContain("k1");
    expect(c.createdAt).toBe("2025-05-01T00:00:00.000Z");
    expect(c.updatedAt).toBe("2026-10-02T00:00:00.000Z");
    expect(c.stacks[0].cards.map((k) => k.ref)).toEqual([
      "monster:goblin-warrior",
      "spell:no-such-spell",
    ]);
    expect(unknownRefs).toEqual(["spell:no-such-spell"]);
  });

  it("importing the same file twice never collides", () => {
    const json = exportCollections([sample()]);
    const a = parseImport(json).collections[0];
    const b = parseImport(json).collections[0];
    expect(a.id).not.toBe(b.id);
  });

  it("resolves renamed SRD ids through aliases", () => {
    const json = exportCollections([sample()]);
    const { collections } = parseImport(json, {
      aliases: { "spell:no-such-spell": "spell:fireball" },
    });
    expect(collections[0].stacks[0].cards[1].ref).toBe("spell:fireball");
  });

  it("includes the SRD attribution in exports", () => {
    expect(JSON.parse(exportCollections([sample()])).attribution).toContain(
      "System Reference Document 5.2.1",
    );
  });

  it("rejects files that aren't srd.cards exports", () => {
    expect(() => parseImport("not json")).toThrow("valid JSON");
    expect(() => parseImport('{"hello":1}')).toThrow(
      "isn't an srd.cards export",
    );
    expect(() =>
      parseImport('{"app":"srd.cards","format":99,"collections":[]}'),
    ).toThrow("newer version");
    expect(() =>
      parseImport('{"app":"srd.cards","format":1,"collections":[{"id":"x"}]}'),
    ).toThrow("Collection 1 is invalid");
  });
});
