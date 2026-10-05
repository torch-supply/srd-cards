import { SRD_ATTRIBUTION } from "@/lib/attribution";
import { EXAMPLES } from "@/lib/examples";
import { SITE_URL } from "@/lib/seo";
import {
  CARD_TYPES,
  REFERENCE_TYPES,
  referenceHref,
} from "@/lib/srd/card-types";
import { getIndexForType } from "@/lib/srd/server-index";

export const dynamic = "force-static";

/** A map of the site for language models (https://llmstxt.org). */
export function GET() {
  const url = (p: string) => `${SITE_URL}${p}`;
  const lines = [
    "# srd.cards",
    "",
    "> Browse the System Reference Document 5.2.1 (SRD 5.2.1) and organize its content as cards. 5.5e compatible.",
    "",
    `Every SRD entry has its own page with the full text, extracted from the official SRD 5.2.1 PDF, and the PDF page it comes from. Entry URLs are ${url("/<section>/<slug>")}, e.g. ${url(referenceHref("spell", "fireball"))}. The sitemap lists every page: ${url("/sitemap.xml")}`,
    "",
    "Collections, stacks, and cards are saved in the visitor's browser; there are no accounts and no public collection pages.",
    "",
    "## Reference sections",
    "",
    ...REFERENCE_TYPES.map(
      (t) =>
        `- [${CARD_TYPES[t].plural}](${url(referenceHref(t))}): ${getIndexForType(t).length} entries`,
    ),
    "",
    "## Example collections",
    "",
    ...EXAMPLES.map(
      (e) => `- [${e.name}](${url(`/examples/${e.slug}`)}): ${e.summary}`,
    ),
    "",
    "## About",
    "",
    `- [About & credits](${url("/about")}): how the site works, data storage, and credits`,
    "",
    "## License",
    "",
    SRD_ATTRIBUTION,
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
