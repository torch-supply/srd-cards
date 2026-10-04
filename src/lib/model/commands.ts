/**
 * Every change to a collection is a serializable command applied by a pure
 * reducer. That gives undo/redo (snapshots between commands) and a path to
 * syncing operations with a backend later.
 */
import { newId, SCHEMA_VERSION } from "./core";
import type { Card, Collection, Stack } from "./schema";

export type Command =
  | { type: "updateCollection"; name?: string; description?: string }
  | { type: "addStack"; stackId: string; name: string; index?: number }
  | {
      type: "updateStack";
      stackId: string;
      name?: string;
      description?: string;
      wide?: boolean;
    }
  | { type: "removeStack"; stackId: string }
  | { type: "moveStack"; stackId: string; toIndex: number }
  | {
      type: "addSrdCard";
      stackId: string;
      cardId: string;
      ref: string;
      snapshot: { name: string; subtitle: string };
      index?: number;
      /** Add as a separate card even if the stack already has this entry. */
      separate?: boolean;
    }
  | {
      type: "addCustomCard";
      stackId: string;
      cardId: string;
      custom: NonNullable<Card["custom"]>;
      index?: number;
    }
  | {
      type: "updateCard";
      cardId: string;
      quantity?: number;
      notes?: string;
      custom?: Card["custom"];
      snapshot?: Card["snapshot"];
    }
  | { type: "convertToCustom"; cardId: string }
  | { type: "moveCard"; cardId: string; toStackId: string; toIndex: number }
  | { type: "removeCard"; cardId: string }
  | { type: "duplicateCard"; cardId: string; newCardId: string }
  | {
      type: "sortStack";
      stackId: string;
      by: "name" | "type";
      typeOrder?: string[];
    };

export function createCollection(input: {
  name: string;
  description?: string;
  id?: string;
  now?: string;
}): Collection {
  const now = input.now ?? new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: input.id ?? newId(),
    name: input.name.trim() || "Untitled collection",
    description: input.description?.trim() ?? "",
    createdAt: now,
    updatedAt: now,
    rev: 0,
    stacks: [],
  };
}

export function cardName(card: Card): string {
  return card.kind === "custom"
    ? (card.custom?.title ?? "")
    : (card.snapshot?.name ?? card.ref ?? "");
}

export function cardType(card: Card): string {
  return card.kind === "custom" ? "custom" : (card.ref?.split(":")[0] ?? "");
}

function findCard(
  c: Collection,
  cardId: string,
): { stack: Stack; index: number } | undefined {
  for (const stack of c.stacks) {
    const index = stack.cards.findIndex((card) => card.id === cardId);
    if (index !== -1) return { stack, index };
  }
  return undefined;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function insert<T>(list: T[], item: T, index?: number): T[] {
  const next = [...list];
  next.splice(
    index === undefined ? next.length : clamp(index, 0, next.length),
    0,
    item,
  );
  return next;
}

function mapStack(
  c: Collection,
  stackId: string,
  fn: (s: Stack) => Stack,
): Collection {
  return { ...c, stacks: c.stacks.map((s) => (s.id === stackId ? fn(s) : s)) };
}

function mapCard(
  c: Collection,
  cardId: string,
  fn: (card: Card) => Card,
): Collection {
  return {
    ...c,
    stacks: c.stacks.map((s) =>
      s.cards.some((card) => card.id === cardId)
        ? {
            ...s,
            cards: s.cards.map((card) =>
              card.id === cardId ? fn(card) : card,
            ),
          }
        : s,
    ),
  };
}

/** Applies a command. Returns the same object when nothing changed. */
export function apply(c: Collection, cmd: Command): Collection {
  switch (cmd.type) {
    case "updateCollection": {
      const name = cmd.name !== undefined ? cmd.name.trim() || c.name : c.name;
      const description =
        cmd.description !== undefined ? cmd.description : c.description;
      if (name === c.name && description === c.description) return c;
      return { ...c, name, description };
    }
    case "addStack":
      if (c.stacks.some((s) => s.id === cmd.stackId)) return c;
      return {
        ...c,
        stacks: insert(
          c.stacks,
          { id: cmd.stackId, name: cmd.name, cards: [] },
          cmd.index,
        ),
      };
    case "updateStack":
      return mapStack(c, cmd.stackId, (s) => ({
        ...s,
        ...(cmd.name !== undefined ? { name: cmd.name } : {}),
        ...(cmd.description !== undefined
          ? { description: cmd.description || undefined }
          : {}),
        ...(cmd.wide !== undefined ? { wide: cmd.wide || undefined } : {}),
      }));
    case "removeStack":
      if (!c.stacks.some((s) => s.id === cmd.stackId)) return c;
      return { ...c, stacks: c.stacks.filter((s) => s.id !== cmd.stackId) };
    case "moveStack": {
      const from = c.stacks.findIndex((s) => s.id === cmd.stackId);
      if (from === -1) return c;
      const to = clamp(cmd.toIndex, 0, c.stacks.length - 1);
      if (from === to) return c;
      const stacks = [...c.stacks];
      const [stack] = stacks.splice(from, 1);
      stacks.splice(to, 0, stack);
      return { ...c, stacks };
    }
    case "addSrdCard": {
      const stack = c.stacks.find((s) => s.id === cmd.stackId);
      if (!stack) return c;
      const existing = cmd.separate
        ? undefined
        : stack.cards.find(
            (card) => card.kind === "srd" && card.ref === cmd.ref,
          );
      if (existing)
        return mapCard(c, existing.id, (card) => ({
          ...card,
          quantity: Math.min(999, card.quantity + 1),
        }));
      const card: Card = {
        id: cmd.cardId,
        kind: "srd",
        ref: cmd.ref,
        snapshot: cmd.snapshot,
        quantity: 1,
      };
      return mapStack(c, cmd.stackId, (s) => ({
        ...s,
        cards: insert(s.cards, card, cmd.index),
      }));
    }
    case "addCustomCard": {
      if (!c.stacks.some((s) => s.id === cmd.stackId)) return c;
      const card: Card = {
        id: cmd.cardId,
        kind: "custom",
        custom: cmd.custom,
        quantity: 1,
      };
      return mapStack(c, cmd.stackId, (s) => ({
        ...s,
        cards: insert(s.cards, card, cmd.index),
      }));
    }
    case "updateCard":
      if (!findCard(c, cmd.cardId)) return c;
      return mapCard(c, cmd.cardId, (card) => ({
        ...card,
        ...(cmd.quantity !== undefined
          ? { quantity: clamp(Math.round(cmd.quantity), 1, 999) }
          : {}),
        ...(cmd.notes !== undefined ? { notes: cmd.notes || undefined } : {}),
        ...(cmd.custom !== undefined && card.kind === "custom"
          ? { custom: cmd.custom }
          : {}),
        ...(cmd.snapshot !== undefined && card.kind === "srd"
          ? { snapshot: cmd.snapshot }
          : {}),
      }));
    case "convertToCustom":
      return mapCard(c, cmd.cardId, (card) =>
        card.kind === "custom"
          ? card
          : {
              id: card.id,
              kind: "custom",
              custom: {
                title: card.snapshot?.name ?? card.ref ?? "Card",
                subtitle: card.snapshot?.subtitle,
                body: "",
              },
              quantity: card.quantity,
              notes: card.notes,
            },
      );
    case "moveCard": {
      const found = findCard(c, cmd.cardId);
      const target = c.stacks.find((s) => s.id === cmd.toStackId);
      if (!found || !target) return c;
      const card = found.stack.cards[found.index];
      if (found.stack.id === target.id) {
        const to = clamp(cmd.toIndex, 0, target.cards.length - 1);
        if (to === found.index) return c;
        const cards = [...target.cards];
        cards.splice(found.index, 1);
        cards.splice(to, 0, card);
        return mapStack(c, target.id, (s) => ({ ...s, cards }));
      }
      const without = mapStack(c, found.stack.id, (s) => ({
        ...s,
        cards: s.cards.filter((x) => x.id !== card.id),
      }));
      return mapStack(without, target.id, (s) => ({
        ...s,
        cards: insert(s.cards, card, cmd.toIndex),
      }));
    }
    case "removeCard": {
      const found = findCard(c, cmd.cardId);
      if (!found) return c;
      return mapStack(c, found.stack.id, (s) => ({
        ...s,
        cards: s.cards.filter((x) => x.id !== cmd.cardId),
      }));
    }
    case "duplicateCard": {
      const found = findCard(c, cmd.cardId);
      if (!found) return c;
      const copy = { ...found.stack.cards[found.index], id: cmd.newCardId };
      return mapStack(c, found.stack.id, (s) => ({
        ...s,
        cards: insert(s.cards, copy, found.index + 1),
      }));
    }
    case "sortStack":
      return mapStack(c, cmd.stackId, (s) => {
        const order = cmd.typeOrder ?? [];
        const rank = (card: Card) => {
          const i = order.indexOf(cardType(card));
          return i === -1 ? order.length : i;
        };
        const cards = [...s.cards].sort((a, b) =>
          cmd.by === "type"
            ? rank(a) - rank(b) || cardName(a).localeCompare(cardName(b))
            : cardName(a).localeCompare(cardName(b)),
        );
        return cards.every((card, i) => card === s.cards[i])
          ? s
          : { ...s, cards };
      });
  }
}
