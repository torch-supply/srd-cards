import type { Metadata } from "next";
import { CollectionPage } from "@/components/collection/collection-view";

// Collections are private to the browser that saved them: crawlers only see a loading page.
export const metadata: Metadata = {
  title: "Collection",
  robots: { index: false },
};

export default async function Page({ params }: PageProps<"/collections/[id]">) {
  const { id } = await params;
  // Collections live in browser storage: the client loads it after mounting.
  return <CollectionPage key={id} id={id} />;
}
