"use client";

import {
  type Announcements,
  closestCenter,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  type DropAnimationFunction,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PlusIcon } from "lucide-react";
import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cardName } from "@/lib/model/commands";
import { newId } from "@/lib/model/core";
import type { Card, Collection } from "@/lib/model/schema";
import { prefetchEntry } from "@/lib/srd/client";
import type { IndexEntry } from "@/lib/srd/schema";
import { preloadSrdIndex, useSrdIndex } from "@/lib/srd/use-srd-index";
import {
  useCollectionStore,
  useCollectionStoreApi,
} from "@/stores/collection-store";
import { cardDisplay, CardPreview } from "./board-card";
import { BrowserPanel, BrowserRail } from "./browser-panel";
import {
  ColumnPreview,
  COLUMN_WIDTH,
  type InsertionTarget,
  StackColumn,
} from "./stack-column";

type DragState =
  | {
      kind: "card";
      cardId: string;
      items: Record<string, string[]>;
      /** Order at drag start, restored while the card is outside every stack. */
      initial: Record<string, string[]>;
    }
  | { kind: "column"; stackId: string }
  | {
      kind: "source";
      entry: IndexEntry;
      /** Id of the placeholder shown in the target stack, kept by the card added on drop. */
      cardId: string;
      target?: InsertionTarget;
    };

type DragData =
  | { kind: "card"; cardId: string; stackId: string; ghost?: boolean }
  | { kind: "column"; stackId: string }
  | { kind: "body"; stackId: string }
  | { kind: "source"; entry: IndexEntry };

const MEASURING = { droppable: { strategy: MeasuringStrategy.WhileDragging } };

const dataOf = (x: { data: { current?: unknown } } | null | undefined) =>
  x?.data.current as DragData | undefined;

function findStack(items: Record<string, string[]>, cardId: string) {
  return Object.keys(items).find((stackId) => items[stackId].includes(cardId));
}

/** Insertion index above or below the card the dragged item is over (by vertical midpoint). */
function insertionIndex(
  event: DragOverEvent | DragMoveEvent,
  list: string[],
  overCardId: string,
) {
  const overIndex = list.indexOf(overCardId);
  const translated = event.active.rect.current.translated;
  const over = event.over?.rect;
  const below =
    translated && over
      ? translated.top + translated.height / 2 > over.top + over.height / 2
      : false;
  return overIndex + (below ? 1 : 0);
}

/** Drop animation for a browser entry: the overlay settles onto the new card instead of flying back to the browser. */
function dropOnto(cardId: string): DropAnimationFunction {
  return ({
    dragOverlay,
    draggableNodes,
    measuringConfiguration,
    transform,
  }) => {
    const node = draggableNodes.get(`card:${cardId}`)?.node.current;
    if (!node) return;
    const rect = measuringConfiguration.draggable.measure(node);
    const final = {
      ...transform,
      x: transform.x - (dragOverlay.rect.left - rect.left),
      y: transform.y - (dragOverlay.rect.top - rect.top),
    };
    // Hide the new card until the overlay lands on it, as dnd-kit does for card drops.
    node.style.opacity = "0";
    const reveal = () => {
      node.style.opacity = "";
    };
    return dragOverlay.node
      .animate(
        [
          { transform: CSS.Transform.toString(transform) },
          { transform: CSS.Transform.toString(final) },
        ],
        { duration: 250, easing: "ease", fill: "forwards" },
      )
      .finished.then(reveal, reveal);
  };
}

export function Board({
  collection,
  readOnly,
  browserOpen,
  searchRef,
}: {
  collection: Collection;
  readOnly: boolean;
  browserOpen: boolean;
  searchRef: RefObject<HTMLInputElement | null>;
}) {
  const dispatch = useCollectionStore((s) => s.dispatch);
  const setUi = useCollectionStore((s) => s.setUi);
  const lastStackId = useCollectionStore((s) => s.ui.lastStackId);
  const store = useCollectionStoreApi();
  const index = useSrdIndex(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  // Card added by the last browser drop; outlives `drag` so the drop animation can target it.
  const [droppedCardId, setDroppedCardId] = useState<string | null>(null);
  const browserScrollRef = useRef<HTMLDivElement | null>(null);

  const cardById = useMemo(() => {
    const map = new Map<string, Card>();
    for (const s of collection.stacks)
      for (const c of s.cards) map.set(c.id, c);
    return map;
  }, [collection]);

  // Load the index when idle: flags missing entries and refreshes card snapshots.
  useEffect(() => preloadSrdIndex(), []);
  // Prefetch details for cards that were left expanded (read once: subscribing
  // would re-render the whole board on every expand).
  useEffect(() => {
    for (const id of store.getState().ui.expanded) {
      const card = cardById.get(id);
      if (card?.kind === "srd" && card.ref) prefetchEntry(card.ref);
    }
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Keep snapshots (name/subtitle shown on collapsed cards) in step with the SRD data.
  useEffect(() => {
    if (index.status !== "ready" || readOnly) return;
    for (const card of cardById.values()) {
      if (card.kind !== "srd" || !card.ref) continue;
      const entry = index.byId.get(card.ref);
      if (
        entry &&
        (entry.name !== card.snapshot?.name ||
          entry.subtitle !== card.snapshot?.subtitle)
      ) {
        dispatch(
          {
            type: "updateCard",
            cardId: card.id,
            snapshot: { name: entry.name, subtitle: entry.subtitle },
          },
          { history: false },
        );
      }
    }
  }, [index, cardById, dispatch, readOnly]);

  const isMissing = useCallback(
    (card: Card) =>
      card.kind === "srd" &&
      index.status === "ready" &&
      !!card.ref &&
      !index.byId.has(card.ref),
    [index],
  );

  const defaultStackId = collection.stacks.some((s) => s.id === lastStackId)
    ? lastStackId
    : collection.stacks[0]?.id;

  const addEntry = (
    entry: IndexEntry,
    stackId?: string,
    at?: number,
    separate?: boolean,
    cardId = newId(),
  ) => {
    let target = stackId;
    if (!target || !collection.stacks.some((s) => s.id === target)) {
      target = newId();
      dispatch({ type: "addStack", stackId: target, name: "Stack 1" });
    }
    const stack = collection.stacks.find((s) => s.id === target);
    const existing =
      !separate &&
      stack?.cards.find((c) => c.kind === "srd" && c.ref === entry.id);
    dispatch({
      type: "addSrdCard",
      stackId: target,
      cardId,
      ref: entry.id,
      snapshot: { name: entry.name, subtitle: entry.subtitle },
      index: at,
      separate,
    });
    setUi({ lastStackId: target });
    if (existing)
      toast(
        `${entry.name} ×${existing.quantity + 1} in ${stack?.name || "stack"}`,
      );
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const kind = (args.active.data.current as DragData | undefined)?.kind;
    const containers = args.droppableContainers;
    if (kind === "column") {
      return closestCenter({
        ...args,
        droppableContainers: containers.filter(
          (c) => dataOf(c)?.kind === "column",
        ),
      });
    }
    // Cards and SRD entries: find the column body under the pointer, then the nearest card in it.
    const bodies = containers.filter((c) => dataOf(c)?.kind === "body");
    let hits = args.pointerCoordinates
      ? pointerWithin({ ...args, droppableContainers: bodies })
      : [];
    if (!hits.length)
      hits = rectIntersection({ ...args, droppableContainers: bodies });
    const body = hits[0];
    // Outside every stack: dropping here cancels, so the item returns to where it came from.
    if (!body) return [];
    const bodyData = dataOf(containers.find((c) => c.id === body.id));
    const stackId =
      bodyData && "stackId" in bodyData ? bodyData.stackId : undefined;
    // Skip the browser-drag placeholder: insertion indexes refer to the stack's real cards.
    const cards = containers.filter((c) => {
      const d = dataOf(c);
      return d?.kind === "card" && d.stackId === stackId && !d.ghost;
    });
    const closest = cards.length
      ? closestCenter({ ...args, droppableContainers: cards })
      : [];
    return closest.length ? [closest[0]] : [body];
  }, []);

  const onDragStart = ({ active }: DragStartEvent) => {
    const data = dataOf(active);
    setDroppedCardId(null);
    if (data?.kind === "card") {
      const items = Object.fromEntries(
        collection.stacks.map((s) => [s.id, s.cards.map((c) => c.id)]),
      );
      setDrag({ kind: "card", cardId: data.cardId, items, initial: items });
    } else if (data?.kind === "column") {
      setDrag({ kind: "column", stackId: data.stackId });
    } else if (data?.kind === "source") {
      setDrag({ kind: "source", entry: data.entry, cardId: newId() });
    }
  };

  const updateSourceTarget = (event: DragOverEvent | DragMoveEvent) => {
    setDrag((d) => {
      if (d?.kind !== "source") return d;
      const over = dataOf(event.over);
      let target: InsertionTarget | undefined;
      if (over?.kind === "body") {
        target = {
          stackId: over.stackId,
          index:
            collection.stacks.find((s) => s.id === over.stackId)?.cards
              .length ?? 0,
        };
      } else if (over?.kind === "card") {
        const list =
          collection.stacks
            .find((s) => s.id === over.stackId)
            ?.cards.map((c) => c.id) ?? [];
        target = {
          stackId: over.stackId,
          index: insertionIndex(event, list, over.cardId),
        };
      }
      if (
        d.target?.stackId === target?.stackId &&
        d.target?.index === target?.index
      )
        return d;
      return { ...d, target };
    });
  };

  const onDragOver = (event: DragOverEvent) => {
    if (drag?.kind === "source") return updateSourceTarget(event);
    if (drag?.kind !== "card") return;
    const over = dataOf(event.over);
    setDrag((d) => {
      if (d?.kind !== "card") return d;
      if (!over) return d.items === d.initial ? d : { ...d, items: d.initial };
      const from = findStack(d.items, d.cardId);
      const to =
        over.kind === "body"
          ? over.stackId
          : over.kind === "card"
            ? findStack(d.items, over.cardId)
            : undefined;
      if (!from || !to || from === to) return d;
      const toItems = d.items[to];
      const index =
        over.kind === "card"
          ? insertionIndex(event, toItems, over.cardId)
          : toItems.length;
      return {
        ...d,
        items: {
          ...d.items,
          [from]: d.items[from].filter((id) => id !== d.cardId),
          [to]: [...toItems.slice(0, index), d.cardId, ...toItems.slice(index)],
        },
      };
    });
  };

  const onDragMove = (event: DragMoveEvent) => {
    if (drag?.kind === "source") updateSourceTarget(event);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const over = dataOf(event.over);
    if (drag?.kind === "card") {
      const to = findStack(drag.items, drag.cardId);
      if (to && over) {
        const list = drag.items[to];
        let toIndex = list.indexOf(drag.cardId);
        if (
          over?.kind === "card" &&
          over.cardId !== drag.cardId &&
          list.includes(over.cardId)
        ) {
          toIndex = list.indexOf(over.cardId);
        }
        dispatch({
          type: "moveCard",
          cardId: drag.cardId,
          toStackId: to,
          toIndex,
        });
      }
    } else if (drag?.kind === "column") {
      if (over?.kind === "column" && over.stackId !== drag.stackId) {
        dispatch({
          type: "moveStack",
          stackId: drag.stackId,
          toIndex: collection.stacks.findIndex((s) => s.id === over.stackId),
        });
      }
    } else if (drag?.kind === "source" && drag.target) {
      // Reuse the placeholder's id so the new card takes its place without remounting.
      addEntry(
        drag.entry,
        drag.target.stackId,
        drag.target.index,
        true,
        drag.cardId,
      );
      setDroppedCardId(drag.cardId);
    }
    setDrag(null);
  };

  const label = (x: { data: { current?: unknown } } | null) => {
    const d = dataOf(x);
    if (!d) return "item";
    if (d.kind === "card")
      return cardName(cardById.get(d.cardId) ?? ({} as Card)) || "card";
    if (d.kind === "source") return d.entry.name;
    const stack = collection.stacks.find((s) => s.id === d.stackId);
    return `stack ${stack?.name || "Untitled"}`;
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${label(active)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${label(active)} is over ${label(over)}.`
        : `${label(active)} is not over a stack.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${label(active)} was dropped on ${label(over)}.`
        : `${label(active)} was dropped.`,
    onDragCancel: ({ active }) =>
      `Dragging was cancelled. ${label(active)} was returned.`,
  };

  const overlay = (() => {
    if (drag?.kind === "card") {
      const card = cardById.get(drag.cardId);
      return card ? (
        <CardPreview display={cardDisplay(card)} quantity={card.quantity} />
      ) : null;
    }
    if (drag?.kind === "column") {
      const stack = collection.stacks.find((s) => s.id === drag.stackId);
      return stack ? (
        <ColumnPreview stack={stack} names={stack.cards.map(cardName)} />
      ) : null;
    }
    if (drag?.kind === "source") {
      return (
        <CardPreview
          display={{
            kind: drag.entry.type,
            name: drag.entry.name,
            subtitle: drag.entry.subtitle,
          }}
        />
      );
    }
    return null;
  })();

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      // Re-measure drop zones while dragging (card heights vary), at dnd-kit's optimized frequency.
      measuring={MEASURING}
      autoScroll={{
        canScroll: (el) => el !== browserScrollRef.current,
        threshold: { x: 0.15, y: 0.2 },
      }}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "To pick up a card, press space or enter. Use the arrow keys to move it, then press space or enter again to drop it, or escape to cancel.",
        },
      }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDrag(null)}
    >
      <div className="flex min-h-0 flex-1">
        {!readOnly &&
          (browserOpen ? (
            <BrowserPanel
              stacks={collection.stacks.map((s) => ({
                id: s.id,
                name: s.name,
              }))}
              defaultStackId={defaultStackId}
              onAdd={(entry, stackId) => addEntry(entry, stackId)}
              onClose={() => setUi({ browserOpen: false })}
              scrollRef={browserScrollRef}
              searchRef={searchRef}
            />
          ) : (
            <BrowserRail
              onOpen={(focusSearch) => {
                setUi({ browserOpen: true });
                if (focusSearch)
                  requestAnimationFrame(() => searchRef.current?.focus());
              }}
            />
          ))}
        <div
          className="flex min-w-0 flex-1 items-start gap-3 overflow-x-auto p-4"
          data-testid="board"
        >
          <SortableContext
            items={collection.stacks.map((s) => `stack:${s.id}`)}
            strategy={horizontalListSortingStrategy}
          >
            {collection.stacks.map((stack) => {
              // During a card drag, only columns whose order changed get a new array
              // (unchanged columns keep their props and skip re-rendering).
              const ids =
                drag?.kind === "card" ? drag.items[stack.id] : undefined;
              const unchanged =
                !ids ||
                (ids.length === stack.cards.length &&
                  ids.every((id, i) => stack.cards[i].id === id));
              let cards = unchanged
                ? stack.cards
                : ids
                    .map((id) => cardById.get(id))
                    .filter((c): c is Card => !!c);
              // During a browser drag, the target stack shows a placeholder card at the drop position.
              const incoming =
                drag?.kind === "source" && drag.target?.stackId === stack.id
                  ? drag
                  : undefined;
              if (incoming?.target) {
                const placeholder: Card = {
                  id: incoming.cardId,
                  kind: "srd",
                  ref: incoming.entry.id,
                  snapshot: {
                    name: incoming.entry.name,
                    subtitle: incoming.entry.subtitle,
                  },
                  quantity: 1,
                };
                const at = incoming.target.index;
                cards = [
                  ...cards.slice(0, at),
                  placeholder,
                  ...cards.slice(at),
                ];
              }
              return (
                <StackColumn
                  key={stack.id}
                  stack={stack}
                  cards={cards}
                  readOnly={readOnly}
                  isMissing={isMissing}
                  ghostId={incoming?.cardId}
                />
              );
            })}
          </SortableContext>
          {!readOnly && (
            <Button
              variant="outline"
              className="h-24 shrink-0 border-dashed bg-transparent text-muted-foreground"
              style={{ width: COLUMN_WIDTH }}
              onClick={() =>
                dispatch({
                  type: "addStack",
                  stackId: newId(),
                  name: `Stack ${collection.stacks.length + 1}`,
                })
              }
            >
              <PlusIcon /> Add stack
            </Button>
          )}
        </div>
      </div>
      <DragOverlay
        dropAnimation={droppedCardId ? dropOnto(droppedCardId) : undefined}
      >
        {overlay}
      </DragOverlay>
    </DndContext>
  );
}
