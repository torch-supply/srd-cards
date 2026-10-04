import Link from "next/link";
import { GiCardRandom } from "react-icons/gi";
import { CARD_TYPES, REFERENCE_TYPES } from "@/lib/srd/card-types";
import { ReferenceNav } from "./reference-nav";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  const links = REFERENCE_TYPES.map((t) => ({
    href: `/${CARD_TYPES[t].route}`,
    label: CARD_TYPES[t].plural,
    type: t,
  }));
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-serif text-xl font-semibold tracking-tight"
        >
          <GiCardRandom className="size-6 text-primary" aria-hidden />
          srd.cards
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/"
            className="rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Collections
          </Link>
          <ReferenceNav links={links} />
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
