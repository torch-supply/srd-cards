"use client";

import {
  ChevronsDownUpIcon,
  CircleAlertIcon,
  CloudCheckIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  LoaderIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  Redo2Icon,
  SquarePenIcon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { downloadJson, exportCollections, exportFileName } from "@/lib/export";
import { newId } from "@/lib/model/core";
import { getRepository } from "@/lib/storage";
import {
  CollectionStoreProvider,
  useCollectionStore,
  useCollectionStoreApi,
} from "@/stores/collection-store";
import { Board } from "./board";

// Dialogs load on first use.
const ConfirmDialog = dynamic(() =>
  import("@/components/collections/confirm-dialog").then(
    (m) => m.ConfirmDialog,
  ),
);
const CustomCardDialog = dynamic(() =>
  import("./custom-card-dialog").then((m) => m.CustomCardDialog),
);
import { InlineEdit } from "./inline-edit";

export function CollectionPage({ id }: { id: string }) {
  return (
    <CollectionStoreProvider id={id}>
      <CollectionView />
    </CollectionStoreProvider>
  );
}

function CollectionView() {
  const status = useCollectionStore((s) => s.status);
  const error = useCollectionStore((s) => s.error);
  const corruptRaw = useCollectionStore((s) => s.corruptRaw);
  const id = useCollectionStore((s) => s.id);

  if (status === "loading") {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-96" />
        <div className="flex gap-3 pt-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-80 w-[340px] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }
  if (status === "missing") {
    return (
      <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="font-serif text-2xl font-semibold">
          Collection not found
        </h1>
        <p className="text-sm text-muted-foreground">
          It may have been deleted, or it was created in a different browser.
          Collections are stored in this browser only.
        </p>
        <Button asChild>
          <Link href="/">Back to collections</Link>
        </Button>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <CircleAlertIcon className="size-8 text-destructive" />
        <h1 className="font-serif text-2xl font-semibold">
          This collection can’t be opened
        </h1>
        <p className="text-sm text-muted-foreground">{error}</p>
        <p className="text-sm text-muted-foreground">
          Your data hasn’t been changed. You can download it as-is, or delete
          it.
        </p>
        <div className="flex gap-2">
          {corruptRaw && (
            <Button
              variant="outline"
              onClick={() =>
                downloadJson(`srd-cards-unreadable-${id}.json`, corruptRaw)
              }
            >
              <DownloadIcon /> Download raw data
            </Button>
          )}
          <Button asChild>
            <Link href="/">Back to collections</Link>
          </Button>
        </div>
      </div>
    );
  }
  return <ReadyView />;
}

function ReadyView() {
  const router = useRouter();
  const store = useCollectionStoreApi();
  const collection = useCollectionStore((s) => s.collection)!;
  const status = useCollectionStore((s) => s.status);
  const dispatch = useCollectionStore((s) => s.dispatch);
  const undo = useCollectionStore((s) => s.undo);
  const redo = useCollectionStore((s) => s.redo);
  const canUndo = useCollectionStore((s) => s.past.length > 0);
  const canRedo = useCollectionStore((s) => s.future.length > 0);
  const saveState = useCollectionStore((s) => s.saveState);
  const storageProblem = useCollectionStore((s) => s.storageProblem);
  const browserOpen = useCollectionStore((s) => s.ui.browserOpen);
  const lastStackId = useCollectionStore((s) => s.ui.lastStackId);
  const setUi = useCollectionStore((s) => s.setUi);
  const setExpandedMany = useCollectionStore((s) => s.setExpandedMany);
  const readOnly = status === "readonly";
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [addingCustom, setAddingCustom] = useState(false);

  // Keyboard shortcuts: undo/redo, "/" to search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !typing && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) store.getState().redo();
        else store.getState().undo();
      } else if (mod && !typing && e.key.toLowerCase() === "y") {
        e.preventDefault();
        store.getState().redo();
      } else if (e.key === "/" && !typing && !mod) {
        e.preventDefault();
        store.getState().setUi({ browserOpen: true });
        requestAnimationFrame(() => searchRef.current?.focus());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store]);

  useEffect(() => {
    document.title = `${collection.name} · srd.cards`;
  }, [collection.name]);

  const exportJson = async () => {
    await store.getState().flush();
    downloadJson(exportFileName([collection]), exportCollections([collection]));
  };

  const remove = async () => {
    await getRepository().delete(collection.id);
    toast.success(`Deleted ${collection.name}`);
    router.push("/");
  };

  const allCardIds = collection.stacks.flatMap((s) => s.cards.map((c) => c.id));
  const defaultStackId = collection.stacks.some((s) => s.id === lastStackId)
    ? lastStackId
    : collection.stacks[0]?.id;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-[480px] flex-col">
      {readOnly && (
        <div className="border-b bg-amber-500/10 px-6 py-2 text-sm">
          This collection was saved by a newer version of srd.cards, so it’s
          read-only here. Reload the page to update.
        </div>
      )}
      {storageProblem && (
        <div className="flex items-center gap-2 border-b bg-destructive/10 px-6 py-2 text-sm">
          <CircleAlertIcon className="size-4 text-destructive" />
          {storageProblem === "quota"
            ? "Browser storage is full, so recent changes aren’t saved."
            : "Browser storage is unavailable, so changes aren’t saved."}{" "}
          Export a backup to keep your work.
          <Button
            size="xs"
            variant="outline"
            className="ml-auto"
            onClick={() => void exportJson()}
          >
            <DownloadIcon /> Export JSON
          </Button>
        </div>
      )}

      <header className="flex shrink-0 items-start gap-4 border-b px-6 py-3">
        <div className="min-w-0 flex-1">
          <InlineEdit
            value={collection.name}
            ariaLabel="Collection name"
            maxLength={200}
            disabled={readOnly}
            onSave={(name) => dispatch({ type: "updateCollection", name })}
            className="font-serif text-2xl leading-tight font-semibold tracking-tight"
          />
          <InlineEdit
            value={collection.description}
            placeholder="Add a description"
            ariaLabel="Collection description"
            multiline
            maxLength={5000}
            disabled={readOnly}
            onSave={(description) =>
              dispatch({
                type: "updateCollection",
                description: description.trim(),
              })
            }
            className="mt-0.5 line-clamp-2 text-sm text-muted-foreground"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1 pt-1">
          <SaveIndicator state={saveState} />
          <ToolbarButton
            label="Undo (⌘Z)"
            disabled={!canUndo || readOnly}
            onClick={undo}
          >
            <Undo2Icon />
          </ToolbarButton>
          <ToolbarButton
            label="Redo (⇧⌘Z)"
            disabled={!canRedo || readOnly}
            onClick={redo}
          >
            <Redo2Icon />
          </ToolbarButton>
          <ToolbarButton
            label="Collapse all cards"
            onClick={() => setExpandedMany(allCardIds, false)}
          >
            <ChevronsDownUpIcon />
          </ToolbarButton>
          {!readOnly && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddingCustom(true)}
              >
                <SquarePenIcon /> Custom card
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUi({ browserOpen: !browserOpen })}
                aria-pressed={browserOpen}
              >
                {browserOpen ? <PanelLeftCloseIcon /> : <PanelLeftOpenIcon />}{" "}
                Browser
              </Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Collection actions"
              >
                <EllipsisVerticalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void exportJson()}>
                <DownloadIcon /> Export JSON
              </DropdownMenuItem>
              {!readOnly && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setDeleting(true)}
                  >
                    <Trash2Icon /> Delete collection…
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Board
        collection={collection}
        readOnly={readOnly}
        browserOpen={browserOpen}
        searchRef={searchRef}
      />

      {deleting && (
        <ConfirmDialog
          open={deleting}
          onOpenChange={setDeleting}
          title={`Delete ${collection.name}?`}
          description="This permanently removes the collection and all of its stacks and cards from this browser. Export it first if you want a backup."
          onConfirm={() => void remove()}
        />
      )}
      {addingCustom && (
        <CustomCardDialog
          open={addingCustom}
          onOpenChange={setAddingCustom}
          stacks={collection.stacks.map((s) => ({ id: s.id, name: s.name }))}
          defaultStackId={defaultStackId}
          onSubmit={(custom, stackId) => {
            let target = stackId;
            if (!target) {
              target = newId();
              dispatch({ type: "addStack", stackId: target, name: "Stack 1" });
            }
            const cardId = newId();
            dispatch({
              type: "addCustomCard",
              stackId: target,
              cardId,
              custom,
            });
            store.getState().toggleExpanded(cardId, true);
            setUi({ lastStackId: target });
            setAddingCustom(false);
          }}
        />
      )}
    </div>
  );
}

function ToolbarButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function SaveIndicator({
  state,
}: {
  state: "saved" | "pending" | "saving" | "error";
}) {
  const map = {
    saved: { icon: <CloudCheckIcon className="size-3.5" />, text: "Saved" },
    pending: { icon: <LoaderIcon className="size-3.5" />, text: "Saving…" },
    saving: {
      icon: <LoaderIcon className="size-3.5 animate-spin" />,
      text: "Saving…",
    },
    error: {
      icon: <CircleAlertIcon className="size-3.5 text-destructive" />,
      text: "Not saved",
    },
  }[state];
  return (
    <span
      className="mr-2 inline-flex items-center gap-1 text-xs text-muted-foreground"
      aria-live="polite"
      data-testid="save-state"
    >
      {map.icon}
      {map.text}
    </span>
  );
}
