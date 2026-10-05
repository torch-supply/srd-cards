import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False during SSR and hydration, true after: for UI the server can't render (e.g. virtualized lists). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
