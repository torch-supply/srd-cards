"use client";

import { useEffect } from "react";
import { create } from "zustand";
import type { CollectionSummary } from "@/lib/model/core";
import { getRepository } from "@/lib/storage";
import { type GlobalUiState, readGlobalUi, writeGlobalUi } from "@/lib/storage/ui-state";

interface CollectionsListState {
  status: "loading" | "ready" | "error";
  list: CollectionSummary[];
  error?: string;
  sort: GlobalUiState["homeSort"];
  refresh(): Promise<void>;
  setSort(sort: GlobalUiState["homeSort"]): void;
}

/** Summaries of all stored collections (home page). Starts as "loading" on server and client alike. */
export const useCollectionsList = create<CollectionsListState>()((set) => ({
  status: "loading",
  list: [],
  sort: "created-desc",
  async refresh() {
    try {
      const list = await getRepository().list();
      set({ status: "ready", list, error: undefined, sort: readGlobalUi().homeSort });
    } catch (error) {
      set({ status: "error", error: (error as Error).message });
    }
  },
  setSort(sort) {
    set({ sort });
    writeGlobalUi({ ...readGlobalUi(), homeSort: sort });
  },
}));

/** Loads the list on mount and keeps it in sync with other tabs. */
export function useCollectionsListSync() {
  useEffect(() => {
    void useCollectionsList.getState().refresh();
    return getRepository().subscribe(() => void useCollectionsList.getState().refresh());
  }, []);
}
