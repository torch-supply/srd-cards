/** Zod-free SRD constants, safe for client bundles. */

export const SRD_TYPES = [
  "class",
  "subclass",
  "spell",
  "monster",
  "equipment",
  "magic-item",
  "feat",
  "condition",
  "rule",
] as const;
export type SrdType = (typeof SRD_TYPES)[number];

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type Ability = (typeof ABILITIES)[number];
