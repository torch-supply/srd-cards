import Link from "next/link";
import { TypeIcon } from "@/components/cards/type-icon";
import { CARD_TYPES, REFERENCE_GROUPS } from "@/lib/srd/card-types";
import { cn } from "@/lib/utils";

/** Chips linking to each reference section, in labeled groups (home page, 404 page). */
export function ReferenceSections() {
  return (
    <dl className="grid gap-x-3 gap-y-2 sm:grid-cols-[auto_1fr] sm:items-baseline">
      {REFERENCE_GROUPS.map((group, i) => (
        <div key={group.label} className="contents">
          <dt
            className={cn(
              "text-sm text-muted-foreground",
              i > 0 && "mt-2 sm:mt-0",
            )}
          >
            {group.label}
          </dt>
          <dd className="flex flex-wrap gap-1.5">
            {group.types.map((t) => (
              <Link
                key={t}
                href={`/${CARD_TYPES[t].route}`}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm hover:bg-muted ${CARD_TYPES[t].className.fg}`}
              >
                <TypeIcon kind={t} />
                {CARD_TYPES[t].plural}
              </Link>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}
