import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { ReferenceSections } from "@/components/reference/reference-sections";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-6 py-16">
      <section className="space-y-3">
        <Logo className="size-10" />
        <h1 className="font-serif text-4xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          There’s no page at this address. It may have moved, or the link may
          have a typo.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-serif text-xl font-semibold">
          Browse the SRD 5.2.1
        </h2>
        <ReferenceSections />
      </section>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/">Your collections</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/examples">See examples</Link>
        </Button>
      </div>
    </div>
  );
}
