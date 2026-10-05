"use client";

import { useSyncExternalStore } from "react";

/*
 * The URL's query string as client state, so list views survive a round trip
 * to a detail page and can be shared. Writes use `history.replaceState`, which
 * Next keeps its router in sync with (no server request, no new history entry).
 * Browsers throttle `replaceState`, so typing defers the write; the pending
 * value is the snapshot meanwhile, and any click flushes it before a link
 * navigates away.
 */

let draft: { path: string; search: string } | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

function onPopState() {
  // The draft belonged to the entry we just left.
  clearTimeout(timer);
  draft = undefined;
  notify();
}

function subscribe(listener: () => void) {
  if (!listeners.size) {
    window.addEventListener("popstate", onPopState);
    // Capture phase: runs before Next's <Link> handler pushes the next entry.
    document.addEventListener("click", flushUrlSearch, true);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    window.removeEventListener("popstate", onPopState);
    document.removeEventListener("click", flushUrlSearch, true);
    flushUrlSearch();
  };
}

function getSnapshot() {
  return draft?.path === location.pathname ? draft.search : location.search;
}

/** Writes a deferred `setUrlSearch` now. */
export function flushUrlSearch() {
  clearTimeout(timer);
  if (!draft) return;
  const { path, search } = draft;
  draft = undefined;
  if (path === location.pathname && search !== location.search)
    history.replaceState(null, "", path + search + location.hash);
}

/** Replaces the current URL's query string; `defer` batches rapid updates. */
export function setUrlSearch(params: URLSearchParams, { defer = false } = {}) {
  const query = params.toString();
  draft = { path: location.pathname, search: query && `?${query}` };
  clearTimeout(timer);
  if (defer) timer = setTimeout(flushUrlSearch, 400);
  else flushUrlSearch();
  notify();
}

/** The current query string (with its "?"); empty during SSR and hydration. */
export function useUrlSearch(): string {
  return useSyncExternalStore(subscribe, getSnapshot, () => "");
}
