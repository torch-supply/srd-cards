import type { Metadata } from "next";
import { ExampleList } from "@/components/examples/example-list";

export const metadata: Metadata = {
  title: "Example collections",
  description:
    "Example collections to explore: an adventuring party, a short adventure, rules references, monsters compared, a magic deck, and more.",
};

export default function ExamplesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-10">
      <header className="max-w-2xl space-y-2">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Example collections
        </h1>
        <p className="text-muted-foreground">
          See how collections, stacks, and cards fit together. Open an example
          and try anything: expand cards, drag them between stacks, add new
          ones. Changes aren’t saved — use <strong>Save a copy</strong> to keep
          one as your own.
        </p>
      </header>
      <ExampleList />
    </div>
  );
}
