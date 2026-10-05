import Link from "next/link";
import { EXAMPLES, type Example, exampleCardCount } from "@/lib/examples";

/** Example cards linking to /examples/<slug> (all of them unless `examples` is given). */
export function ExampleList({ examples = EXAMPLES }: { examples?: Example[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {examples.map((e) => {
        const cards = exampleCardCount(e);
        return (
          <li key={e.slug}>
            <Link
              href={`/examples/${e.slug}`}
              className="block h-full rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20"
            >
              <h3 className="font-serif text-lg font-semibold">{e.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{e.summary}</p>
              <p className="mt-3 text-xs text-muted-foreground tabular-nums">
                {e.stacks.length} stacks · {cards} cards
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
