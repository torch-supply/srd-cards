import Link from "next/link";
import { SRD_ATTRIBUTION } from "@/lib/attribution";
import { SOURCE_URL } from "@/lib/seo";

/** Linkifies the two URLs in the attribution statement without changing its text. */
function Attribution() {
  const parts = SRD_ATTRIBUTION.split(/(https:\/\/\S+?)(?=[.,]?(?:\s|$))/g);
  return (
    <p>
      {parts.map((part, i) =>
        part.startsWith("https://") ? (
          <a
            key={i}
            href={part}
            className="underline underline-offset-2 hover:text-foreground"
            rel="noreferrer"
            target="_blank"
          >
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
        <div className="max-w-3xl">
          <Attribution />
        </div>
        <div className="flex shrink-0 gap-4">
          <Link
            href="/about"
            className="underline underline-offset-2 hover:text-foreground"
          >
            About &amp; credits
          </Link>
          <a
            href={SOURCE_URL}
            className="underline underline-offset-2 hover:text-foreground"
            rel="noreferrer"
            target="_blank"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
