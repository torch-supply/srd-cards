import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExampleCollectionPage } from "@/components/collection/collection-view";
import { EXAMPLES, findExample } from "@/lib/examples";
import { buildExample } from "@/lib/examples/build";
import { getIndex } from "@/lib/srd/server";

export const dynamicParams = false;

export function generateStaticParams() {
  return EXAMPLES.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/examples/[slug]">): Promise<Metadata> {
  const example = findExample((await params).slug);
  return example ? { title: example.name, description: example.summary } : {};
}

export default async function ExamplePage({
  params,
}: PageProps<"/examples/[slug]">) {
  const example = findExample((await params).slug);
  if (!example) notFound();
  return (
    <ExampleCollectionPage collection={buildExample(example, getIndex())} />
  );
}
