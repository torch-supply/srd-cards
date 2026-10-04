"use client";

import { useEffect, useSyncExternalStore } from "react";
import { REFERENCE_TYPES } from "./card-types";
import { loadIndex } from "./client";
import type { IndexEntry } from "./schema";
import type { SrdSearch } from "./search";

export interface SrdIndexState {
  status: "idle" | "loading" | "ready" | "error";
  entries: IndexEntry[];
  byId: Map<string, IndexEntry>;
  search?: SrdSearch;
}

const EMPTY: SrdIndexState = { status: "idle", entries: [], byId: new Map() };

let state: SrdIndexState = EMPTY;
let pending: Promise<void> | undefined;
const listeners = new Set<() => void>();

function set(next: SrdIndexState) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Loads the index and builds the search once per page session. */
export function ensureSrdIndex(): Promise<void> {
  if (state.status === "ready") return Promise.resolve();
  pending ??= (async () => {
    set({ ...state, status: "loading" });
    try {
      // MiniSearch loads with the index, not with the page.
      const [entries, { createSearch }] = await Promise.all([
        loadIndex(),
        import("./search"),
      ]);
      set({
        status: "ready",
        entries,
        byId: new Map(entries.map((e) => [e.id, e])),
        search: createSearch(entries, REFERENCE_TYPES),
      });
    } catch {
      pending = undefined;
      set({ ...EMPTY, status: "error" });
    }
  })();
  return pending;
}

/** The SRD index and its search. Loading starts when `enabled` is true. */
export function useSrdIndex(enabled = true): SrdIndexState {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY,
  );
  useEffect(() => {
    if (enabled) void ensureSrdIndex();
  }, [enabled]);
  return snapshot;
}

/** Starts loading the index when the browser is idle. */
export function preloadSrdIndex() {
  if (state.status !== "idle") return;
  const start = () => void ensureSrdIndex();
  if (typeof window !== "undefined" && "requestIdleCallback" in window)
    window.requestIdleCallback(start, { timeout: 3000 });
  else setTimeout(start, 1500);
}
