import Link from "next/link";
import type { Collection } from "@/lib/model/schema";
import { referenceHref } from "@/lib/srd/card-types";
import type { SrdType } from "@/lib/srd/schema";

/**
 * An example's name, stacks, and cards as plain HTML, with SRD cards linking to
 * their reference pages. The board renders only in the browser, so the server
 * sends this instead (for crawlers and link previews); the board replaces it
 * once loaded. Laid out like the board to keep the swap from jumping.
 */
export function ExampleOutline({ collection }: { collection: Collection }) {
  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-[480px] flex-col">
      <p className="border-b bg-primary/5 px-6 py-2 text-sm">
        <strong className="font-semibold">Example:</strong> try anything —
        changes aren’t saved, and reloading resets it.{" "}
        <Link href="/examples" className="underline underline-offset-2">
          All examples
        </Link>
      </p>
      <header className="shrink-0 border-b px-6 py-3">
        <h1 className="font-serif text-2xl leading-tight font-semibold tracking-tight">
          {collection.name}
        </h1>
        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
          {collection.description}
        </p>
      </header>
      <div className="flex min-h-0 flex-1 items-start gap-3 overflow-hidden p-4">
        {collection.stacks.map((stack) => (
          <section
            key={stack.id}
            className="w-[340px] shrink-0 rounded-xl border bg-muted/40 p-3"
          >
            <h2 className="font-semibold">{stack.name}</h2>
            {stack.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {stack.description}
              </p>
            )}
            <ul className="mt-3 space-y-2">
              {stack.cards.map((card) => {
                const name = card.custom?.title ?? card.snapshot?.name;
                const subtitle =
                  card.custom?.subtitle ?? card.snapshot?.subtitle;
                const [type, slug] = (card.ref ?? "").split(":");
                return (
                  <li
                    key={card.id}
                    className="rounded-lg border bg-card px-3 py-2 text-sm"
                  >
                    {card.ref ? (
                      <Link
                        href={referenceHref(type as SrdType, slug)}
                        className="font-medium hover:underline"
                      >
                        {name}
                      </Link>
                    ) : (
                      <span className="font-medium">{name}</span>
                    )}
                    {subtitle && (
                      <span className="block text-xs text-muted-foreground">
                        {subtitle}
                      </span>
                    )}
                    {card.notes && (
                      <span className="mt-1 block text-xs">{card.notes}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
