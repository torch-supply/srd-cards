"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef } from "react";
import { Highlight, termsNotIn } from "@/components/cards/highlight";
import { TypeChip, TypeIconSymbols } from "@/components/cards/type-icon";
import { SearchInput } from "@/components/ui/search-input";
import { referenceHref } from "@/lib/srd/card-types";
import {
  FILTERS,
  type FilterState,
  matchesFilterState,
} from "@/lib/srd/filters";
import { queryTerms } from "@/lib/srd/match";
import type { IndexEntry, SrdType } from "@/lib/srd/schema";
import { createSearch } from "@/lib/srd/search";
import { setUrlSearch, useUrlSearch } from "@/lib/url-search";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";
import { FilterBar } from "./filter-bar";

const ROW_HEIGHT = 52;

/**
 * Searchable, filterable, virtualized list of one SRD type. The server renders
 * every row as a plain list (the virtualizer needs the window to measure), so
 * the HTML links to each entry; it switches to the virtual list once hydrated.
 */
export function ReferenceList({
  type,
  entries,
}: {
  type: SrdType;
  entries: IndexEntry[];
}) {
  // TanStack Virtual returns functions the React Compiler can't memoize safely.
  "use no memo";
  const defs = FILTERS[type];
  // Search and filters live in the URL (?q=…&level=…) so they survive going
  // back from a detail page and can be shared.
  const urlSearch = useUrlSearch();
  const { query, filters } = useMemo(() => {
    const params = new URLSearchParams(urlSearch);
    const filters: FilterState = {};
    for (const def of defs) {
      const value = params.get(def.key);
      if (value) filters[def.key] = value;
    }
    return { query: params.get("q") ?? "", filters };
  }, [urlSearch, defs]);
  const update = (q: string, f: FilterState, defer = false) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    for (const def of defs) if (f[def.key]) params.set(def.key, f[def.key]);
    setUrlSearch(params, { defer });
  };
  const deferredQuery = useDeferredValue(query);
  const terms = useMemo(() => queryTerms(deferredQuery), [deferredQuery]);
  const search = useMemo(() => createSearch(entries), [entries]);
  const results = useMemo(
    () =>
      search
        .search(deferredQuery)
        .filter((e) => matchesFilterState(e, defs, filters)),
    [search, deferredQuery, defs, filters],
  );

  // "/" focuses the search box.
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (e.key !== "/" || typing || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hydrated = useHydrated();
  const virtualizer = useWindowVirtualizer({
    count: results.length,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  return (
    <div className="space-y-3">
      <TypeIconSymbols kinds={[type]} />
      <div className="sticky top-14 z-10 -mx-1 space-y-2 bg-background/95 px-1 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            ref={searchRef}
            value={query}
            onValueChange={(q) => update(q, filters, true)}
            onClear={() => update("", filters)}
            placeholder="Search by name…  ( / )"
            aria-label="Search"
            className="w-full max-w-sm"
          />
          <FilterBar
            type={type}
            defs={defs}
            entries={entries}
            state={filters}
            onChange={(f) => update(query, f)}
          />
          <span className="ml-auto text-sm text-muted-foreground tabular-nums">
            {results.length} of {entries.length}
          </span>
        </div>
      </div>

      {results.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Nothing matches. Try a different search or clear the filters.
        </p>
      ) : !hydrated ? (
        <div className="w-full">
          {results.map((entry) => (
            <Row key={entry.id} entry={entry} terms={terms} />
          ))}
        </div>
      ) : (
        <div
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((item) => (
            <Row
              key={results[item.index].id}
              entry={results[item.index]}
              terms={terms}
              className="absolute inset-x-0"
              style={{
                transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({
  entry,
  terms,
  className,
  style,
}: {
  entry: IndexEntry;
  terms: string[];
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Link
      href={referenceHref(entry.type, entry.slug)}
      className={cn(
        "flex items-center gap-3 rounded-md border-b border-border/50 px-2 hover:bg-muted/60",
        className,
      )}
      style={{ height: ROW_HEIGHT, ...style }}
    >
      <TypeChip kind={entry.type} shared />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-serif text-[1.05rem] font-semibold leading-tight">
          <Highlight text={entry.name} terms={terms} />
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          <Highlight
            text={entry.subtitle}
            terms={termsNotIn(entry.name, terms)}
            wordStart
          />
        </span>
      </span>
    </Link>
  );
}
