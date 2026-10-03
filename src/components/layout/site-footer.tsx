import Link from "next/link";
import { SRD_ATTRIBUTION } from "@/lib/attribution";

/** Linkifies the two URLs in the attribution statement without changing its text. */
function Attribution() {
  const parts = SRD_ATTRIBUTION.split(/(https:\/\/\S+?)(?=[.,]?(?:\s|$))/g);
  return (
    <p>
      {parts.map((part, i) =>
        part.startsWith("https://") ? (
          <a key={i} href={part} className="underline underline-offset-2 hover:text-foreground" rel="noreferrer" target="_blank">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </p>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-6 py-6 md:flex-row md:items-start md:justify-between md:gap-8">
        <div className="max-w-3xl space-y-2">
          <Attribution />
          <p>srd.cards is 5E compatible.</p>
        </div>
        <Link href="/about" className="shrink-0 underline underline-offset-2 hover:text-foreground">
          About &amp; credits
        </Link>
      </div>
    </footer>
  );
}
