/**
 * Zod-free model helpers, safe to import anywhere without pulling validation
 * code into the bundle.
 */
import type { Collection } from "./schema";

export const SCHEMA_VERSION = 1;

export interface CollectionSummary {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  stackCount: number;
  cardCount: number;
}

export function summarize(c: Collection): CollectionSummary {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    stackCount: c.stacks.length,
    cardCount: c.stacks.reduce((n, s) => n + s.cards.length, 0),
  };
}

export function newId(): string {
  return crypto.randomUUID();
}
