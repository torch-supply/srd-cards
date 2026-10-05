import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TypeChip } from "@/components/cards/type-icon";
import { ReferenceList } from "@/components/reference/reference-list";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd, HOME_CRUMB, ogImage, pageMetadata } from "@/lib/seo";
import {
  CARD_TYPES,
  REFERENCE_TYPES,
  referenceHref,
  typeForRoute,
} from "@/lib/srd/card-types";
import { getIndexForType } from "@/lib/srd/server";

export const dynamicParams = false;

export function generateStaticParams() {
  return REFERENCE_TYPES.map((t) => ({ type: CARD_TYPES[t].route! }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[type]">): Promise<Metadata> {
  const type = typeForRoute((await params).type);
  if (!type) return {};
  const { plural, route } = CARD_TYPES[type];
  return pageMetadata({
    title: `${plural} — SRD 5.2.1`,
    description: `All ${getIndexForType(type).length} ${plural.toLowerCase()} in the System Reference Document 5.2.1, with search and filters. Each entry has its full SRD text and page number.`,
    path: referenceHref(type),
    image: ogImage(
      route!,
      `${plural} from the System Reference Document 5.2.1`,
    ),
  });
}

export default async function ReferenceListPage({
  params,
}: PageProps<"/[type]">) {
  const type = typeForRoute((await params).type);
  if (!type) notFound();
  const entries = getIndexForType(type);
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <JsonLd
        data={breadcrumbJsonLd([
          HOME_CRUMB,
          { name: CARD_TYPES[type].plural, path: referenceHref(type) },
        ])}
      />
      <header className="mb-2 flex items-center gap-3">
        <TypeChip kind={type} className="size-10 [&_svg]:size-6" />
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            {CARD_TYPES[type].plural}
          </h1>
          <p className="text-sm text-muted-foreground">
            System Reference Document 5.2.1 · {entries.length} entries
          </p>
        </div>
      </header>
      <ReferenceList type={type} entries={entries} />
    </div>
  );
}
