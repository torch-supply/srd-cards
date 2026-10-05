/**
 * Built-in example collections, shown at /examples/<slug>. They are never
 * stored: the board opens them in a sandbox, and "Save a copy" turns one into a
 * regular collection. Cards name SRD entries by id; names are filled in from
 * the SRD index when the page is built (see `buildExample`).
 */

export type ExampleCard =
  | string
  | { ref: string; quantity?: number; notes?: string }
  | {
      custom: { title: string; subtitle?: string; body: string };
      notes?: string;
      /** SRD entry the body is quoted from, word for word (a unit test checks it still matches). */
      quotes?: string;
    };

export interface ExampleStack {
  name: string;
  description?: string;
  cards: ExampleCard[];
}

export interface Example {
  slug: string;
  name: string;
  /** One line, shown on the examples index and the home page. */
  summary: string;
  description: string;
  stacks: ExampleStack[];
}

export const EXAMPLES: Example[] = [
  {
    slug: "adventuring-party",
    name: "Adventuring Party (example)",
    summary:
      "Three level 1 characters, one stack each: species, background, class, feats, spells, and gear.",
    description:
      "One stack per character, so each player has their species, background, class, feats, spells, and gear in one place. Notes say where each feat comes from. Expand a card to read it; drag cards between stacks.",
    stacks: [
      {
        name: "Brakka — Orc Fighter",
        description:
          "Tip: click a card to expand it. The Fighter card has the full class table and features.",
        cards: [
          "class:fighter",
          { ref: "subclass:champion", notes: "Unlocks at level 3." },
          "species:orc",
          "background:soldier",
          {
            ref: "feat:defense",
            notes: "From the Fighter’s Fighting Style feature.",
          },
          {
            ref: "feat:savage-attacker",
            notes: "From the Soldier background.",
          },
          "equipment:longsword",
          "equipment:chain-mail",
          "equipment:shield",
          "equipment:dungeoneers-pack",
        ],
      },
      {
        name: "Ilsa — Elf Wizard",
        description:
          "Tip: spells show their casting time, range, and components when expanded.",
        cards: [
          "class:wizard",
          { ref: "subclass:evoker", notes: "Unlocks at level 3." },
          {
            ref: "species:elf",
            notes:
              "High Elf lineage: Detect Magic at level 3, Misty Step at level 5.",
          },
          "background:sage",
          {
            ref: "feat:magic-initiate",
            notes: "Magic Initiate (Wizard), from the Sage background.",
          },
          {
            ref: "spell:prestidigitation",
            notes: "From the High Elf lineage.",
          },
          "spell:fire-bolt",
          "spell:magic-missile",
          "spell:shield",
          "spell:mage-armor",
          "spell:sleep",
          "equipment:quarterstaff",
          "equipment:arcane-focus",
          "equipment:scholars-pack",
        ],
      },
      {
        name: "Wren — Human Rogue",
        description:
          "Tip: a card can have a quantity. Expand the Dagger card to change it.",
        cards: [
          "class:rogue",
          { ref: "subclass:thief", notes: "Unlocks at level 3." },
          "species:human",
          "background:criminal",
          { ref: "feat:alert", notes: "From the Criminal background." },
          {
            ref: "feat:skilled",
            notes: "From the Human’s Versatile trait (any Origin feat).",
          },
          { ref: "equipment:dagger", quantity: 2 },
          "equipment:shortbow",
          "equipment:leather-armor",
          "equipment:thieves-tools",
          "equipment:burglars-pack",
        ],
      },
      {
        name: "Party conditions",
        description:
          "Conditions that come up often. Drag one onto a character while it applies.",
        cards: [
          "condition:poisoned",
          "condition:frightened",
          "condition:prone",
          "condition:grappled",
        ],
      },
    ],
  },
  {
    slug: "the-old-mine",
    name: "The Old Mine (example)",
    summary:
      "A short adventure: one stack per encounter, with monsters and loot.",
    description:
      "Goblins have moved into an abandoned mine. Each stack is an encounter, in the order the party is likely to meet them; the last stack is the treasure.",
    stacks: [
      {
        name: "1. Mine entrance",
        description:
          "Two goblins keep watch with their wolves. Tip: expand a monster to see its full stat block.",
        cards: [
          { ref: "monster:goblin-warrior", quantity: 2 },
          { ref: "monster:wolf", quantity: 2 },
        ],
      },
      {
        name: "2. Collapsed tunnel",
        description:
          "A spider nest blocks the way. The rubble is Difficult Terrain.",
        cards: [
          { ref: "monster:giant-spider" },
          { ref: "monster:swarm-of-insects", quantity: 2 },
          "rule:difficult-terrain",
        ],
      },
      {
        name: "3. Goblin hall",
        description:
          "The goblin boss and a bugbear bodyguard. Tip: drag a card to reorder it, or move it to another stack.",
        cards: [
          "monster:goblin-boss",
          "monster:bugbear-warrior",
          { ref: "monster:goblin-minion", quantity: 4 },
        ],
      },
      {
        name: "Loot",
        description:
          "Treasure found in the hall. The Map Fragment is a custom card: use “Custom card” in the toolbar to write your own.",
        cards: [
          { ref: "equipment:potion-of-healing", quantity: 2 },
          "magic-item:cloak-of-elvenkind",
          "magic-item:bag-of-holding",
          {
            custom: {
              title: "Map Fragment",
              subtitle: "Homebrew · Treasure",
              body: "A torn page from a surveyor’s journal. It shows a second shaft below the goblin hall, marked **“DO NOT OPEN.”**",
            },
          },
        ],
      },
    ],
  },
  {
    slug: "dungeon-crawl-rules",
    name: "Dungeon Crawl Rules (example)",
    summary:
      "Rules to keep at hand while exploring a dungeon, grouped by situation.",
    description:
      "A quick reference for a dungeon crawl: the rules for sneaking, fighting in tight spaces, and dealing with traps, grouped so you can find them at the table.",
    stacks: [
      {
        name: "Light & sneaking",
        description:
          "Tip: use the search panel on the right to add more rules.",
        cards: [
          "rule:hide",
          "rule:search",
          "rule:darkvision",
          "rule:dim-light",
          "rule:darkness",
          "rule:heavily-obscured",
          "rule:surprise",
        ],
      },
      {
        name: "Fighting in tight spaces",
        cards: [
          "rule:cover",
          "rule:opportunity-attacks",
          "rule:grappling",
          "rule:unarmed-strike",
          "condition:prone",
        ],
      },
      {
        name: "Traps & terrain",
        cards: [
          "rule:traps",
          "rule:difficult-terrain",
          "rule:falling",
          "rule:climbing",
          "rule:jumping",
          "rule:breaking-objects",
        ],
      },
      {
        name: "Resting",
        cards: ["rule:short-rest", "rule:long-rest"],
      },
    ],
  },
  {
    slug: "session-zero",
    name: "Session Zero (example)",
    summary:
      "Character creation, step by step: the rules, then the choices for each step.",
    description:
      "Everything a new player needs to build a level 1 character, in order. Work left to right, and drag the options you pick into “My character.”",
    stacks: [
      {
        name: "1. How to build a character",
        description: "Read these in order.",
        cards: [
          "rule:step-1-choose-class",
          "rule:step-2-character-origin",
          "rule:step-3-ability-scores",
          "rule:step-4-alignment",
          "rule:step-5-character-creation-details",
        ],
      },
      {
        name: "2. Pick a class",
        description:
          "Four classes that are easy to start with. Search the panel for the other eight.",
        cards: ["class:fighter", "class:rogue", "class:cleric", "class:wizard"],
      },
      {
        name: "3. Background",
        description:
          "Pick one. A background gives you an Origin feat, two skills, a tool, and starting equipment. Its feat is here too.",
        cards: [
          "rule:character-backgrounds",
          "background:acolyte",
          "background:criminal",
          "background:sage",
          "background:soldier",
          { ref: "feat:magic-initiate", notes: "From Acolyte or Sage." },
          { ref: "feat:alert", notes: "From Criminal." },
          { ref: "feat:savage-attacker", notes: "From Soldier." },
          {
            ref: "rule:creating-a-background",
            notes: "None of these fit? Ask your GM about building your own.",
          },
        ],
      },
      {
        name: "4. Species",
        description:
          "Pick one. Your species sets your size and Speed and gives you special traits. Then choose two languages.",
        cards: [
          "rule:character-species",
          "species:dragonborn",
          "species:dwarf",
          "species:elf",
          "species:gnome",
          "species:goliath",
          "species:halfling",
          {
            ref: "species:human",
            notes: "Versatile gives an Origin feat; Skilled is recommended.",
          },
          "species:orc",
          "species:tiefling",
          { ref: "feat:skilled", notes: "For a Human’s Versatile trait." },
          "rule:languages",
        ],
      },
      {
        name: "5. Starting gear",
        description:
          "Your class and background each give starting equipment, or gold instead. Each class above starts with one of these packs.",
        cards: [
          { ref: "equipment:dungeoneers-pack", notes: "Fighter." },
          { ref: "equipment:burglars-pack", notes: "Rogue." },
          { ref: "equipment:priests-pack", notes: "Cleric." },
          { ref: "equipment:scholars-pack", notes: "Wizard." },
        ],
      },
      {
        name: "My character",
        description:
          "Drag the cards you choose here, then save a copy to keep your character.",
        cards: [],
      },
    ],
  },
  {
    slug: "shopping-trip",
    name: "Shopping Trip (example)",
    summary:
      "A trip to market: one stack per shop, with quantities and notes on who it’s for.",
    description:
      "The party restocks before heading north. Prices show on each card; quantities say how many to buy, and notes say who it’s for.",
    stacks: [
      {
        name: "General store",
        description: "Tip: expand a card to change its quantity or notes.",
        cards: [
          { ref: "equipment:torch", quantity: 10 },
          {
            ref: "equipment:rations",
            quantity: 10,
            notes: "Ten days on the road.",
          },
          { ref: "equipment:rope", quantity: 2 },
          {
            ref: "equipment:bedroll",
            quantity: 2,
            notes: "For Ilsa and Wren.",
          },
          { ref: "equipment:waterskin", quantity: 3 },
          "equipment:tinderbox",
          { ref: "equipment:oil", quantity: 4, notes: "For the lantern." },
        ],
      },
      {
        name: "Alchemist",
        cards: [
          {
            ref: "equipment:potion-of-healing",
            quantity: 3,
            notes: "One each.",
          },
          { ref: "equipment:antitoxin", quantity: 2 },
          { ref: "equipment:alchemists-fire", quantity: 2 },
          { ref: "equipment:holy-water", notes: "For the crypt." },
        ],
      },
      {
        name: "Outfitter",
        cards: [
          { ref: "equipment:chain-shirt", notes: "Ilsa’s first armor?" },
          "equipment:crowbar",
          { ref: "equipment:caltrops", quantity: 2 },
          "equipment:hunting-trap",
          "equipment:grappling-hook",
        ],
      },
      {
        name: "Bought",
        description: "Drag items here once they’re paid for.",
        cards: [],
      },
    ],
  },
  {
    slug: "wild-shape",
    name: "Wild Shape Field Guide (example)",
    summary:
      "A druid’s beast forms, grouped by the druid level that unlocks them.",
    description:
      "Beast forms a druid can learn with Wild Shape, grouped by the druid level that unlocks them (see the Beast Shapes table on the Druid card). Expand a form mid-combat to read its stat block.",
    stacks: [
      {
        name: "Druid",
        cards: [
          {
            ref: "class:druid",
            notes:
              "Wild Shape is a level 2 feature. Its Beast Shapes table sets how many forms you know and their maximum CR.",
          },
        ],
      },
      {
        name: "Level 2 · CR ¼, no flying",
        description:
          "The Druid card recommends the Rat, Riding Horse, Spider, and Wolf as first forms.",
        cards: [
          "monster:rat",
          "monster:riding-horse",
          "monster:spider",
          "monster:wolf",
          "monster:boar",
          "monster:panther",
          "monster:giant-badger",
          "monster:constrictor-snake",
        ],
      },
      {
        name: "Level 4 · CR ½, no flying",
        cards: [
          "monster:ape",
          "monster:black-bear",
          "monster:crocodile",
          "monster:warhorse",
          "monster:giant-goat",
          "monster:reef-shark",
        ],
      },
      {
        name: "Level 8 · CR 1, flying allowed",
        description: "From level 8, forms with a Fly Speed are allowed too.",
        cards: [
          "monster:brown-bear",
          "monster:dire-wolf",
          "monster:giant-spider",
          "monster:lion",
          "monster:tiger",
          "monster:giant-octopus",
          "monster:giant-bat",
          "monster:pteranodon",
          "monster:giant-wasp",
        ],
      },
    ],
  },
  {
    slug: "the-lichs-spirit-jar",
    name: "The Lich’s Spirit Jar (example)",
    summary:
      "One villain prepared in depth: stat block, every spell, minions, and treasure.",
    description:
      "A boss fight against a lich in its lair. A destroyed lich reforms if it has a spirit jar, so the jar is the real goal. Every spell the lich can cast is here, so nothing needs looking up mid-fight.",
    stacks: [
      {
        name: "The lich",
        cards: [
          "monster:lich",
          {
            custom: {
              title: "The Spirit Jar",
              subtitle: "Homebrew · Plot item",
              body: "A canopic jar of black glass, sealed with silver wire and hidden in the deepest vault of the lair. While it is intact, the lich reforms after it is destroyed (see the lich’s **Spirit Jar** trait).\n\nThe vault is guarded by the wraiths.",
            },
          },
        ],
      },
      {
        name: "Spells: at will",
        description:
          "Tip: card notes show how often the lich can cast each one.",
        cards: [
          "spell:detect-magic",
          "spell:detect-thoughts",
          "spell:dispel-magic",
          { ref: "spell:fireball", notes: "Cast as the level 5 version." },
          "spell:invisibility",
          {
            ref: "spell:lightning-bolt",
            notes: "Cast as the level 5 version.",
          },
          "spell:mage-hand",
          "spell:prestidigitation",
          { ref: "spell:counterspell", notes: "Reaction (Protective Magic)." },
          { ref: "spell:shield", notes: "Reaction (Protective Magic)." },
        ],
      },
      {
        name: "Spells: limited",
        cards: [
          { ref: "spell:animate-dead", notes: "2/day." },
          { ref: "spell:dimension-door", notes: "2/day." },
          { ref: "spell:plane-shift", notes: "2/day." },
          { ref: "spell:chain-lightning", notes: "1/day." },
          { ref: "spell:finger-of-death", notes: "1/day." },
          { ref: "spell:power-word-kill", notes: "1/day." },
          { ref: "spell:scrying", notes: "1/day." },
        ],
      },
      {
        name: "Minions",
        cards: [
          {
            ref: "monster:wraith",
            quantity: 2,
            notes: "Guarding the spirit jar.",
          },
          { ref: "monster:mummy", quantity: 2 },
          {
            ref: "monster:skeleton",
            quantity: 6,
            notes: "Raised with Animate Dead.",
          },
          { ref: "monster:zombie", quantity: 4 },
        ],
      },
      {
        name: "Treasure",
        cards: [
          "magic-item:staff-of-power",
          "magic-item:wand-of-paralysis",
          "magic-item:ring-of-protection",
          "magic-item:cloak-of-protection",
        ],
      },
    ],
  },
  {
    slug: "innate-magic",
    name: "Innate Magic (example)",
    summary:
      "Spells that elves, gnomes, and tieflings get from their species, lineage by lineage.",
    description:
      "Some species grant spells: elves and tieflings choose a lineage or legacy that teaches a cantrip at level 1 and new spells at character levels 3 and 5; gnomes choose a lineage that teaches cantrips (and Speak with Animals, for forest gnomes). One stack per species; each spell’s note says which lineage grants it and when.",
    stacks: [
      {
        name: "Elf",
        description: "Elven Lineage: Drow, High Elf, or Wood Elf.",
        cards: [
          "species:elf",
          { ref: "spell:dancing-lights", notes: "Drow · level 1." },
          { ref: "spell:faerie-fire", notes: "Drow · level 3." },
          { ref: "spell:darkness", notes: "Drow · level 5." },
          { ref: "spell:prestidigitation", notes: "High Elf · level 1." },
          { ref: "spell:detect-magic", notes: "High Elf · level 3." },
          { ref: "spell:misty-step", notes: "High Elf · level 5." },
          { ref: "spell:druidcraft", notes: "Wood Elf · level 1." },
          { ref: "spell:longstrider", notes: "Wood Elf · level 3." },
          { ref: "spell:pass-without-trace", notes: "Wood Elf · level 5." },
        ],
      },
      {
        name: "Gnome",
        description: "Gnomish Lineage: Forest Gnome or Rock Gnome.",
        cards: [
          "species:gnome",
          { ref: "spell:minor-illusion", notes: "Forest Gnome." },
          {
            ref: "spell:speak-with-animals",
            notes:
              "Forest Gnome · always prepared, castable without a slot (Proficiency Bonus times per Long Rest).",
          },
          { ref: "spell:mending", notes: "Rock Gnome." },
          {
            ref: "spell:prestidigitation",
            notes:
              "Rock Gnome · also builds Tiny clockwork devices (see the Gnome card).",
          },
        ],
      },
      {
        name: "Tiefling",
        description:
          "Fiendish Legacy: Abyssal, Chthonic, or Infernal. Every tiefling also knows Thaumaturgy.",
        cards: [
          "species:tiefling",
          {
            ref: "spell:thaumaturgy",
            notes: "Every tiefling (Otherworldly Presence).",
          },
          { ref: "spell:poison-spray", notes: "Abyssal · level 1." },
          { ref: "spell:ray-of-sickness", notes: "Abyssal · level 3." },
          { ref: "spell:hold-person", notes: "Abyssal · level 5." },
          { ref: "spell:chill-touch", notes: "Chthonic · level 1." },
          { ref: "spell:false-life", notes: "Chthonic · level 3." },
          { ref: "spell:ray-of-enfeeblement", notes: "Chthonic · level 5." },
          { ref: "spell:fire-bolt", notes: "Infernal · level 1." },
          { ref: "spell:hellish-rebuke", notes: "Infernal · level 3." },
          { ref: "spell:darkness", notes: "Infernal · level 5." },
        ],
      },
    ],
  },
  {
    slug: "chromatic-dragons",
    name: "Chromatic Dragons Compared (example)",
    summary: "The five chromatic dragons at every age, side by side.",
    description:
      "One stack per age, with the five chromatic dragons in each. Expand the same dragon in two stacks to compare how it grows.",
    stacks: [
      {
        name: "Wyrmlings",
        cards: [
          "monster:black-dragon-wyrmling",
          "monster:blue-dragon-wyrmling",
          "monster:green-dragon-wyrmling",
          "monster:red-dragon-wyrmling",
          "monster:white-dragon-wyrmling",
        ],
      },
      {
        name: "Young",
        cards: [
          "monster:young-black-dragon",
          "monster:young-blue-dragon",
          "monster:young-green-dragon",
          "monster:young-red-dragon",
          "monster:young-white-dragon",
        ],
      },
      {
        name: "Adult",
        cards: [
          "monster:adult-black-dragon",
          "monster:adult-blue-dragon",
          "monster:adult-green-dragon",
          "monster:adult-red-dragon",
          "monster:adult-white-dragon",
        ],
      },
      {
        name: "Ancient",
        cards: [
          "monster:ancient-black-dragon",
          "monster:ancient-blue-dragon",
          "monster:ancient-green-dragon",
          "monster:ancient-red-dragon",
          "monster:ancient-white-dragon",
        ],
      },
      {
        name: "Dragonborn",
        description:
          "Playing a dragonborn? Your Draconic Ancestry sets your Breath Weapon’s damage type, the same as your ancestor’s breath.",
        cards: [
          {
            ref: "species:dragonborn",
            notes:
              "Chromatic ancestors: Black (Acid), Blue (Lightning), Green (Poison), Red (Fire), White (Cold).",
          },
        ],
      },
    ],
  },
  {
    slug: "mysterious-deck",
    name: "Mysterious Deck (example)",
    summary:
      "A magic deck as custom cards: drag each one into “Drawn” as players draw it.",
    description:
      "The common 13-card Mysterious Deck. Each card is a custom card holding its effect, word for word from the SRD. When a player draws one, drag it into “Drawn.”",
    stacks: [
      {
        name: "The deck",
        cards: [
          "magic-item:mysterious-deck",
          { ref: "monster:knight", notes: "Stat block for the Knight card." },
        ],
      },
      {
        name: "13 cards",
        description:
          "The Avatar of Death (Skull card) stat block is on the Mysterious Deck card.",
        cards: [
          {
            custom: {
              title: "Euryale",
              subtitle: "Mysterious Deck card",
              body: "The card’s medusa-like visage curses you. You take a −2 penalty to saving throws while cursed in this way. Only a god or the magic of the Fates card can end this curse.",
            },
            quotes: "magic-item:mysterious-deck",
          },
          {
            custom: {
              title: "Flames",
              subtitle: "Mysterious Deck card",
              body: "A powerful devil becomes your enemy. The devil seeks your ruin and torments you, savoring your suffering before attempting to slay you. This enmity lasts until either you or the devil dies.",
            },
            quotes: "magic-item:mysterious-deck",
          },
          {
            custom: {
              title: "Jester",
              subtitle: "Mysterious Deck card",
              body: "You have Advantage on D20 Tests for the next 72 hours, or you can draw two additional cards beyond your declared draws.",
            },
            quotes: "magic-item:mysterious-deck",
          },
          {
            custom: {
              title: "Key",
              subtitle: "Mysterious Deck card",
              body: "A Rare or rarer magic weapon with which you are proficient appears on your person. The GM chooses the weapon.",
            },
            quotes: "magic-item:mysterious-deck",
          },
          {
            custom: {
              title: "Knight",
              subtitle: "Mysterious Deck card",
              body: "You gain the service of a **Knight**, who magically appears in an unoccupied space you choose within 30 feet of yourself. The knight has the same alignment as you and serves you loyally until death, believing the two of you have been drawn together by fate. Work with your GM to create a name and backstory for this NPC. The GM can use a different stat block to represent the knight, as desired.",
            },
            quotes: "magic-item:mysterious-deck",
          },
          {
            custom: {
              title: "Moon",
              subtitle: "Mysterious Deck card",
              body: "You gain the ability to cast *Wish* 1d3 times.",
            },
            quotes: "magic-item:mysterious-deck",
          },
          {
            custom: {
              title: "Rogue",
              subtitle: "Mysterious Deck card",
              body: "An NPC of the GM’s choice becomes Hostile toward you. You don’t know the identity of this NPC until they or someone else reveals it. Nothing less than a *Wish* spell or divine intervention can end the NPC’s hostility toward you.",
            },
            quotes: "magic-item:mysterious-deck",
          },
          {
            custom: {
              title: "Ruin",
              subtitle: "Mysterious Deck card",
              body: "All forms of wealth that you carry or own, other than magic items, are lost to you. Portable property vanishes. Businesses, buildings, and land you own are lost in a way that alters reality the least. Any documentation that proves you should own something lost to this card also disappears.",
            },
            quotes: "magic-item:mysterious-deck",
          },
          {
            custom: {
              title: "Skull",
              subtitle: "Mysterious Deck card",
              body: "An **Avatar of Death** (see the accompanying stat block) appears in an unoccupied space as close to you as possible. The avatar targets only you with its attacks, appearing as a ghostly skeleton clad in a tattered black robe and carrying a spectral scythe. The avatar disappears when it drops to 0 Hit Points or you die. If an ally of yours deals damage to the avatar, that ally summons another **Avatar of Death**. The new avatar appears in an unoccupied space as close to that ally as possible and targets only that ally with its attacks. You and your allies can each summon only one avatar as a consequence of this draw. A creature slain by an avatar can’t be restored to life.",
            },
            quotes: "magic-item:mysterious-deck",
          },
          {
            custom: {
              title: "Star",
              subtitle: "Mysterious Deck card",
              body: "Increase one of your ability scores by 2, to a maximum of 24.",
            },
            quotes: "magic-item:mysterious-deck",
          },
          {
            custom: {
              title: "Sun",
              subtitle: "Mysterious Deck card",
              body: "A magic item (chosen by the GM) appears on your person. In addition, you gain 10 Temporary Hit Points daily at dawn until you die.",
            },
            quotes: "magic-item:mysterious-deck",
          },
          {
            custom: {
              title: "Throne",
              subtitle: "Mysterious Deck card",
              body: "You gain proficiency and Expertise in your choice of History, Insight, Intimidation, or Persuasion. In addition, you gain rightful ownership of a small keep somewhere in the world. However, the keep is currently home to one or more monsters, which must be cleared out before you can claim the keep as yours.",
            },
            quotes: "magic-item:mysterious-deck",
          },
          {
            custom: {
              title: "Void",
              subtitle: "Mysterious Deck card",
              body: "Your soul is drawn from your body and contained in an object in a place of the GM’s choice. One or more powerful beings guard the place. While your soul is trapped in this way, your body is inert, ceases aging, and requires no food, air, or water. A *Wish* spell can’t return your soul to your body, but the spell reveals the location of the object that holds your soul. You draw no more cards.",
            },
            quotes: "magic-item:mysterious-deck",
          },
        ],
      },
      {
        name: "Drawn",
        description:
          "Drag cards here as they’re drawn. Except for the Jester, a drawn card returns to the deck.",
        cards: [],
      },
    ],
  },
  {
    slug: "cursed-and-weird-items",
    name: "Cursed & Weird Items (example)",
    summary: "Cursed and unpredictable magic items, with the rules for curses.",
    description:
      "A GM’s drawer of trouble: items that curse their owners, and items nobody can predict. Hand one out when the party gets too comfortable.",
    stacks: [
      {
        name: "Rules",
        cards: ["rule:curses", "rule:cursed-items"],
      },
      {
        name: "Cursed",
        cards: [
          "magic-item:berserker-axe",
          "magic-item:armor-of-vulnerability",
          "magic-item:demon-armor",
          "magic-item:shield-of-missile-attraction",
        ],
      },
      {
        name: "Unpredictable",
        cards: [
          "magic-item:wand-of-wonder",
          "magic-item:bag-of-beans",
          "magic-item:mysterious-deck",
          "magic-item:deck-of-illusions",
          "magic-item:bag-of-tricks",
        ],
      },
      {
        name: "Handle with care",
        cards: [
          "magic-item:sphere-of-annihilation",
          "magic-item:talisman-of-the-sphere",
          {
            ref: "magic-item:portable-hole",
            notes:
              "Never put a Bag of Holding inside it, or the other way round.",
          },
          "magic-item:bag-of-holding",
          "magic-item:immovable-rod",
        ],
      },
    ],
  },
  {
    slug: "summoners-circle",
    name: "Summoner’s Circle (example)",
    summary:
      "Summoning spells and what they bring: familiars, steeds, and spirits.",
    description:
      "What each summoning spell brings to the table. Some summons use a creature’s stat block, some carry their own stat block inside the spell, and some need no stat block at all.",
    stacks: [
      {
        name: "Find Familiar",
        description:
          "Your familiar uses one of these stat blocks, but is a Celestial, Fey, or Fiend instead of a Beast.",
        cards: [
          "spell:find-familiar",
          "monster:bat",
          "monster:cat",
          "monster:frog",
          "monster:hawk",
          "monster:lizard",
          "monster:octopus",
          "monster:owl",
          "monster:rat",
          "monster:raven",
          "monster:spider",
          "monster:weasel",
        ],
      },
      {
        name: "Stat block inside the spell",
        description:
          "Tip: expand these spells. The creature’s stat block is part of the spell card.",
        cards: [
          "spell:find-steed",
          "spell:summon-dragon",
          "spell:giant-insect",
          "spell:animate-objects",
        ],
      },
      {
        name: "No stat block needed",
        description:
          "These spirits are part of the spell’s effect: everything they do is in the spell’s description.",
        cards: [
          "spell:conjure-minor-elementals",
          "spell:conjure-woodland-beings",
          "spell:conjure-animals",
          "spell:conjure-elemental",
          "spell:conjure-fey",
          "spell:conjure-celestial",
        ],
      },
    ],
  },
];

export function findExample(slug: string): Example | undefined {
  return EXAMPLES.find((e) => e.slug === slug);
}

/** `count` examples in random order (the home page shows a different few each visit). */
export function randomExamples(count: number): Example[] {
  const pool = [...EXAMPLES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export function exampleCardCount(example: Example): number {
  return example.stacks.reduce((n, s) => n + s.cards.length, 0);
}
