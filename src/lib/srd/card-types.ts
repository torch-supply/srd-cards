import type { IconType } from "react-icons";
import {
  GiBackpack,
  GiCrossedChains,
  GiDragonHead,
  GiGemPendant,
  GiLaurels,
  GiQuillInk,
  GiRuleBook,
  GiSpellBook,
  GiStarMedal,
  GiVisoredHelm,
} from "react-icons/gi";
import type { SrdType } from "./schema";

export type CardKind = SrdType | "custom";

export interface CardTypeConfig {
  kind: CardKind;
  label: string;
  plural: string;
  /** Reference page path segment (/spells, /magic-items, …). Custom cards have none. */
  route?: string;
  icon: IconType;
  /** Full class names (Tailwind can't see dynamically built ones). */
  className: {
    accent: string;
    accentBg: string;
    fg: string;
    soft: string;
    border: string;
  };
}

export const CARD_TYPES: Record<CardKind, CardTypeConfig> = {
  class: {
    kind: "class",
    label: "Class",
    plural: "Classes",
    route: "classes",
    icon: GiVisoredHelm,
    className: {
      accent: "text-type-class",
      accentBg: "bg-type-class",
      fg: "text-type-class-fg",
      soft: "bg-type-class-soft",
      border: "border-type-class",
    },
  },
  subclass: {
    kind: "subclass",
    label: "Subclass",
    plural: "Subclasses",
    route: "subclasses",
    icon: GiLaurels,
    className: {
      accent: "text-type-subclass",
      accentBg: "bg-type-subclass",
      fg: "text-type-subclass-fg",
      soft: "bg-type-subclass-soft",
      border: "border-type-subclass",
    },
  },
  spell: {
    kind: "spell",
    label: "Spell",
    plural: "Spells",
    route: "spells",
    icon: GiSpellBook,
    className: {
      accent: "text-type-spell",
      accentBg: "bg-type-spell",
      fg: "text-type-spell-fg",
      soft: "bg-type-spell-soft",
      border: "border-type-spell",
    },
  },
  monster: {
    kind: "monster",
    label: "Monster",
    plural: "Monsters",
    route: "monsters",
    icon: GiDragonHead,
    className: {
      accent: "text-type-monster",
      accentBg: "bg-type-monster",
      fg: "text-type-monster-fg",
      soft: "bg-type-monster-soft",
      border: "border-type-monster",
    },
  },
  equipment: {
    kind: "equipment",
    label: "Equipment",
    plural: "Equipment",
    route: "equipment",
    icon: GiBackpack,
    className: {
      accent: "text-type-equipment",
      accentBg: "bg-type-equipment",
      fg: "text-type-equipment-fg",
      soft: "bg-type-equipment-soft",
      border: "border-type-equipment",
    },
  },
  "magic-item": {
    kind: "magic-item",
    label: "Magic Item",
    plural: "Magic Items",
    route: "magic-items",
    icon: GiGemPendant,
    className: {
      accent: "text-type-magic-item",
      accentBg: "bg-type-magic-item",
      fg: "text-type-magic-item-fg",
      soft: "bg-type-magic-item-soft",
      border: "border-type-magic-item",
    },
  },
  feat: {
    kind: "feat",
    label: "Feat",
    plural: "Feats",
    route: "feats",
    icon: GiStarMedal,
    className: {
      accent: "text-type-feat",
      accentBg: "bg-type-feat",
      fg: "text-type-feat-fg",
      soft: "bg-type-feat-soft",
      border: "border-type-feat",
    },
  },
  condition: {
    kind: "condition",
    label: "Condition",
    plural: "Conditions",
    route: "conditions",
    icon: GiCrossedChains,
    className: {
      accent: "text-type-condition",
      accentBg: "bg-type-condition",
      fg: "text-type-condition-fg",
      soft: "bg-type-condition-soft",
      border: "border-type-condition",
    },
  },
  rule: {
    kind: "rule",
    label: "Rule",
    plural: "Rules",
    route: "rules",
    icon: GiRuleBook,
    className: {
      accent: "text-type-rule",
      accentBg: "bg-type-rule",
      fg: "text-type-rule-fg",
      soft: "bg-type-rule-soft",
      border: "border-type-rule",
    },
  },
  custom: {
    kind: "custom",
    label: "Custom",
    plural: "Custom",
    icon: GiQuillInk,
    className: {
      accent: "text-type-custom",
      accentBg: "bg-type-custom",
      fg: "text-type-custom-fg",
      soft: "bg-type-custom-soft",
      border: "border-type-custom",
    },
  },
};

/** Reference section order in navigation and the browser panel. */
export const REFERENCE_TYPES: SrdType[] = [
  "class",
  "subclass",
  "spell",
  "monster",
  "equipment",
  "magic-item",
  "feat",
  "condition",
  "rule",
];

export function typeForRoute(route: string): SrdType | undefined {
  return REFERENCE_TYPES.find((t) => CARD_TYPES[t].route === route);
}

export function referenceHref(type: SrdType, slug?: string) {
  const base = `/${CARD_TYPES[type].route}`;
  return slug ? `${base}/${slug}` : base;
}
