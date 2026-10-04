/**
 * Schema for normalized SRD 5.2.1 entries.
 *
 * Prose fields are always named `description`. They hold markdown in
 * `src/data/srd/` and sanitized HTML once rendered (see `render.ts`).
 */
import { z } from "zod";
import { ABILITIES, SRD_TYPES, type SrdType } from "./constants";

export { ABILITIES, SRD_TYPES };
export type { Ability, SrdType } from "./constants";

export const srdTypeSchema = z.enum(SRD_TYPES);

const labelValue = z.object({ label: z.string(), value: z.string() });
export type LabelValue = z.infer<typeof labelValue>;

const namedText = z.object({ name: z.string(), description: z.string() });
export type NamedText = z.infer<typeof namedText>;

export const tableSchema = z.object({
  title: z.string().optional(),
  header: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});
export type SrdTable = z.infer<typeof tableSchema>;

const base = {
  /** `${type}:${slug}` — stable, referenced by cards. */
  id: z.string().regex(/^[a-z-]+:[a-z0-9-]+$/),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  /** One-line summary for the collapsed card. */
  subtitle: z.string(),
  /** Page in the SRD 5.2.1 PDF. */
  page: z.number().int().positive(),
};

export const spellSchema = z.object({
  ...base,
  type: z.literal("spell"),
  level: z.number().int().min(0).max(9),
  school: z.string(),
  classes: z.array(z.string()),
  castingTime: z.string(),
  ritual: z.boolean(),
  range: z.string(),
  components: z.object({
    verbal: z.boolean(),
    somatic: z.boolean(),
    material: z.boolean(),
    materialText: z.string().optional(),
  }),
  componentsText: z.string(),
  duration: z.string(),
  concentration: z.boolean(),
  description: z.string(),
  /** Stat blocks the spell creates (Find Steed, Summon Dragon, …). */
  statBlocks: z.array(z.lazy(() => statBlockSchema)).optional(),
});

const abilityScore = z.object({
  score: z.number().int(),
  mod: z.string(),
  save: z.string(),
});

/** A stat block, as found in Monsters A–Z, Animals, and embedded in spells and magic items. */
export const statBlockSchema = z.object({
  name: z.string(),
  size: z.string(),
  creatureType: z.string(),
  alignment: z.string(),
  /** Full italic line, e.g. "Large Aberration, Lawful Evil". */
  meta: z.string(),
  ac: z.string(),
  initiative: z.string(),
  hp: z.string(),
  speed: z.string(),
  abilities: z.object({
    str: abilityScore,
    dex: abilityScore,
    con: abilityScore,
    int: abilityScore,
    wis: abilityScore,
    cha: abilityScore,
  }),
  /** Skills, Resistances, Vulnerabilities, Immunities, Gear, Senses, Languages — in stat block order. */
  fields: z.array(labelValue),
  cr: z.string(),
  /** Numeric CR for sorting/filtering (1/4 → 0.25); null when CR is "None". */
  crValue: z.number().nullable(),
  /** Text in parentheses after CR: "XP 5,900, or 7,200 in lair; PB +4". */
  crDetail: z.string(),
  sections: z.array(
    z.object({
      title: z.string(),
      intro: z.string().optional(),
      entries: z.array(namedText),
    }),
  ),
});
export type StatBlock = z.infer<typeof statBlockSchema>;

export const monsterSchema = z.object({
  ...base,
  ...statBlockSchema.shape,
  type: z.literal("monster"),
  /** Group heading in "Monsters A–Z" (e.g. "Dragons, Chromatic"), or "Animals". */
  group: z.string(),
});

export const classSchema = z.object({
  ...base,
  type: z.literal("class"),
  primaryAbility: z.string(),
  hitDie: z.string(),
  coreTraits: z.array(labelValue),
  /** Intro, "Becoming a …" and other prose before the class features. */
  description: z.string(),
  featuresTable: tableSchema.extend({
    /** Labels spanning several columns, e.g. "Spell Slots per Spell Level" over the 1–9 columns (`start` is a column index). */
    headerGroups: z
      .array(
        z.object({
          label: z.string(),
          start: z.number().int(),
          span: z.number().int(),
        }),
      )
      .optional(),
  }),
  features: z.array(
    z.object({
      level: z.number().int(),
      name: z.string(),
      description: z.string(),
    }),
  ),
  /** Spell list tables by spell level (casters only). */
  spellList: z
    .array(z.object({ level: z.number().int(), spells: z.array(z.string()) }))
    .optional(),
  subclassIds: z.array(z.string()),
});

export const subclassSchema = z.object({
  ...base,
  type: z.literal("subclass"),
  className: z.string(),
  classId: z.string(),
  description: z.string(),
  features: z.array(
    z.object({
      level: z.number().int(),
      name: z.string(),
      description: z.string(),
    }),
  ),
});

export const equipmentSchema = z.object({
  ...base,
  type: z.literal("equipment"),
  category: z.string(),
  subcategory: z.string().optional(),
  cost: z.string().optional(),
  weight: z.string().optional(),
  weapon: z
    .object({
      damage: z.string(),
      properties: z.array(z.string()),
      mastery: z.string(),
    })
    .optional(),
  armor: z
    .object({ ac: z.string(), strength: z.string(), stealth: z.string() })
    .optional(),
  /** Extra labeled values (tool Ability/Utilize/Craft, vehicle speed, etc.). */
  fields: z.array(labelValue).optional(),
  description: z.string().optional(),
});

export const magicItemSchema = z.object({
  ...base,
  type: z.literal("magic-item"),
  /** Full italic line, e.g. "Armor (Plate Armor), Legendary (Requires Attunement)". */
  meta: z.string(),
  category: z.string(),
  rarities: z.array(z.string()),
  attunement: z.boolean(),
  description: z.string(),
  /** Stat blocks the item creates (Figurine of Wondrous Power, …). */
  statBlocks: z.array(z.lazy(() => statBlockSchema)).optional(),
});

export const featSchema = z.object({
  ...base,
  type: z.literal("feat"),
  /** Full italic line, e.g. "General Feat (Prerequisite: Level 4+)". */
  meta: z.string(),
  category: z.string(),
  prerequisite: z.string().optional(),
  description: z.string(),
});

export const conditionSchema = z.object({
  ...base,
  type: z.literal("condition"),
  description: z.string(),
});

export const ruleSchema = z.object({
  ...base,
  type: z.literal("rule"),
  /** Where the rule lives: "Rules Glossary", "Playing the Game › Combat", … */
  section: z.string(),
  /** Glossary tag, e.g. "Action", "Area of Effect", "Hazard". */
  tag: z.string().optional(),
  description: z.string(),
});

export const srdEntrySchema = z.discriminatedUnion("type", [
  classSchema,
  subclassSchema,
  spellSchema,
  monsterSchema,
  equipmentSchema,
  magicItemSchema,
  featSchema,
  conditionSchema,
  ruleSchema,
]);

export type SrdEntry = z.infer<typeof srdEntrySchema>;
export type SpellEntry = z.infer<typeof spellSchema>;
export type MonsterEntry = z.infer<typeof monsterSchema>;
export type ClassEntry = z.infer<typeof classSchema>;
export type SubclassEntry = z.infer<typeof subclassSchema>;
export type EquipmentEntry = z.infer<typeof equipmentSchema>;
export type MagicItemEntry = z.infer<typeof magicItemSchema>;
export type FeatEntry = z.infer<typeof featSchema>;
export type ConditionEntry = z.infer<typeof conditionSchema>;
export type RuleEntry = z.infer<typeof ruleSchema>;
export type EntryOfType<T extends SrdType> = Extract<SrdEntry, { type: T }>;

/** Lightweight entry for search, lists and collapsed cards. */
export const indexEntrySchema = z.object({
  id: z.string(),
  type: srdTypeSchema,
  slug: z.string(),
  name: z.string(),
  subtitle: z.string(),
  /** Numeric sort key within a type (spell level, CR); name is the tiebreaker. */
  sort: z.number().optional(),
  /** Filter values, e.g. { school: "Evocation", classes: ["Wizard"] }. */
  facets: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  ),
  /** Extra search terms. */
  keywords: z.string().optional(),
});
export type IndexEntry = z.infer<typeof indexEntrySchema>;
