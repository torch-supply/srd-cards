import { type CollectionSummary, summarize } from "@/lib/model/core";
import type { Collection } from "@/lib/model/schema";
import type {
  CollectionRepository,
  LoadResult,
  SaveResult,
} from "./repository";

/**
 * Keeps collections in memory only: nothing survives a reload. Used for the
 * example collections, which can be edited freely but are never stored.
 */
export class MemoryRepository implements CollectionRepository {
  private docs = new Map<string, Collection>();

  constructor(collections: Collection[] = []) {
    for (const c of collections) this.docs.set(c.id, c);
  }

  async list(): Promise<CollectionSummary[]> {
    return [...this.docs.values()].map(summarize);
  }

  async get(id: string): Promise<LoadResult> {
    const collection = this.docs.get(id);
    return collection ? { status: "ok", collection } : { status: "missing" };
  }

  async save(collection: Collection): Promise<SaveResult> {
    const rev = (this.docs.get(collection.id)?.rev ?? 0) + 1;
    this.docs.set(collection.id, { ...collection, rev });
    return { rev, conflict: false };
  }

  async delete(id: string): Promise<void> {
    this.docs.delete(id);
  }

  subscribe(): () => void {
    return () => {};
  }
}
