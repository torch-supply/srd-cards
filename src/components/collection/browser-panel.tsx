"use client";

import { useDraggable } from "@dnd-kit/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDownIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";
import dynamic from "next/dynamic";
import {
  type RefObject,
  Suspense,
  use,
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import { CardHeaderContent } from "@/components/cards/card-header";
import { TypeIcon } from "@/components/cards/type-icon";
import { FilterBar } from "@/components/reference/filter-bar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CARD_TYPES, REFERENCE_TYPES } from "@/lib/srd/card-types";
import { loadEntry, prefetchEntry } from "@/lib/srd/client";
import {
  FILTERS,
  type FilterState,
  matchesFilterState,
} from "@/lib/srd/filters";
import { queryTerms } from "@/lib/srd/match";
import type { IndexEntry, SrdType } from "@/lib/srd/schema";
import { useSrdIndex } from "@/lib/srd/use-srd-index";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "./error-boundary";

const EntryDetail = dynamic(
  () =>
    import("@/components/cards/details/entry-detail").then(
      (m) => m.EntryDetail,
    ),
  {
    loading: () => <Skeleton className="h-24" />,
  },
);

export const BROWSER_WIDTH = 360;

export function BrowserPanel({
  stacks,
  defaultStackId,
  onAdd,
  scrollRef,
  searchRef,
}: {
  stacks: { id: string; name: string }[];
  defaultStackId?: string;
  onAdd: (entry: IndexEntry, stackId?: string) => void;
  /** The results scroller (excluded from drag auto-scroll). */
  scrollRef: RefObject<HTMLDivElement | null>;
  searchRef: RefObject<HTMLInputElement | null>;
}) {
  // TanStack Virtual returns functions the React Compiler can't memoize safely.
  "use no memo";
  const index = useSrdIndex(true);
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<SrdType[]>([]);
  const [filters, setFilters] = useState<FilterState>({});
  const [previewId, setPreviewId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);
  const terms = useMemo(() => queryTerms(deferredQuery), [deferredQuery]);
  const singleType = types.length === 1 ? types[0] : undefined;

  // Results only change with the search inputs, so they stay put while a row is dragged.
  const results = useMemo(() => {
    if (!index.search) return [];
    const found = index.search.search(deferredQuery, { types });
    return singleType
      ? found.filter((e) => matchesFilterState(e, FILTERS[singleType], filters))
      : found;
  }, [index.search, deferredQuery, types, singleType, filters]);

  // eslint-disable-next-line react-hooks/incompatible-library -- handled: this component opts out of the compiler ("use no memo" above)
  const virtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 52,
    overscan: 10,
    getItemKey: (i) => results[i]?.id ?? i,
  });

  return (
    <aside
      className="flex shrink-0 flex-col border-r bg-background"
      style={{ width: BROWSER_WIDTH }}
      aria-label="SRD browser"
    >
      <div className="space-y-2 border-b p-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the SRD…  ( / )"
            aria-label="Search the SRD"
            className="pr-8 pl-8"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>
        <ToggleGroup
          type="multiple"
          value={types}
          onValueChange={(v) => {
            setTypes(v as SrdType[]);
            setFilters({});
          }}
          className="flex flex-wrap justify-start gap-1"
          aria-label="Filter by type"
        >
          {REFERENCE_TYPES.map((t) => (
            <Tooltip key={t}>
              <TooltipTrigger asChild>
                <ToggleGroupItem
                  value={t}
                  size="sm"
                  variant="outline"
                  aria-label={CARD_TYPES[t].plural}
                  className="size-7 px-0"
                >
                  <TypeIcon kind={t} />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>{CARD_TYPES[t].plural}</TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>
        {singleType && FILTERS[singleType].length > 0 && (
          <FilterBar
            defs={FILTERS[singleType]}
            entries={index.entries.filter((e) => e.type === singleType)}
            state={filters}
            onChange={setFilters}
          />
        )}
        <p className="text-xs text-muted-foreground tabular-nums">
          {index.status === "ready"
            ? `${results.length} result${results.length === 1 ? "" : "s"} · drag into a stack or press +`
            : index.status === "error"
              ? "Couldn’t load the SRD index."
              : "Loading the SRD…"}
        </p>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {index.status !== "ready" ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : (
          <div
            className="relative"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((item) => {
              const entry = results[item.index];
              return (
                <div
                  key={item.key}
                  data-index={item.index}
                  ref={virtualizer.measureElement}
                  className="absolute inset-x-0 top-0"
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  <ResultRow
                    entry={entry}
                    terms={terms}
                    stacks={stacks}
                    defaultStackId={defaultStackId}
                    onAdd={onAdd}
                    expanded={previewId === entry.id}
                    onToggle={() =>
                      setPreviewId((id) => (id === entry.id ? null : entry.id))
                    }
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

function ResultRow({
  entry,
  terms,
  stacks,
  defaultStackId,
  onAdd,
  expanded,
  onToggle,
}: {
  entry: IndexEntry;
  terms: string[];
  stacks: { id: string; name: string }[];
  defaultStackId?: string;
  onAdd: (entry: IndexEntry, stackId?: string) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `src:${entry.id}`,
    data: { kind: "source", entry },
  });
  const defaultStack = stacks.find((s) => s.id === defaultStackId) ?? stacks[0];
  return (
    <div
      className={cn("border-b border-border/60", isDragging && "opacity-50")}
    >
      <div className="group/row flex items-center gap-1 py-1.5 pr-1.5 pl-3 hover:bg-muted/50">
        <button
          type="button"
          ref={setNodeRef}
          {...attributes}
          {...listeners}
          onClick={onToggle}
          onPointerEnter={() => prefetchEntry(entry.id)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 cursor-grab items-center rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing"
        >
          <CardHeaderContent
            kind={entry.type}
            name={entry.name}
            subtitle={entry.subtitle}
            highlight={terms}
          />
        </button>
        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Add ${entry.name}${defaultStack ? ` to ${defaultStack.name}` : ""}`}
                onClick={() => onAdd(entry, defaultStack?.id)}
              >
                <PlusIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {defaultStack
                ? `Add to ${defaultStack.name || "stack"}`
                : "Add to a new stack"}
            </TooltipContent>
          </Tooltip>
          {stacks.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Choose a stack for ${entry.name}`}
                  className="w-4 text-muted-foreground"
                >
                  <ChevronDownIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Add to…</DropdownMenuLabel>
                {stacks.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onSelect={() => onAdd(entry, s.id)}
                  >
                    {s.name || "Untitled stack"}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      {expanded && (
        <div className="border-t bg-muted/20 px-3 py-3">
          <ErrorBoundary
            fallback={
              <p className="text-sm text-destructive">
                Couldn’t load this entry.
              </p>
            }
          >
            <Suspense fallback={<Skeleton className="h-24" />}>
              <Preview id={entry.id} />
            </Suspense>
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
}

function Preview({ id }: { id: string }) {
  const entry = use(loadEntry(id));
  return <EntryDetail entry={entry} compact />;
}
