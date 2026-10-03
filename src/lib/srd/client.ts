/**
 * Browser-side SRD data: fetched lazily from the content-hashed static files
 * written by `pnpm srd:emit`, cached in memory (and by the browser, forever).
 */
import type { IndexEntry, SrdEntry, SrdType } from "./schema";

/**
 * The data version (content hash) is rendered into <html data-srd-hash> by the
 * root layout: at build time in production, per request in development.
 */
function base() {
  return `/srd/${document.documentElement.dataset.srdHash}`;
}

let indexPromise: Promise<IndexEntry[]> | undefined;
let aliasesPromise: Promise<Record<string, string>> | undefined;
const entryPromises = new Map<string, Promise<SrdEntry>>();

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base()}/${path}`);
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
  return (await res.json()) as T;
}

/** The lightweight index (~1,400 entries). */
export function loadIndex(): Promise<IndexEntry[]> {
  indexPromise ??= fetchJson<IndexEntry[]>("index.json").catch((error: unknown) => {
    indexPromise = undefined;
    throw error;
  });
  return indexPromise;
}

function loadAliases(): Promise<Record<string, string>> {
  aliasesPromise ??= fetchJson<Record<string, string>>("aliases.json").catch(() => ({}));
  return aliasesPromise;
}

export function parseRef(ref: string): { type: SrdType; slug: string } {
  const [type, slug] = ref.split(":");
  return { type: type as SrdType, slug };
}

/** One rendered entry (prose already HTML). Resolves renamed ids through aliases. */
export function loadEntry(ref: string): Promise<SrdEntry> {
  let promise = entryPromises.get(ref);
  if (!promise) {
    const { type, slug } = parseRef(ref);
    promise = fetchJson<SrdEntry>(`${type}/${slug}.json`).catch(async (error: unknown) => {
      const alias = (await loadAliases())[ref];
      if (alias && alias !== ref) return loadEntry(alias);
      entryPromises.delete(ref);
      throw error;
    });
    entryPromises.set(ref, promise);
  }
  return promise;
}

/** Starts loading an entry without waiting (on hover, or for cards already expanded). */
export function prefetchEntry(ref: string) {
  void loadEntry(ref).catch(() => undefined);
}
