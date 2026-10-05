import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExampleCollectionPage } from "@/components/collection/collection-view";
import { ExampleOutline } from "@/components/examples/example-outline";
import { JsonLd } from "@/components/seo/json-ld";
import { EXAMPLES, findExample } from "@/lib/examples";
import { buildExample } from "@/lib/examples/build";
import { breadcrumbJsonLd, HOME_CRUMB, ogImage, pageMetadata } from "@/lib/seo";
import { getIndex } from "@/lib/srd/server";

export const dynamicParams = false;

export function generateStaticParams() {
  return EXAMPLES.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/examples/[slug]">): Promise<Metadata> {
  const example = findExample((await params).slug);
  return example
    ? pageMetadata({
        title: example.name,
        description: example.summary,
        path: `/examples/${example.slug}`,
        image: ogImage(`examples/${example.slug}`, example.name),
      })
    : {};
}

export default async function ExamplePage({
  params,
}: PageProps<"/examples/[slug]">) {
  const example = findExample((await params).slug);
  if (!example) notFound();
  const collection = buildExample(example, getIndex());
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          HOME_CRUMB,
          { name: "Example collections", path: "/examples" },
          { name: example.name, path: `/examples/${example.slug}` },
        ])}
      />
      <ExampleCollectionPage
        collection={collection}
        placeholder={<ExampleOutline collection={collection} />}
      />
    </>
  );
}
