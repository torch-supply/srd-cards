import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EXAMPLES, randomExamples } from "@/lib/examples";
import { buildExample } from "@/lib/examples/build";
import { copyCollection } from "@/lib/model/core";
import { collectionSchema } from "@/lib/model/schema";
import type { IndexEntry } from "@/lib/srd/schema";
import { MemoryRepository } from "@/lib/storage/memory-repository";

const index = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "src", "data", "srd", "index.json"),
    "utf8",
  ),
) as IndexEntry[];

describe("example collections", () => {
  it("have unique slugs and say they are examples", () => {
    expect(new Set(EXAMPLES.map((e) => e.slug)).size).toBe(EXAMPLES.length);
    for (const e of EXAMPLES) expect(e.name).toMatch(/\(example\)$/);
  });

  for (const example of EXAMPLES) {
    it(`${example.slug} builds a valid collection from current SRD ids`, () => {
      const c = buildExample(example, index);
      expect(collectionSchema.safeParse(c).success).toBe(true);
      const ids = c.stacks.flatMap((s) => [s.id, ...s.cards.map((x) => x.id)]);
      expect(new Set(ids).size).toBe(ids.length);
    });
  }

  it("quote SRD text word for word in custom cards", () => {
    const descriptions = new Map<string, string>();
    for (const type of ["magic-item", "spell", "monster", "rule"])
      for (const e of JSON.parse(
        fs.readFileSync(
          path.join(process.cwd(), "src", "data", "srd", `${type}.json`),
          "utf8",
        ),
      ) as { id: string; description?: string }[])
        descriptions.set(e.id, e.description ?? "");
    const quoted = EXAMPLES.flatMap((e) =>
      e.stacks.flatMap((s) =>
        s.cards.filter(
          (c) => typeof c === "object" && "custom" in c && c.quotes,
        ),
      ),
    );
    expect(quoted.length).toBeGreaterThan(0);
    for (const card of quoted) {
      if (typeof card !== "object" || !("custom" in card)) continue;
      expect(descriptions.get(card.quotes!)).toContain(card.custom.body);
    }
  });

  it("picks distinct random examples", () => {
    const picked = randomExamples(3);
    expect(picked).toHaveLength(3);
    expect(new Set(picked.map((e) => e.slug)).size).toBe(3);
  });

  it("fails on an unknown SRD id", () => {
    const broken = {
      ...EXAMPLES[0],
      stacks: [{ name: "Stack", cards: ["spell:not-a-spell"] }],
    };
    expect(() => buildExample(broken, index)).toThrow(/spell:not-a-spell/);
  });
});

describe("copyCollection", () => {
  it("gives the copy fresh ids and keeps the content", () => {
    const original = buildExample(EXAMPLES[0], index);
    const copy = copyCollection(original, "2027-01-01T00:00:00.000Z");
    expect(copy.id).not.toBe(original.id);
    expect(copy.createdAt).toBe("2027-01-01T00:00:00.000Z");
    expect(copy.stacks.map((s) => s.name)).toEqual(
      original.stacks.map((s) => s.name),
    );
    const before = new Set(
      original.stacks.flatMap((s) => [s.id, ...s.cards.map((c) => c.id)]),
    );
    for (const s of copy.stacks) {
      expect(before.has(s.id)).toBe(false);
      for (const c of s.cards) expect(before.has(c.id)).toBe(false);
    }
  });
});

describe("MemoryRepository", () => {
  it("keeps saves in memory", async () => {
    const c = buildExample(EXAMPLES[1], index);
    const repo = new MemoryRepository([c]);
    const renamed = { ...c, name: "Renamed" };
    expect(await repo.save(renamed)).toEqual({ rev: 1, conflict: false });
    const result = await repo.get(c.id);
    expect(result.status === "ok" && result.collection.name).toBe("Renamed");
    expect(localStorage.length).toBe(0);
  });
});
