"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { Highlight, termsNotIn } from "@/components/cards/highlight";
import { TypeChip } from "@/components/cards/type-icon";
import { Input } from "@/components/ui/input";
import { referenceHref } from "@/lib/srd/card-types";
import {
  FILTERS,
  type FilterState,
  matchesFilterState,
} from "@/lib/srd/filters";
import { queryTerms } from "@/lib/srd/match";
import type { IndexEntry, SrdType } from "@/lib/srd/schema";
import { createSearch } from "@/lib/srd/search";
import { FilterBar } from "./filter-bar";

const ROW_HEIGHT = 52;

/** Searchable, filterable, virtualized list of one SRD type. */
export function ReferenceList({
  type,
  entries,
}: {
  type: SrdType;
  entries: IndexEntry[];
}) {
  // TanStack Virtual returns functions the React Compiler can't memoize safely.
  "use no memo";
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({});
  const deferredQuery = useDeferredValue(query);
  const terms = useMemo(() => queryTerms(deferredQuery), [deferredQuery]);
  const search = useMemo(() => createSearch(entries), [entries]);
  const defs = FILTERS[type];
  const results = useMemo(
    () =>
      search
        .search(deferredQuery)
        .filter((e) => matchesFilterState(e, defs, filters)),
    [search, deferredQuery, defs, filters],
  );

  const virtualizer = useWindowVirtualizer({
    count: results.length,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  return (
    <div className="space-y-3">
      <div className="sticky top-14 z-10 -mx-1 space-y-2 bg-background/95 px-1 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-sm">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name…"
              className="pl-8"
              aria-label="Search"
            />
          </div>
          <FilterBar
            defs={defs}
            entries={entries}
            state={filters}
            onChange={setFilters}
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
      ) : (
        <div
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const entry = results[item.index];
            return (
              <Link
                key={entry.id}
                href={referenceHref(entry.type, entry.slug)}
                className="absolute inset-x-0 flex items-center gap-3 rounded-md border-b border-border/50 px-2 hover:bg-muted/60"
                style={{
                  height: ROW_HEIGHT,
                  transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)`,
                }}
              >
                <TypeChip kind={entry.type} />
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
          })}
        </div>
      )}
    </div>
  );
}
