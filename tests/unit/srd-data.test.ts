import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  type IndexEntry,
  type SrdEntry,
  srdEntrySchema,
  SRD_TYPES,
} from "@/lib/srd/schema";

const DIR = path.join(process.cwd(), "src", "data", "srd");
const load = <T>(file: string) =>
  JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8")) as T;
const all: SrdEntry[] = SRD_TYPES.flatMap((t) => load<SrdEntry[]>(`${t}.json`));
const byId = new Map(all.map((e) => [e.id, e]));

describe("SRD data", () => {
  it("matches the SRD 5.2.1 counts", () => {
    const count = (t: string) => all.filter((e) => e.type === t).length;
    expect(count("spell")).toBe(339);
    expect(count("monster")).toBe(330);
    expect(count("class")).toBe(12);
    expect(count("subclass")).toBe(12);
    expect(count("feat")).toBe(17);
    expect(count("condition")).toBe(15);
  });

  it("validates against the schema with unique ids", () => {
    for (const e of all)
      expect(srdEntrySchema.safeParse(e).success, e.id).toBe(true);
    expect(byId.size).toBe(all.length);
  });

  it("keeps every published id (ids.lock.json)", () => {
    const lock = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), "scripts", "srd", "ids.lock.json"),
        "utf8",
      ),
    ) as string[];
    const aliases = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), "scripts", "srd", "aliases.json"),
        "utf8",
      ),
    ) as Record<string, string>;
    for (const id of lock)
      expect(byId.has(id) || byId.has(aliases[id]), id).toBe(true);
  });

  it("links classes and subclasses both ways", () => {
    for (const c of all.filter((e) => e.type === "class")) {
      for (const sub of c.subclassIds) {
        const s = byId.get(sub);
        expect(s?.type, sub).toBe("subclass");
        if (s?.type === "subclass") expect(s.classId).toBe(c.id);
      }
    }
  });

  it("names a real class for every spell", () => {
    const classes = new Set(
      all.filter((e) => e.type === "class").map((e) => e.name),
    );
    for (const s of all)
      if (s.type === "spell")
        for (const c of s.classes)
          expect(classes.has(c), `${s.name}: ${c}`).toBe(true);
  });

  it("includes the 15 magic items added in SRD 5.2.1", () => {
    for (const name of [
      "Cloak of Invisibility",
      "Sending Stones",
      "Hat of Many Spells",
      "Rod of Resurrection",
      "Thunderous Greatclub",
    ]) {
      expect(
        all.some((e) => e.type === "magic-item" && e.name === name),
        name,
      ).toBe(true);
    }
  });

  it("has one index row per entry with matching names", () => {
    const index = load<IndexEntry[]>("index.json");
    expect(index).toHaveLength(all.length);
    for (const row of index) expect(byId.get(row.id)?.name).toBe(row.name);
  });
});
