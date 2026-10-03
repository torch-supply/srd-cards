import type { Metadata } from "next";
import { CollectionPage } from "@/components/collection/collection-view";

export const metadata: Metadata = { title: "Collection" };

export default async function Page({ params }: PageProps<"/collections/[id]">) {
  const { id } = await params;
  // Collections live in browser storage: the client loads it after mounting.
  return <CollectionPage key={id} id={id} />;
}
