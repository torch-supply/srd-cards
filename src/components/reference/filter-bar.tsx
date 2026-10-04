"use client";

import { XIcon } from "lucide-react";
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
import type { IndexEntry } from "@/lib/srd/schema";
import { cn } from "@/lib/utils";

const ANY = "__any";

export function FilterBar({
  defs,
  entries,
  state,
  onChange,
  className,
}: {
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
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {defs.map((def) => {
        if (def.kind === "toggle") {
          return (
            <Toggle
              key={def.key}
              size="sm"
              variant="outline"
              pressed={state[def.key] === "true"}
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
              className={cn("min-w-28", state[def.key] && "border-primary/50")}
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
