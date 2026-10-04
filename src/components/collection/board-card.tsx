"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowRightLeftIcon,
  ChevronDownIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  PencilIcon,
  Trash2Icon,
  WandSparklesIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { memo, useState } from "react";
import { toast } from "sonner";
import { CardHeaderContent } from "@/components/cards/card-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cardName } from "@/lib/model/commands";
import { newId } from "@/lib/model/core";
import type { Card } from "@/lib/model/schema";
import { CARD_TYPES, type CardKind, referenceHref } from "@/lib/srd/card-types";
import { parseRef, prefetchEntry } from "@/lib/srd/client";
import { cn } from "@/lib/utils";
import { useCollectionStore } from "@/stores/collection-store";
const CustomCardDialog = dynamic(() =>
  import("./custom-card-dialog").then((m) => m.CustomCardDialog),
);

// Detail renderers load when the first card is expanded.
const CardBody = dynamic(() => import("./card-body").then((m) => m.CardBody), {
  loading: () => <Skeleton className="h-24 w-full" />,
});

export function cardKind(card: Card): CardKind {
  if (card.kind === "custom") return "custom";
  const type = parseRef(card.ref ?? "").type;
  return type in CARD_TYPES ? type : "custom";
}

export interface CardDisplay {
  kind: CardKind;
  name: string;
  subtitle?: string;
}

export function cardDisplay(card: Card): CardDisplay {
  if (card.kind === "custom")
    return {
      kind: "custom",
      name: card.custom?.title ?? "",
      subtitle: card.custom?.subtitle ?? "Custom card",
    };
  return {
    kind: cardKind(card),
    name: card.snapshot?.name ?? card.ref ?? "",
    subtitle: card.snapshot?.subtitle,
  };
}

/** Sortable wrapper: the card header is the drag handle, so text in the expanded body stays selectable. */
export const SortableCard = memo(function SortableCard({
  card,
  stackId,
  missing,
  readOnly,
}: {
  card: Card;
  stackId: string;
  missing: boolean;
  readOnly: boolean;
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
    id: `card:${card.id}`,
    data: { kind: "card", cardId: card.id, stackId },
    disabled: readOnly,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
    >
      <BoardCard
        card={card}
        stackId={stackId}
        missing={missing}
        readOnly={readOnly}
        collapsed={isDragging}
        handle={{ ref: setActivatorNodeRef, ...attributes, ...listeners }}
      />
    </div>
  );
});

function BoardCard({
  card,
  stackId,
  missing,
  readOnly,
  collapsed,
  handle,
}: {
  card: Card;
  stackId: string;
  missing: boolean;
  readOnly: boolean;
  collapsed: boolean;
  handle: Record<string, unknown> & { ref: (el: HTMLElement | null) => void };
}) {
  const expanded = useCollectionStore((s) => s.ui.expanded.includes(card.id));
  const toggleExpanded = useCollectionStore((s) => s.toggleExpanded);
  const display = cardDisplay(card);
  const cls = CARD_TYPES[display.kind].className;
  const open = expanded && !collapsed;

  return (
    <article
      className={cn(
        "group/card relative overflow-hidden rounded-lg border bg-card shadow-xs transition-shadow hover:shadow-sm",
        open && "shadow-sm",
      )}
      aria-label={display.name}
    >
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-1", cls.accentBg)}
      />
      <div className="flex items-center gap-0.5 py-1.5 pr-1 pl-2.5">
        <button
          type="button"
          {...handle}
          onClick={() => toggleExpanded(card.id)}
          onPointerEnter={() =>
            card.kind === "srd" && card.ref && prefetchEntry(card.ref)
          }
          aria-expanded={open}
          className={cn(
            "flex min-w-0 flex-1 items-center rounded-md py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            !readOnly && "cursor-grab active:cursor-grabbing",
          )}
        >
          <CardHeaderContent
            kind={display.kind}
            name={display.name}
            subtitle={display.subtitle}
            quantity={card.quantity}
            hasNotes={!!card.notes}
            missing={missing}
          />
        </button>
        {!readOnly && (
          <CardMenu card={card} stackId={stackId} missing={missing} />
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={open ? "Collapse card" : "Expand card"}
          onClick={() => toggleExpanded(card.id)}
          className="text-muted-foreground"
        >
          <ChevronDownIcon
            className={cn("transition-transform", open && "rotate-180")}
          />
        </Button>
      </div>
      {open && (
        <div className="border-t px-3 py-3 [contain-intrinsic-size:auto_400px] [content-visibility:auto]">
          <CardBody card={card} readOnly={readOnly} />
        </div>
      )}
    </article>
  );
}

function CardMenu({
  card,
  stackId,
  missing,
}: {
  card: Card;
  stackId: string;
  missing: boolean;
}) {
  const dispatch = useCollectionStore((s) => s.dispatch);
  const undo = useCollectionStore((s) => s.undo);
  const stacks = useCollectionStore((s) => s.collection?.stacks ?? []);
  const [editing, setEditing] = useState(false);
  const ref = card.kind === "srd" && card.ref ? parseRef(card.ref) : undefined;

  const remove = () => {
    dispatch({ type: "removeCard", cardId: card.id });
    toast(`Removed ${cardName(card)}`, {
      action: { label: "Undo", onClick: undo },
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Actions for ${cardName(card)}`}
            className="text-muted-foreground opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
          >
            <EllipsisVerticalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {card.kind === "custom" && (
            <DropdownMenuItem onSelect={() => setEditing(true)}>
              <PencilIcon /> Edit…
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() =>
              dispatch({
                type: "duplicateCard",
                cardId: card.id,
                newCardId: newId(),
              })
            }
          >
            <CopyIcon /> Duplicate
          </DropdownMenuItem>
          {stacks.length > 1 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <ArrowRightLeftIcon /> Move to stack
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {stacks
                  .filter((s) => s.id !== stackId)
                  .map((s) => (
                    <DropdownMenuItem
                      key={s.id}
                      onSelect={() =>
                        dispatch({
                          type: "moveCard",
                          cardId: card.id,
                          toStackId: s.id,
                          toIndex: s.cards.length,
                        })
                      }
                    >
                      {s.name || "Untitled stack"}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          {ref && !missing && (
            <DropdownMenuItem asChild>
              <Link href={referenceHref(ref.type, ref.slug)} target="_blank">
                <ExternalLinkIcon /> Open reference
              </Link>
            </DropdownMenuItem>
          )}
          {missing && (
            <DropdownMenuItem
              onSelect={() =>
                dispatch({ type: "convertToCustom", cardId: card.id })
              }
            >
              <WandSparklesIcon /> Convert to custom card
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={remove}>
            <Trash2Icon /> Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {card.kind === "custom" && editing && (
        <CustomCardDialog
          open={editing}
          onOpenChange={setEditing}
          initial={card.custom}
          onSubmit={(custom) => {
            dispatch({ type: "updateCard", cardId: card.id, custom });
            setEditing(false);
          }}
        />
      )}
    </>
  );
}

/** Lightweight collapsed card for the drag overlay. */
export function CardPreview({
  display,
  quantity,
}: {
  display: CardDisplay;
  quantity?: number;
}) {
  const cls = CARD_TYPES[display.kind].className;
  return (
    <div className="relative w-[340px] cursor-grabbing overflow-hidden rounded-lg border bg-card shadow-lg ring-1 ring-black/5">
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-1", cls.accentBg)}
      />
      <div className="flex items-center py-2 pr-2 pl-2.5">
        <CardHeaderContent
          kind={display.kind}
          name={display.name}
          subtitle={display.subtitle}
          quantity={quantity}
        />
      </div>
    </div>
  );
}
