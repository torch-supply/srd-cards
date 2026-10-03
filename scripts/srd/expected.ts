import type { SrdType } from "../../src/lib/srd/schema";

/** Entry counts from the SRD 5.2.1 PDF. The import fails if they drift. */
export const EXPECTED_COUNTS: Partial<Record<SrdType, number>> = {
  spell: 339,
  monster: 330,
  class: 12,
  subclass: 12,
  feat: 17,
  condition: 15,
  "magic-item": 258,
};
