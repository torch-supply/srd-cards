import { SCHEMA_VERSION } from "@/lib/model/core";
import type { Card, Collection } from "@/lib/model/schema";
import type { IndexEntry } from "@/lib/srd/schema";
import type { Example } from "@/lib/examples";

/** Fixed so the built collection is the same on every build. */
const EXAMPLE_DATE = "2026-10-04T00:00:00.000Z";

/**
 * Turns an example into a collection, naming SRD cards from the index. Ids are
 * stable (`example-<slug>-<stack>-<card>`) so view state survives a rebuild.
 * Throws on an unknown SRD id, so a stale example fails the build.
 */
export function buildExample(
  example: Example,
  index: IndexEntry[],
): Collection {
  const byId = new Map(index.map((e) => [e.id, e]));
  const id = `example-${example.slug}`;
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    name: example.name,
    description: example.description,
    createdAt: EXAMPLE_DATE,
    updatedAt: EXAMPLE_DATE,
    rev: 0,
    stacks: example.stacks.map((stack, s) => ({
      id: `${id}-${s + 1}`,
      name: stack.name,
      ...(stack.description ? { description: stack.description } : {}),
      cards: stack.cards.map((def, c): Card => {
        const cardId = `${id}-${s + 1}-${c + 1}`;
        const card = typeof def === "string" ? { ref: def } : def;
        const notes = card.notes ? { notes: card.notes } : {};
        if ("custom" in card)
          return {
            id: cardId,
            kind: "custom",
            custom: card.custom,
            quantity: 1,
            ...notes,
          };
        const entry = byId.get(card.ref);
        if (!entry)
          throw new Error(
            `Example "${example.slug}": unknown SRD id ${card.ref}`,
          );
        return {
          id: cardId,
          kind: "srd",
          ref: card.ref,
          snapshot: { name: entry.name, subtitle: entry.subtitle },
          quantity: card.quantity ?? 1,
          ...notes,
        };
      }),
    })),
  };
}
