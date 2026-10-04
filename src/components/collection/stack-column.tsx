"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDownAZIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  EllipsisIcon,
  GripVerticalIcon,
  LayersIcon,
  MoveHorizontalIcon,
  PencilIcon,
  ShapesIcon,
  Trash2Icon,
} from "lucide-react";
import { memo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Card, Stack } from "@/lib/model/schema";
import { REFERENCE_TYPES } from "@/lib/srd/card-types";
import { cn } from "@/lib/utils";
import { useCollectionStore } from "@/stores/collection-store";
import { SortableCard } from "./board-card";
import { InlineEdit } from "./inline-edit";

export const COLUMN_WIDTH = 340;
export const WIDE_COLUMN_WIDTH = 560;

/** Where a dragged SRD entry would be inserted. */
export interface InsertionTarget {
  stackId: string;
  index: number;
}

export const StackColumn = memo(function StackColumn({
  stack,
  cards,
  readOnly,
  isMissing,
  insertion,
}: {
  stack: Stack;
  /** Cards in display order (may differ from the stack during a drag). */
  cards: Card[];
  readOnly: boolean;
  isMissing: (card: Card) => boolean;
  insertion?: number;
}) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `stack:${stack.id}`,
    data: { kind: "column", stackId: stack.id },
    disabled: readOnly,
  });
  const { setNodeRef: setBodyRef, isOver } = useDroppable({
    id: `body:${stack.id}`,
    data: { kind: "body", stackId: stack.id },
  });
  const width = stack.wide ? WIDE_COLUMN_WIDTH : COLUMN_WIDTH;

  return (
    <section
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        width,
      }}
      className={cn(
        "flex max-h-full shrink-0 flex-col rounded-xl border bg-muted/40",
        isDragging && "opacity-40",
      )}
      aria-label={stack.name || "Untitled stack"}
    >
      <ColumnHeader
        stack={stack}
        readOnly={readOnly}
        handle={{ ref: setActivatorNodeRef, ...attributes, ...listeners }}
      />
      <div
        ref={setBodyRef}
        className={cn(
          "flex min-h-24 flex-1 flex-col gap-1.5 overflow-y-auto px-2 pb-2",
          isOver && cards.length === 0 && "rounded-b-xl bg-primary/5",
        )}
      >
        <SortableContext
          items={cards.map((c) => `card:${c.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {cards.map((card, i) => (
            <div key={card.id}>
              {insertion === i && <InsertionLine />}
              <SortableCard
                card={card}
                stackId={stack.id}
                missing={isMissing(card)}
                readOnly={readOnly}
              />
            </div>
          ))}
        </SortableContext>
        {insertion !== undefined && insertion >= cards.length && (
          <InsertionLine />
        )}
        {cards.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
            <LayersIcon className="size-4" />
            Drag cards here, or use + in the browser.
          </div>
        )}
      </div>
    </section>
  );
});

function InsertionLine() {
  return <div className="my-0.5 h-0.5 rounded-full bg-primary" aria-hidden />;
}

function ColumnHeader({
  stack,
  readOnly,
  handle,
}: {
  stack: Stack;
  readOnly: boolean;
  handle: Record<string, unknown> & { ref: (el: HTMLElement | null) => void };
}) {
  const dispatch = useCollectionStore((s) => s.dispatch);
  const undo = useCollectionStore((s) => s.undo);
  const setExpandedMany = useCollectionStore((s) => s.setExpandedMany);
  const [editingDescription, setEditingDescription] = useState(false);
  const cardIds = stack.cards.map((c) => c.id);

  const remove = () => {
    dispatch({ type: "removeStack", stackId: stack.id });
    toast(`Deleted ${stack.name || "stack"} (${stack.cards.length} cards)`, {
      action: { label: "Undo", onClick: undo },
    });
  };

  return (
    <header className="group/column flex flex-col gap-0.5 px-2 pt-2 pb-1.5">
      <div className="flex items-center gap-1">
        {!readOnly && (
          <button
            type="button"
            {...handle}
            aria-label={`Reorder ${stack.name || "stack"}`}
            className="-ml-0.5 cursor-grab rounded p-0.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground active:cursor-grabbing"
          >
            <GripVerticalIcon className="size-4" />
          </button>
        )}
        <InlineEdit
          value={stack.name}
          placeholder="Untitled stack"
          ariaLabel="Stack name"
          maxLength={200}
          disabled={readOnly}
          onSave={(name) =>
            dispatch({
              type: "updateStack",
              stackId: stack.id,
              name: name.trim(),
            })
          }
          className="min-w-0 flex-1 font-serif text-[1.05rem] font-semibold"
        />
        <span className="shrink-0 rounded-full bg-background px-1.5 text-xs text-muted-foreground tabular-nums">
          {stack.cards.length}
        </span>
        {!readOnly && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Actions for ${stack.name || "stack"}`}
                className="text-muted-foreground"
              >
                <EllipsisIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => setEditingDescription(true)}>
                <PencilIcon />{" "}
                {stack.description ? "Edit description" : "Add description"}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setExpandedMany(cardIds, true)}>
                <ChevronsUpDownIcon /> Expand all
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setExpandedMany(cardIds, false)}
              >
                <ChevronsDownUpIcon /> Collapse all
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  dispatch({ type: "sortStack", stackId: stack.id, by: "name" })
                }
              >
                <ArrowDownAZIcon /> Sort by name
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  dispatch({
                    type: "sortStack",
                    stackId: stack.id,
                    by: "type",
                    typeOrder: [...REFERENCE_TYPES, "custom"],
                  })
                }
              >
                <ShapesIcon /> Sort by type
              </DropdownMenuItem>
              <DropdownMenuCheckboxItem
                checked={!!stack.wide}
                onCheckedChange={(wide) =>
                  dispatch({ type: "updateStack", stackId: stack.id, wide })
                }
              >
                <MoveHorizontalIcon /> Wide column
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={remove}>
                <Trash2Icon /> Delete stack
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {(stack.description || editingDescription) && (
        <DescriptionEdit
          key={editingDescription ? "editing" : "view"}
          value={stack.description ?? ""}
          startEditing={editingDescription}
          readOnly={readOnly}
          onDone={() => setEditingDescription(false)}
          onSave={(description) =>
            dispatch({
              type: "updateStack",
              stackId: stack.id,
              description: description.trim(),
            })
          }
        />
      )}
    </header>
  );
}

function DescriptionEdit({
  value,
  startEditing,
  readOnly,
  onDone,
  onSave,
}: {
  value: string;
  startEditing: boolean;
  readOnly: boolean;
  onDone: () => void;
  onSave: (value: string) => void;
}) {
  if (startEditing) {
    return (
      <textarea
        autoFocus
        defaultValue={value}
        rows={2}
        maxLength={2000}
        aria-label="Stack description"
        placeholder="What is this stack for?"
        onBlur={(e) => {
          onSave(e.target.value);
          onDone();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") onDone();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
            e.currentTarget.blur();
        }}
        className="w-full rounded-md border border-input bg-background px-1.5 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      />
    );
  }
  return (
    <InlineEdit
      value={value}
      multiline
      ariaLabel="Stack description"
      disabled={readOnly}
      onSave={onSave}
      className="text-xs whitespace-pre-wrap text-muted-foreground"
    />
  );
}

/** Lightweight column for the drag overlay: header and up to 8 card titles. */
export function ColumnPreview({
  stack,
  names,
}: {
  stack: Stack;
  names: string[];
}) {
  return (
    <div
      className="flex cursor-grabbing flex-col gap-1 rounded-xl border bg-muted p-2 shadow-lg"
      style={{ width: stack.wide ? WIDE_COLUMN_WIDTH : COLUMN_WIDTH }}
    >
      <div className="px-1 font-serif text-[1.05rem] font-semibold">
        {stack.name || "Untitled stack"}
      </div>
      {names.slice(0, 8).map((n, i) => (
        <div
          key={i}
          className="truncate rounded-md border bg-card px-2 py-1.5 text-sm"
        >
          {n}
        </div>
      ))}
      {names.length > 8 && (
        <div className="px-1 text-xs text-muted-foreground">
          +{names.length - 8} more
        </div>
      )}
    </div>
  );
}
