import type { Metadata } from "next";
import Link from "next/link";
import { CollectionsHome } from "@/components/collections/collections-home";
import { ReferenceSections } from "@/components/reference/reference-sections";
import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: { absolute: `${SITE_NAME} — The SRD 5.2.1, as cards` },
  description: SITE_DESCRIPTION,
  path: "/",
});

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 px-6 py-10">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SITE_NAME,
          url: SITE_URL,
          description: SITE_DESCRIPTION,
        }}
      />
      <section className="space-y-3">
        <h1 className="font-serif text-4xl font-semibold tracking-tight">
          srd.cards
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Browse the System Reference Document 5.2.1 and organize spells,
          monsters, classes, and equipment into stacks of cards — for a
          character, an encounter, or a whole campaign. Everything is saved in
          your browser.{" "}
          <Link href="/examples" className="underline underline-offset-2">
            See examples
          </Link>
        </p>
        <p className="max-w-2xl text-muted-foreground">
          Writing 5E compatible material? Check the exact SRD wording and page
          for any entry.
        </p>
        <div className="pt-1">
          <ReferenceSections />
        </div>
      </section>
      <CollectionsHome />
    </div>
  );
}
