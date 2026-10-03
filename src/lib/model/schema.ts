/**
 * User data: collections → stacks → cards. Validated whenever it is read from
 * storage or imported from a file. Uses zod/mini to keep the browser bundle small.
 */
import * as z from "zod/mini";

const card = z
  .object({
    id: z.string().check(z.minLength(1)),
    kind: z.enum(["srd", "custom"]),
    /** SRD entry id, e.g. "spell:fireball" (kind "srd"). */
    ref: z.optional(z.string()),
    /** Name and subtitle at the time the card was added, so collapsed cards render without SRD data. */
    snapshot: z.optional(z.object({ name: z.string(), subtitle: z.string() })),
    /** Homebrew content (kind "custom"). Body is markdown. */
    custom: z.optional(z.object({ title: z.string(), subtitle: z.optional(z.string()), body: z.string() })),
    quantity: z.int().check(z.minimum(1), z.maximum(999)),
    notes: z.optional(z.string().check(z.maxLength(5000))),
  })
  .check(
    z.refine((c) => (c.kind === "srd" ? !!c.ref : !!c.custom), {
      message: "SRD cards need a ref; custom cards need content",
    }),
  );
export const cardSchema = card;
export type Card = z.infer<typeof card>;

export const stackSchema = z.object({
  id: z.string().check(z.minLength(1)),
  name: z.string().check(z.maxLength(200)),
  description: z.optional(z.string().check(z.maxLength(2000))),
  wide: z.optional(z.boolean()),
  cards: z.array(card),
});
export type Stack = z.infer<typeof stackSchema>;

export const collectionSchema = z.object({
  schemaVersion: z.int(),
  id: z.string().check(z.minLength(1)),
  name: z.string().check(z.maxLength(200)),
  description: z.string().check(z.maxLength(5000)),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Incremented on every save; lets a backend reject stale writes later. */
  rev: z.int().check(z.minimum(0)),
  stacks: z.array(stackSchema),
});
export type Collection = z.infer<typeof collectionSchema>;
