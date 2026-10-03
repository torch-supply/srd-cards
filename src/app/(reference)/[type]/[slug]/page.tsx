import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EntryDetail } from "@/components/cards/details/entry-detail";
import { TypeChip } from "@/components/cards/type-icon";
import { AddToCollectionButton } from "@/components/reference/add-to-collection";
import { CARD_TYPES, REFERENCE_TYPES, referenceHref, typeForRoute } from "@/lib/srd/card-types";
import { getEntries, getRenderedEntry } from "@/lib/srd/server";

export const dynamicParams = false;

export function generateStaticParams() {
  return REFERENCE_TYPES.flatMap((t) => getEntries(t).map((e) => ({ type: CARD_TYPES[t].route!, slug: e.slug })));
}

async function load(params: PageProps<"/[type]/[slug]">["params"]) {
  const { type: route, slug } = await params;
  const type = typeForRoute(route);
  return type ? getRenderedEntry(type, slug) : undefined;
}

export async function generateMetadata({ params }: PageProps<"/[type]/[slug]">): Promise<Metadata> {
  const entry = await load(params);
  if (!entry) return {};
  return { title: entry.name, description: `${entry.subtitle} — System Reference Document 5.2.1.` };
}

export default async function ReferenceEntryPage({ params }: PageProps<"/[type]/[slug]">) {
  const entry = await load(params);
  if (!entry) notFound();
  const config = CARD_TYPES[entry.type];
  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-8">
      <nav className="mb-4 text-sm text-muted-foreground">
        <Link href={referenceHref(entry.type)} className="hover:text-foreground hover:underline">
          {config.plural}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">{entry.name}</span>
      </nav>
      <header className={`mb-6 flex items-start gap-3 border-l-4 pl-4 ${config.className.border}`}>
        <TypeChip kind={entry.type} className="mt-1 size-10 [&_svg]:size-6" />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight">{entry.name}</h1>
          <p className="text-sm text-muted-foreground">
            {entry.subtitle} <span className="mx-1 opacity-50">·</span> SRD 5.2.1 p. {entry.page}
          </p>
        </div>
        <AddToCollectionButton entry={{ id: entry.id, name: entry.name, subtitle: entry.subtitle }} />
      </header>
      <EntryDetail entry={entry} />
    </article>
  );
}
