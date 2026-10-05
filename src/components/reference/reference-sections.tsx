import Link from "next/link";
import { TypeIcon } from "@/components/cards/type-icon";
import { CARD_TYPES, REFERENCE_TYPES } from "@/lib/srd/card-types";

/** A chip linking to each reference section (home page, 404 page). */
export function ReferenceSections() {
  return (
    <div className="flex flex-wrap gap-1.5">
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
  );
}
