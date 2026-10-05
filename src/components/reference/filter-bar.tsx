"use client";

import { XIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import {
  type FacetFilterDef,
  facetOptions,
  type FilterState,
} from "@/lib/srd/filters";
import type { IndexEntry, SrdType } from "@/lib/srd/schema";
import { cn } from "@/lib/utils";

const ANY = "__any";

/**
 * Active filter: ring + tint in the type's color (`--tc`, set on the bar). The
 * variant-prefixed backgrounds replace Toggle's and SelectTrigger's own.
 */
const ACTIVE =
  "border-(--tc) bg-(--tc)/20 text-foreground ring-1 ring-(--tc) hover:bg-(--tc)/30 aria-pressed:bg-(--tc)/20 data-[state=on]:bg-(--tc)/20 dark:bg-(--tc)/20 dark:hover:bg-(--tc)/30";

export function FilterBar({
  type,
  defs,
  entries,
  state,
  onChange,
  className,
}: {
  type: SrdType;
  defs: FacetFilterDef[];
  entries: IndexEntry[];
  state: FilterState;
  onChange: (state: FilterState) => void;
  className?: string;
}) {
  if (!defs.length) return null;
  const active = Object.values(state).some(Boolean);
  const set = (key: string, value: string) =>
    onChange({ ...state, [key]: value });
  return (
    <div
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      style={{ "--tc": `var(--type-${type})` } as CSSProperties}
    >
      {defs.map((def) => {
        if (def.kind === "toggle") {
          return (
            <Toggle
              key={def.key}
              size="sm"
              variant="outline"
              pressed={state[def.key] === "true"}
              className={cn(state[def.key] === "true" && ACTIVE)}
              onPressedChange={(p) => set(def.key, p ? "true" : "")}
            >
              {def.label}
            </Toggle>
          );
        }
        const options =
          def.kind === "bucket"
            ? (def.buckets ?? [])
            : facetOptions(def, entries);
        return (
          <Select
            key={def.key}
            value={state[def.key] || ANY}
            onValueChange={(v) => set(def.key, v === ANY ? "" : v)}
          >
            <SelectTrigger
              size="sm"
              className={cn("min-w-28", state[def.key] && ACTIVE)}
              aria-label={def.label}
            >
              <SelectValue placeholder={def.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any {def.label.toLowerCase()}</SelectItem>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      })}
      {active && (
        <Button variant="ghost" size="sm" onClick={() => onChange({})}>
          <XIcon /> Clear
        </Button>
      )}
    </div>
  );
}
