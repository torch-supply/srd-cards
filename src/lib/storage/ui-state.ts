/**
 * Per-viewer view preferences (expanded cards, panel visibility, sort order).
 * Kept separate from collection data and never required: every read and
 * write tolerates blocked storage.
 */

export interface CollectionUiState {
  expanded: string[];
  browserOpen: boolean;
  lastStackId?: string;
}

export interface GlobalUiState {
  homeSort: "name-asc" | "name-desc" | "created-desc" | "created-asc";
}

const GLOBAL_KEY = "srdcards:ui";
const collectionKey = (id: string) => `srdcards:ui:${id}`;

function read<T>(key: string): Partial<T> {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "{}") as Partial<T>;
  } catch {
    return {};
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* View preferences are optional. */
  }
}

export function readCollectionUi(id: string): CollectionUiState {
  const s = read<CollectionUiState>(collectionKey(id));
  return {
    expanded: Array.isArray(s.expanded) ? s.expanded.filter((x) => typeof x === "string") : [],
    browserOpen: s.browserOpen ?? true,
    lastStackId: typeof s.lastStackId === "string" ? s.lastStackId : undefined,
  };
}

export function writeCollectionUi(id: string, state: CollectionUiState) {
  write(collectionKey(id), state);
}

export function readGlobalUi(): GlobalUiState {
  const s = read<GlobalUiState>(GLOBAL_KEY);
  const sorts: GlobalUiState["homeSort"][] = ["name-asc", "name-desc", "created-desc", "created-asc"];
  return { homeSort: sorts.includes(s.homeSort as GlobalUiState["homeSort"]) ? s.homeSort! : "created-desc" };
}

export function writeGlobalUi(state: GlobalUiState) {
  write(GLOBAL_KEY, state);
}
