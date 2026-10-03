"use client";

import {
  ArrowDownAZIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  LayersIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadJson, exportCollections, exportFileName, parseImport } from "@/lib/export";
import { apply, createCollection } from "@/lib/model/commands";
import type { CollectionSummary } from "@/lib/model/core";
import type { Collection } from "@/lib/model/schema";
import { loadIndex } from "@/lib/srd/client";
import { getRepository } from "@/lib/storage";
import type { GlobalUiState } from "@/lib/storage/ui-state";
import { useCollectionsList, useCollectionsListSync } from "@/stores/collections-list";
import { CollectionDialog } from "./collection-dialog";
import { ConfirmDialog } from "./confirm-dialog";

const SORTS: { value: GlobalUiState["homeSort"]; label: string }[] = [
  { value: "created-desc", label: "Newest first" },
  { value: "created-asc", label: "Oldest first" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
];

function sortList(list: CollectionSummary[], sort: GlobalUiState["homeSort"]) {
  const byName = (a: CollectionSummary, b: CollectionSummary) => a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  const byCreated = (a: CollectionSummary, b: CollectionSummary) => a.createdAt.localeCompare(b.createdAt);
  const sorted = [...list];
  switch (sort) {
    case "name-asc":
      return sorted.sort(byName);
    case "name-desc":
      return sorted.sort((a, b) => byName(b, a));
    case "created-asc":
      return sorted.sort(byCreated);
    case "created-desc":
      return sorted.sort((a, b) => byCreated(b, a));
  }
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export function CollectionsHome() {
  useCollectionsListSync();
  const router = useRouter();
  const { status, list, refresh, sort, setSort } = useCollectionsList();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CollectionSummary | null>(null);
  const [deleting, setDeleting] = useState<CollectionSummary | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const sorted = useMemo(() => sortList(list, sort), [list, sort]);

  const create = async ({ name, description }: { name: string; description: string }) => {
    const c = apply(createCollection({ name, description }), { type: "addStack", stackId: crypto.randomUUID(), name: "Stack 1" });
    try {
      await getRepository().save(c);
      setCreating(false);
      router.push(`/collections/${c.id}`);
    } catch (error) {
      toast.error(`Couldn't create the collection: ${(error as Error).message}`);
    }
  };

  const rename = async (summary: CollectionSummary, values: { name: string; description: string }) => {
    const repo = getRepository();
    const result = await repo.get(summary.id);
    if (result.status !== "ok") {
      toast.error("That collection can't be edited right now.");
      return;
    }
    const updated = apply(result.collection, { type: "updateCollection", ...values });
    await repo.save({ ...updated, updatedAt: new Date().toISOString() }, { baseRev: result.collection.rev });
    setEditing(null);
    void refresh();
  };

  const exportOne = async (summary: CollectionSummary) => {
    const result = await getRepository().get(summary.id);
    if (result.status !== "ok" && result.status !== "newer") {
      toast.error("That collection can't be exported.");
      return;
    }
    downloadJson(exportFileName([result.collection]), exportCollections([result.collection]));
  };

  const exportAll = async () => {
    const repo = getRepository();
    const collections: Collection[] = [];
    for (const s of list) {
      const result = await repo.get(s.id);
      if (result.status === "ok" || result.status === "newer") collections.push(result.collection);
    }
    downloadJson(exportFileName(collections), exportCollections(collections));
  };

  const remove = async (summary: CollectionSummary) => {
    await getRepository().delete(summary.id);
    setDeleting(null);
    toast.success(`Deleted ${summary.name}`);
    void refresh();
  };

  const importFile = async (file: File) => {
    try {
      const index = await loadIndex().catch(() => undefined);
      const { collections, unknownRefs } = parseImport(await file.text(), {
        knownRefs: index ? new Set(index.map((e) => e.id)) : undefined,
      });
      const repo = getRepository();
      for (const c of collections) await repo.save(c);
      toast.success(`Imported ${collections.length} collection${collections.length === 1 ? "" : "s"}`, {
        description: unknownRefs.length ? `${unknownRefs.length} card(s) reference unknown SRD entries.` : undefined,
      });
      void refresh();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-serif text-2xl font-semibold tracking-tight">Your collections</h2>
        <Select value={sort} onValueChange={(v) => setSort(v as GlobalUiState["homeSort"])}>
          <SelectTrigger className="w-40" aria-label="Sort collections">
            <ArrowDownAZIcon />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" aria-label="Import or export">
              <UploadIcon /> Import / Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
              <UploadIcon /> Import from file…
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!list.length} onSelect={() => void exportAll()}>
              <DownloadIcon /> Export all collections
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void importFile(file);
          }}
        />
        <Button onClick={() => setCreating(true)}>
          <PlusIcon /> New collection
        </Button>
      </div>

      {status === "loading" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : status === "error" ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          Browser storage is unavailable, so collections can’t be saved. Check that cookies and site data are allowed for this site.
        </p>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center">
          <LayersIcon className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">No collections yet</p>
            <p className="text-sm text-muted-foreground">
              Create one for a campaign or an encounter, then fill its stacks with cards.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setCreating(true)}>
              <PlusIcon /> New collection
            </Button>
            <Button variant="outline" asChild>
              <Link href="/spells">Browse the SRD</Link>
            </Button>
          </div>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((c) => (
            <li key={c.id} className="group relative rounded-xl border bg-card transition-colors hover:border-foreground/20">
              <Link href={`/collections/${c.id}`} className="block h-full rounded-xl p-4 pr-12">
                <h3 className="truncate font-serif text-lg font-semibold">{c.name}</h3>
                <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted-foreground">
                  {c.description || <span className="italic opacity-70">No description</span>}
                </p>
                <p className="mt-3 text-xs text-muted-foreground tabular-nums">
                  {c.stackCount} {c.stackCount === 1 ? "stack" : "stacks"} · {c.cardCount} {c.cardCount === 1 ? "card" : "cards"}
                  {c.createdAt && <> · Created {dateFormat.format(new Date(c.createdAt))}</>}
                </p>
              </Link>
              <div className="absolute top-3 right-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.name}`}>
                      <EllipsisVerticalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing(c)}>
                      <PencilIcon /> Rename…
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void exportOne(c)}>
                      <DownloadIcon /> Export JSON
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(c)}>
                      <Trash2Icon /> Delete…
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CollectionDialog open={creating} onOpenChange={setCreating} title="New collection" submitLabel="Create" onSubmit={create} />
      <CollectionDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Edit collection"
        submitLabel="Save"
        initial={editing ? { name: editing.name, description: editing.description } : undefined}
        onSubmit={async (values) => {
          if (editing) await rename(editing, values);
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "collection"}?`}
        description="This permanently removes the collection and all of its stacks and cards from this browser. Export it first if you want a backup."
        onConfirm={() => deleting && void remove(deleting)}
      />
    </section>
  );
}
