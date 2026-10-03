"use client";

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { createStore, type StoreApi, useStore } from "zustand";
import { apply, type Command } from "@/lib/model/commands";
import type { Collection } from "@/lib/model/schema";
import { getRepository, StorageError } from "@/lib/storage";
import type { StorageErrorKind } from "@/lib/storage/repository";
import { type CollectionUiState, readCollectionUi, writeCollectionUi } from "@/lib/storage/ui-state";

export type CollectionStatus = "loading" | "ready" | "missing" | "readonly" | "error";

export interface CollectionState {
  id: string;
  status: CollectionStatus;
  collection: Collection | null;
  error?: string;
  /** Raw stored text when the collection failed validation (offered as a download). */
  corruptRaw?: string;
  past: Collection[];
  future: Collection[];
  saveState: "saved" | "pending" | "saving" | "error";
  /** Persistent storage problem: show a banner until the user exports. */
  storageProblem?: StorageErrorKind;
  ui: CollectionUiState;

  load(): Promise<void>;
  /** Applies a command. `coalesce` merges rapid edits into one undo step; `history: false` skips undo. */
  dispatch(cmd: Command, opts?: { coalesce?: string; history?: boolean }): void;
  undo(): void;
  redo(): void;
  flush(): Promise<void>;
  toggleExpanded(cardId: string, expanded?: boolean): void;
  setExpandedMany(cardIds: string[], expanded: boolean): void;
  setUi(patch: Partial<CollectionUiState>): void;
}

const HISTORY_LIMIT = 100;
const SAVE_DEBOUNCE_MS = 250;
const SAVE_MAX_WAIT_MS = 1000;
const COALESCE_MS = 2000;

export function createCollectionStore(id: string): StoreApi<CollectionState> & { connect(): () => void } {
  const repo = getRepository();
  /** The document as last loaded/saved; a save is needed when the current one differs. */
  let saved: Collection | null = null;
  let baseRev = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let firstPendingAt: number | undefined;
  let saving: Promise<void> | undefined;
  let lastCoalesce: { key: string; at: number } | undefined;

  const store = createStore<CollectionState>()((set, get) => {
    const persistUi = (ui: CollectionUiState) => writeCollectionUi(id, ui);

    const save = async (): Promise<void> => {
      if (saving) await saving;
      const { status, collection } = get();
      if (status !== "ready" || !collection || collection === saved) {
        if (collection === saved) set({ saveState: "saved" });
        return;
      }
      set({ saveState: "saving" });
      const doc = collection;
      saving = (async () => {
        try {
          const result = await repo.save({ ...doc, rev: baseRev }, { baseRev });
          baseRev = result.rev;
          saved = doc;
          set({ saveState: get().collection === doc ? "saved" : "pending", storageProblem: undefined });
          if (result.conflict) {
            toast.warning("This collection was also changed in another tab. Your latest changes were kept.");
          }
        } catch (error) {
          const kind = error instanceof StorageError ? error.kind : "unknown";
          set({ saveState: "error", storageProblem: kind });
        }
      })();
      await saving;
      saving = undefined;
      if (get().collection !== saved && get().status === "ready") schedule();
    };

    const schedule = () => {
      const now = Date.now();
      firstPendingAt ??= now;
      if (timer) clearTimeout(timer);
      const wait = Math.max(0, Math.min(SAVE_DEBOUNCE_MS, SAVE_MAX_WAIT_MS - (now - firstPendingAt)));
      timer = setTimeout(() => {
        timer = undefined;
        firstPendingAt = undefined;
        void save();
      }, wait);
      set({ saveState: "pending" });
    };

    const setCollection = (next: Collection, history: { past: Collection[]; future: Collection[] }) => {
      set({ collection: next, ...history });
      schedule();
    };

    return {
      id,
      status: "loading",
      collection: null,
      past: [],
      future: [],
      saveState: "saved",
      ui: { expanded: [], browserOpen: true },

      async load() {
        try {
          const result = await repo.get(id);
          const ui = readCollectionUi(id);
          if (result.status === "ok" || result.status === "newer") {
            const ids = new Set(result.collection.stacks.flatMap((s) => s.cards.map((c) => c.id)));
            const pruned = { ...ui, expanded: ui.expanded.filter((x) => ids.has(x)) };
            saved = result.collection;
            baseRev = result.collection.rev;
            set({
              status: result.status === "ok" ? "ready" : "readonly",
              collection: result.collection,
              ui: pruned,
              error: undefined,
              corruptRaw: undefined,
            });
          } else if (result.status === "missing") {
            set({ status: "missing", collection: null });
          } else {
            set({ status: "error", error: result.error, corruptRaw: result.raw, collection: null });
          }
        } catch (error) {
          set({ status: "error", error: (error as Error).message, collection: null });
        }
      },

      dispatch(cmd, opts) {
        const { status, collection, past } = get();
        if (status !== "ready" || !collection) return;
        const applied = apply(collection, cmd);
        if (applied === collection) return;
        const next = { ...applied, updatedAt: new Date().toISOString() };
        const now = Date.now();
        const coalesce = opts?.coalesce && lastCoalesce?.key === opts.coalesce && now - lastCoalesce.at < COALESCE_MS;
        lastCoalesce = opts?.coalesce ? { key: opts.coalesce, at: now } : undefined;
        if (opts?.history === false) {
          setCollection(next, { past, future: get().future });
          return;
        }
        setCollection(next, {
          past: coalesce ? past : [...past, collection].slice(-HISTORY_LIMIT),
          future: [],
        });
      },

      undo() {
        const { status, collection, past, future } = get();
        if (status !== "ready" || !collection || !past.length) return;
        lastCoalesce = undefined;
        setCollection(past[past.length - 1], { past: past.slice(0, -1), future: [collection, ...future] });
      },

      redo() {
        const { status, collection, past, future } = get();
        if (status !== "ready" || !collection || !future.length) return;
        lastCoalesce = undefined;
        setCollection(future[0], { past: [...past, collection], future: future.slice(1) });
      },

      async flush() {
        if (timer) {
          clearTimeout(timer);
          timer = undefined;
          firstPendingAt = undefined;
        }
        await save();
      },

      toggleExpanded(cardId, expanded) {
        const ui = get().ui;
        const isOpen = ui.expanded.includes(cardId);
        const open = expanded ?? !isOpen;
        if (open === isOpen) return;
        const next = { ...ui, expanded: open ? [...ui.expanded, cardId] : ui.expanded.filter((x) => x !== cardId) };
        set({ ui: next });
        persistUi(next);
      },

      setExpandedMany(cardIds, expanded) {
        const ui = get().ui;
        const set_ = new Set(ui.expanded);
        for (const cardId of cardIds) {
          if (expanded) set_.add(cardId);
          else set_.delete(cardId);
        }
        const next = { ...ui, expanded: [...set_] };
        set({ ui: next });
        persistUi(next);
      },

      setUi(patch) {
        const next = { ...get().ui, ...patch };
        set({ ui: next });
        persistUi(next);
      },
    };
  });

  return {
    ...store,
    /** Starts listening for changes from other tabs; returns a disconnect function. */
    connect() {
      // Another tab saved this collection: reload quietly if we have nothing unsaved.
      const unsubscribe = repo.subscribe((change) => {
        if (change.id && change.id !== id) return;
        const { collection, status } = store.getState();
        if (status === "ready" && collection === saved && !timer && !saving) void store.getState().load();
      });
      return () => {
        unsubscribe();
        if (timer) clearTimeout(timer);
        timer = undefined;
        firstPendingAt = undefined;
      };
    },
  };
}

const CollectionStoreContext = createContext<StoreApi<CollectionState> | null>(null);

export function CollectionStoreProvider({ id, children }: { id: string; children: ReactNode }) {
  const [store] = useState(() => createCollectionStore(id));

  useEffect(() => {
    const disconnect = store.connect();
    void store.getState().load();
    const flush = () => void store.getState().flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      // Client-side navigation doesn't fire pagehide: flush on unmount.
      flush();
      disconnect();
    };
  }, [store]);

  return <CollectionStoreContext.Provider value={store}>{children}</CollectionStoreContext.Provider>;
}

export function useCollectionStore<T>(selector: (state: CollectionState) => T): T {
  const store = useContext(CollectionStoreContext);
  if (!store) throw new Error("useCollectionStore must be used inside CollectionStoreProvider");
  return useStore(store, selector);
}

export function useCollectionStoreApi(): StoreApi<CollectionState> {
  const store = useContext(CollectionStoreContext);
  if (!store) throw new Error("useCollectionStoreApi must be used inside CollectionStoreProvider");
  return store;
}
