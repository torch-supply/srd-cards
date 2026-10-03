import { getRepository } from "@/lib/storage";
import { apply, createCollection } from "./commands";
import { newId } from "./core";
import type { Collection } from "./schema";

export interface EntryRef {
  id: string;
  name: string;
  subtitle: string;
}

export type StackTarget = { stackId: string } | { newStackName: string };

/**
 * Adds an SRD entry to a stored collection (outside the collection page, e.g.
 * from a reference page). Returns the updated collection and target stack.
 */
export async function addEntryToCollection(
  collectionId: string,
  target: StackTarget,
  entry: EntryRef,
): Promise<{ collection: Collection; stackId: string }> {
  const repo = getRepository();
  const result = await repo.get(collectionId);
  if (result.status !== "ok") throw new Error("That collection can't be edited right now.");
  let c = result.collection;
  let stackId: string;
  if ("newStackName" in target) {
    stackId = newId();
    c = apply(c, { type: "addStack", stackId, name: target.newStackName.trim() || "New stack" });
  } else {
    stackId = target.stackId;
  }
  c = apply(c, {
    type: "addSrdCard",
    stackId,
    cardId: newId(),
    ref: entry.id,
    snapshot: { name: entry.name, subtitle: entry.subtitle },
  });
  const updated = { ...c, updatedAt: new Date().toISOString() };
  await repo.save(updated, { baseRev: result.collection.rev });
  return { collection: updated, stackId };
}

/** Creates a collection with one stack holding the entry. */
export async function createCollectionWithEntry(name: string, entry: EntryRef): Promise<Collection> {
  const stackId = newId();
  let c = createCollection({ name });
  c = apply(c, { type: "addStack", stackId, name: "Cards" });
  c = apply(c, {
    type: "addSrdCard",
    stackId,
    cardId: newId(),
    ref: entry.id,
    snapshot: { name: entry.name, subtitle: entry.subtitle },
  });
  await getRepository().save(c);
  return c;
}
