import type { Metadata } from "next";
import Link from "next/link";
import { CC_BY_URL, SRD_ATTRIBUTION, SRD_URL } from "@/lib/attribution";

export const metadata: Metadata = { title: "About & credits" };

export default function AboutPage() {
  return (
    <article className="mx-auto w-full max-w-3xl space-y-8 px-6 py-10 text-sm leading-relaxed">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">About srd.cards</h1>
        <p className="text-base text-muted-foreground">
          srd.cards is a 5E compatible tool for browsing the System Reference Document 5.2.1 and organizing its content
          as cards: collections hold stacks, and stacks hold cards for spells, monsters, classes, equipment, and more.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="font-serif text-xl font-semibold">Your data</h2>
        <p>
          Collections are saved in this browser’s local storage and never leave your device. Clearing site data removes
          them, so use <strong>Export</strong> on the home page or a collection to keep a backup file, and{" "}
          <strong>Import</strong> to restore it.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-serif text-xl font-semibold">System Reference Document 5.2.1</h2>
        <blockquote className="rounded-md border-l-2 bg-muted/50 px-4 py-3">{SRD_ATTRIBUTION}</blockquote>
        <p>
          Get the SRD at <a className="underline underline-offset-2" href={SRD_URL}>{SRD_URL}</a>. License:{" "}
          <a className="underline underline-offset-2" href={CC_BY_URL}>
            Creative Commons Attribution 4.0 International
          </a>
          .
        </p>
        <p>
          The reference text on this site was extracted directly from the official SRD 5.2.1 PDF and checked against
          it. Each entry shows the PDF page it comes from.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-serif text-xl font-semibold">Data credits</h2>
        <p>
          While building the data, structured values were cross-checked against two open SRD datasets:{" "}
          <a className="underline underline-offset-2" href="https://github.com/5e-bits/5e-database">5e-bits/5e-database</a>{" "}
          (MIT License) and{" "}
          <a className="underline underline-offset-2" href="https://github.com/open5e/open5e-api">Open5e</a>. Thank you to
          both projects.
        </p>
        <details className="rounded-md border px-3 py-2">
          <summary className="cursor-pointer font-medium">5e-bits/5e-database license (MIT)</summary>
          <pre className="mt-2 text-xs whitespace-pre-wrap text-muted-foreground">{`MIT License

Copyright (c) [2018-2020] [Adrian Padua, Christopher Ward]

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`}</pre>
        </details>
        <p>
          Icons from <a className="underline underline-offset-2" href="https://game-icons.net">Game-icons.net</a> (CC BY 3.0) via
          React Icons, and <a className="underline underline-offset-2" href="https://lucide.dev">Lucide</a> (ISC).
        </p>
      </section>

      <p>
        <Link href="/" className="underline underline-offset-2">
          ← Back to your collections
        </Link>
      </p>
    </article>
  );
}
