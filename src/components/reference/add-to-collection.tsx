"use client";

import {
  ArrowLeftIcon,
  FolderPlusIcon,
  LayersIcon,
  PlusIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { EntryRef, StackTarget } from "@/lib/model/actions";
import type { CollectionSummary } from "@/lib/model/core";
import type { Collection } from "@/lib/model/schema";

/** Storage and validation code loads only when the popover is used. */
const loadActions = () => import("@/lib/model/actions");
const loadStorage = () => import("@/lib/storage");

type Step =
  | { kind: "collections"; list: CollectionSummary[] | null }
  | { kind: "stacks"; collection: Collection };

export function AddToCollectionButton({ entry }: { entry: EntryRef }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>({ kind: "collections", list: null });
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const loadCollections = async () => {
    setStep({ kind: "collections", list: null });
    try {
      const list = await (await loadStorage()).getRepository().list();
      setStep({
        kind: "collections",
        list: list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      });
    } catch {
      setStep({ kind: "collections", list: [] });
    }
  };

  const chooseCollection = async (id: string) => {
    const result = await (await loadStorage()).getRepository().get(id);
    if (result.status !== "ok") {
      toast.error("That collection can't be edited right now.");
      return;
    }
    setNewName("");
    setStep({ kind: "stacks", collection: result.collection });
  };

  const add = async (collection: Collection, target: StackTarget) => {
    setBusy(true);
    try {
      const { addEntryToCollection } = await loadActions();
      const { collection: updated, stackId } = await addEntryToCollection(
        collection.id,
        target,
        entry,
      );
      const stack = updated.stacks.find((s) => s.id === stackId);
      toast.success(
        `Added ${entry.name} to ${updated.name} › ${stack?.name ?? "stack"}`,
        {
          action: {
            label: "Open",
            onClick: () => router.push(`/collections/${updated.id}`),
          },
        },
      );
      setOpen(false);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const createNew = async () => {
    setBusy(true);
    try {
      const { createCollectionWithEntry } = await loadActions();
      const c = await createCollectionWithEntry(
        newName.trim() || "New collection",
        entry,
      );
      toast.success(`Created ${c.name} with ${entry.name}`, {
        action: {
          label: "Open",
          onClick: () => router.push(`/collections/${c.id}`),
        },
      });
      setOpen(false);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) void loadCollections();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline">
          <PlusIcon /> Add to collection
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        {step.kind === "collections" ? (
          <div className="space-y-1">
            <p className="px-2 pt-1 pb-1.5 text-xs font-medium text-muted-foreground">
              Add {entry.name} to…
            </p>
            {step.list === null && (
              <p className="px-2 py-2 text-sm text-muted-foreground">
                Loading…
              </p>
            )}
            {step.list?.map((c) => (
              <button
                key={c.id}
                onClick={() => void chooseCollection(c.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <LayersIcon className="size-4 text-muted-foreground" />
                <span className="truncate">{c.name}</span>
              </button>
            ))}
            <form
              className="flex gap-1.5 border-t pt-2"
              onSubmit={(e) => {
                e.preventDefault();
                void createNew();
              }}
            >
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New collection"
                className="h-8"
              />
              <Button
                type="submit"
                size="icon"
                disabled={busy}
                aria-label="Create collection"
              >
                <FolderPlusIcon />
              </Button>
            </form>
          </div>
        ) : (
          <div className="space-y-1">
            <button
              onClick={() => void loadCollections()}
              className="flex items-center gap-1 px-2 pt-1 pb-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeftIcon className="size-3" /> {step.collection.name}
            </button>
            {step.collection.stacks.map((s) => (
              <button
                key={s.id}
                disabled={busy}
                onClick={() => void add(step.collection, { stackId: s.id })}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <span className="truncate">{s.name || "Untitled stack"}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {s.cards.length}
                </span>
              </button>
            ))}
            {step.collection.stacks.length === 0 && (
              <p className="px-2 py-1 text-sm text-muted-foreground">
                No stacks yet. Create one:
              </p>
            )}
            <form
              className="flex gap-1.5 border-t pt-2"
              onSubmit={(e) => {
                e.preventDefault();
                void add(step.collection, { newStackName: newName });
              }}
            >
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New stack"
                className="h-8"
              />
              <Button
                type="submit"
                size="icon"
                disabled={busy}
                aria-label="Create stack"
              >
                <PlusIcon />
              </Button>
            </form>
            <Link
              href={`/collections/${step.collection.id}`}
              className="block px-2 pt-1 text-xs text-muted-foreground hover:underline"
            >
              Open collection
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
