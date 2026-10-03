import Link from "next/link";
import { TypeIcon } from "@/components/cards/type-icon";
import { CollectionsHome } from "@/components/collections/collections-home";
import { CARD_TYPES, REFERENCE_TYPES } from "@/lib/srd/card-types";

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 px-6 py-10">
      <section className="space-y-3">
        <h1 className="font-serif text-4xl font-semibold tracking-tight">srd.cards</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Browse the System Reference Document 5.2.1 and organize spells, monsters, classes, and equipment into stacks
          of cards — for a character, an encounter, or a whole campaign. Everything is saved in your browser.
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {REFERENCE_TYPES.map((t) => (
            <Link
              key={t}
              href={`/${CARD_TYPES[t].route}`}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm hover:bg-muted ${CARD_TYPES[t].className.fg}`}
            >
              <TypeIcon kind={t} />
              {CARD_TYPES[t].plural}
            </Link>
          ))}
        </div>
      </section>
      <CollectionsHome />
    </div>
  );
}
