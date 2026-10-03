import { type CollectionSummary, summarize } from "@/lib/model/core";
import { type Collection, collectionSchema } from "@/lib/model/schema";
import { migrate } from "./migrations";
import { type CollectionRepository, type LoadResult, type SaveResult, StorageError } from "./repository";

const PREFIX = "srdcards:v1:";
const COLLECTION_PREFIX = `${PREFIX}collection:`;
const INDEX_KEY = `${PREFIX}index`;

function storage(): Storage {
  try {
    const s = window.localStorage;
    if (!s) throw new Error("localStorage unavailable");
    return s;
  } catch (error) {
    throw new StorageError("blocked", `Browser storage is unavailable: ${(error as Error).message}`);
  }
}

function toStorageError(error: unknown): StorageError {
  if (error instanceof StorageError) return error;
  const e = error as { name?: string; code?: number; message?: string };
  if (e?.name === "QuotaExceededError" || e?.name === "NS_ERROR_DOM_QUOTA_REACHED" || e?.code === 22 || e?.code === 1014) {
    return new StorageError("quota", "Browser storage is full.");
  }
  if (e?.name === "SecurityError") return new StorageError("blocked", "Browser storage is blocked.");
  return new StorageError("unknown", e?.message ?? "Storage error");
}

/**
 * Stores each collection as one JSON document under its own key, plus a
 * summary index for the home page. The index is a cache: it is rebuilt by
 * scanning collection keys whenever it is missing or inconsistent.
 */
export class LocalStorageRepository implements CollectionRepository {
  async list(): Promise<CollectionSummary[]> {
    const s = storage();
    const ids = this.collectionIds(s);
    let index: Record<string, CollectionSummary> = {};
    try {
      index = JSON.parse(s.getItem(INDEX_KEY) ?? "{}") as Record<string, CollectionSummary>;
    } catch {
      index = {};
    }
    const consistent = ids.length === Object.keys(index).length && ids.every((id) => index[id]);
    if (!consistent) {
      index = {};
      for (const id of ids) {
        const result = this.read(s, id);
        if (result.status === "ok" || result.status === "newer") index[id] = summarize(result.collection);
        else if (result.status === "corrupt") {
          index[id] = {
            id,
            name: "Unreadable collection",
            description: result.error,
            createdAt: "",
            updatedAt: "",
            stackCount: 0,
            cardCount: 0,
          };
        }
      }
      try {
        s.setItem(INDEX_KEY, JSON.stringify(index));
      } catch {
        /* The index is only a cache. */
      }
    }
    return Object.values(index);
  }

  async get(id: string): Promise<LoadResult> {
    return this.read(storage(), id);
  }

  async save(collection: Collection, opts: { baseRev?: number } = {}): Promise<SaveResult> {
    const s = storage();
    const key = COLLECTION_PREFIX + collection.id;
    let storedRev: number | undefined;
    try {
      const raw = s.getItem(key);
      if (raw) storedRev = (JSON.parse(raw) as { rev?: number }).rev;
    } catch {
      storedRev = undefined;
    }
    const conflict = opts.baseRev !== undefined && storedRev !== undefined && storedRev !== opts.baseRev;
    const rev = Math.max(storedRev ?? 0, opts.baseRev ?? 0, collection.rev) + 1;
    const doc: Collection = { ...collection, rev };
    try {
      s.setItem(key, JSON.stringify(doc));
      this.updateIndex(s, (index) => ({ ...index, [doc.id]: summarize(doc) }));
    } catch (error) {
      throw toStorageError(error);
    }
    return { rev, conflict };
  }

  async delete(id: string): Promise<void> {
    const s = storage();
    try {
      s.removeItem(COLLECTION_PREFIX + id);
      s.removeItem(`srdcards:ui:${id}`);
      this.updateIndex(s, (index) => {
        const next = { ...index };
        delete next[id];
        return next;
      });
    } catch (error) {
      throw toStorageError(error);
    }
  }

  subscribe(listener: (change: { id?: string }) => void): () => void {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null) listener({});
      else if (event.key.startsWith(COLLECTION_PREFIX)) listener({ id: event.key.slice(COLLECTION_PREFIX.length) });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }

  private collectionIds(s: Storage): string[] {
    const ids: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const key = s.key(i);
      if (key?.startsWith(COLLECTION_PREFIX)) ids.push(key.slice(COLLECTION_PREFIX.length));
    }
    return ids;
  }

  private read(s: Storage, id: string): LoadResult {
    const raw = s.getItem(COLLECTION_PREFIX + id);
    if (raw === null) return { status: "missing" };
    try {
      const migrated = migrate(JSON.parse(raw));
      if (migrated.status === "newer") {
        // Best effort: show what we can, read-only.
        const parsed = collectionSchema.safeParse(migrated.data);
        if (parsed.success) return { status: "newer", collection: parsed.data };
        return { status: "corrupt", raw, error: "Saved by a newer version of srd.cards. Reload the page to update." };
      }
      const parsed = collectionSchema.safeParse(migrated.data);
      if (!parsed.success) return { status: "corrupt", raw, error: parsed.error.issues[0]?.message ?? "Invalid data" };
      return { status: "ok", collection: parsed.data };
    } catch (error) {
      return { status: "corrupt", raw, error: (error as Error).message };
    }
  }

  private updateIndex(s: Storage, fn: (index: Record<string, CollectionSummary>) => Record<string, CollectionSummary>) {
    let index: Record<string, CollectionSummary> = {};
    try {
      index = JSON.parse(s.getItem(INDEX_KEY) ?? "{}") as Record<string, CollectionSummary>;
    } catch {
      index = {};
    }
    try {
      s.setItem(INDEX_KEY, JSON.stringify(fn(index)));
    } catch {
      /* The index is only a cache; list() rebuilds it. */
    }
  }
}
