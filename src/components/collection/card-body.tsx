"use client";

import { ExternalLinkIcon, MinusIcon, PlusIcon } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Suspense, use } from "react";
import { EntryDetail } from "@/components/cards/details/entry-detail";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { Card } from "@/lib/model/schema";
import { referenceHref } from "@/lib/srd/card-types";
import { loadEntry, parseRef } from "@/lib/srd/client";
import { useCollectionStore } from "@/stores/collection-store";
import { ErrorBoundary } from "./error-boundary";

const Markdown = dynamic(() => import("./markdown"), {
  loading: () => <Skeleton className="h-16 w-full" />,
});

function SrdEntry({ refId }: { refId: string }) {
  const entry = use(loadEntry(refId));
  return <EntryDetail entry={entry} compact />;
}

function BodySkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  );
}

/** Expanded content of a card: SRD details (fetched on demand) or custom markdown. */
export function CardBody({ card, readOnly }: { card: Card; readOnly: boolean }) {
  return (
    <div className="space-y-3">
      {card.kind === "srd" && card.ref ? (
        <ErrorBoundary
          fallback={<p className="text-sm text-destructive">Couldn’t load this SRD entry. Check your connection and try again.</p>}
        >
          <Suspense fallback={<BodySkeleton />}>
            <SrdEntry refId={card.ref} />
          </Suspense>
        </ErrorBoundary>
      ) : card.custom?.body ? (
        <Markdown>{card.custom.body}</Markdown>
      ) : (
        <p className="text-sm italic text-muted-foreground">No text yet. Use “Edit” in the card menu to write some.</p>
      )}
      <CardFooter card={card} readOnly={readOnly} />
    </div>
  );
}

function CardFooter({ card, readOnly }: { card: Card; readOnly: boolean }) {
  const dispatch = useCollectionStore((s) => s.dispatch);
  const setQuantity = (quantity: number) =>
    dispatch({ type: "updateCard", cardId: card.id, quantity }, { coalesce: `quantity:${card.id}` });
  const ref = card.kind === "srd" && card.ref ? parseRef(card.ref) : undefined;
  return (
    <div className="space-y-2 border-t pt-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Quantity</span>
        <div className="flex items-center rounded-md border">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Decrease quantity"
            disabled={readOnly || card.quantity <= 1}
            onClick={() => setQuantity(card.quantity - 1)}
          >
            <MinusIcon />
          </Button>
          <span className="w-8 text-center text-sm tabular-nums" aria-live="polite">
            {card.quantity}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Increase quantity"
            disabled={readOnly || card.quantity >= 999}
            onClick={() => setQuantity(card.quantity + 1)}
          >
            <PlusIcon />
          </Button>
        </div>
        {ref && (
          <Link
            href={referenceHref(ref.type, ref.slug)}
            target="_blank"
            className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Reference <ExternalLinkIcon className="size-3" />
          </Link>
        )}
      </div>
      <Textarea
        value={card.notes ?? ""}
        disabled={readOnly}
        onChange={(e) =>
          dispatch({ type: "updateCard", cardId: card.id, notes: e.target.value }, { coalesce: `notes:${card.id}` })
        }
        placeholder="Notes (e.g. prepared, 12 HP left)…"
        aria-label="Card notes"
        rows={2}
        maxLength={5000}
        className="min-h-14 resize-y text-sm"
      />
    </div>
  );
}
