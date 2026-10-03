import { LocalStorageRepository } from "./local-storage-repository";
import type { CollectionRepository } from "./repository";

let repository: CollectionRepository | undefined;

/** The single place to swap localStorage for a backend later. */
export function getRepository(): CollectionRepository {
  repository ??= new LocalStorageRepository();
  return repository;
}

export type { CollectionRepository, LoadResult, SaveResult } from "./repository";
export { StorageError } from "./repository";
