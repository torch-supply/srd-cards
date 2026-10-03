/**
 * JSON export/import of collections. Imports always get fresh ids, so the same
 * file can be imported twice without collisions.
 */
import * as z from "zod/mini";
import { SRD_ATTRIBUTION } from "@/lib/attribution";
import { newId } from "@/lib/model/core";
import { type Collection, collectionSchema } from "@/lib/model/schema";
import { migrate } from "@/lib/storage/migrations";

export const EXPORT_FORMAT = 1;

const exportFileSchema = z.object({
  app: z.literal("srd.cards"),
  format: z.int(),
  exportedAt: z.optional(z.string()),
  collections: z.array(z.unknown()),
});

export function exportCollections(collections: Collection[]): string {
  return JSON.stringify(
    {
      app: "srd.cards",
      format: EXPORT_FORMAT,
      exportedAt: new Date().toISOString(),
      attribution: SRD_ATTRIBUTION,
      collections,
    },
    null,
    2,
  );
}

export function exportFileName(collections: Collection[]): string {
  const date = new Date().toISOString().slice(0, 10);
  if (collections.length === 1) {
    const slug = collections[0].name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "collection";
    return `srd-cards-${slug}-${date}.json`;
  }
  return `srd-cards-${date}.json`;
}

export function downloadJson(fileName: string, json: string) {
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ImportResult {
  collections: Collection[];
  /** SRD refs that aren't in the current data (cards still show their snapshot). */
  unknownRefs: string[];
}

/**
 * Parses an export file. Throws with a readable message on invalid input.
 * `knownRefs`/`aliases` let the caller resolve renamed SRD ids.
 */
export function parseImport(
  text: string,
  opts: { knownRefs?: Set<string>; aliases?: Record<string, string>; now?: string } = {},
): ImportResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("This file isn't valid JSON.");
  }
  const file = exportFileSchema.safeParse(json);
  if (!file.success) throw new Error("This file isn't an srd.cards export.");
  if (file.data.format > EXPORT_FORMAT) throw new Error("This file was exported by a newer version of srd.cards.");

  const now = opts.now ?? new Date().toISOString();
  const unknownRefs = new Set<string>();
  const collections = file.data.collections.map((raw, i) => {
    const migrated = migrate(raw);
    if (migrated.status === "newer") throw new Error("This file was exported by a newer version of srd.cards.");
    const parsed = collectionSchema.safeParse(migrated.data);
    if (!parsed.success) {
      throw new Error(`Collection ${i + 1} is invalid: ${parsed.error.issues[0]?.message ?? "unknown error"}`);
    }
    const c = parsed.data;
    return {
      ...c,
      id: newId(),
      // Keep the original creation date so "Date created" sorting survives a backup/restore.
      updatedAt: now,
      rev: 0,
      stacks: c.stacks.map((s) => ({
        ...s,
        id: newId(),
        cards: s.cards.map((card) => {
          let ref = card.ref;
          if (ref && opts.aliases?.[ref]) ref = opts.aliases[ref];
          if (ref && opts.knownRefs && !opts.knownRefs.has(ref)) unknownRefs.add(ref);
          return { ...card, id: newId(), ...(ref ? { ref } : {}) };
        }),
      })),
    } satisfies Collection;
  });
  return { collections, unknownRefs: [...unknownRefs] };
}
