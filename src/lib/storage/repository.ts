import type { CollectionSummary } from "@/lib/model/core";
import type { Collection } from "@/lib/model/schema";

export type LoadResult =
  | { status: "ok"; collection: Collection }
  | { status: "missing" }
  /** Stored data failed validation. It is left untouched; `raw` lets the user download it. */
  | { status: "corrupt"; raw: string; error: string }
  /** Written by a newer version of the app. Open read-only; never save over it. */
  | { status: "newer"; collection: Collection };

export interface SaveResult {
  rev: number;
  /** Another tab saved since `baseRev`; this save won (last write wins). */
  conflict: boolean;
}

export type StorageErrorKind = "quota" | "blocked" | "unknown";

export class StorageError extends Error {
  constructor(
    readonly kind: StorageErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

/**
 * Persistence for collections. Async so a backend can replace the
 * localStorage implementation without changing callers.
 */
export interface CollectionRepository {
  list(): Promise<CollectionSummary[]>;
  get(id: string): Promise<LoadResult>;
  /** Saves a whole collection. `baseRev` is the rev the caller last loaded/saved. */
  save(collection: Collection, opts?: { baseRev?: number }): Promise<SaveResult>;
  delete(id: string): Promise<void>;
  /** Notifies about changes made elsewhere (other tabs). `id` is undefined when unknown. */
  subscribe(listener: (change: { id?: string }) => void): () => void;
}
