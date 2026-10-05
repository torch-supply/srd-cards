import type { MetadataRoute } from "next";
import { EXAMPLES } from "@/lib/examples";
import { SITE_URL } from "@/lib/seo";
import { REFERENCE_TYPES, referenceHref } from "@/lib/srd/card-types";
import { getIndex } from "@/lib/srd/server-index";

/**
 * Every public page. Reference list pages render their entries client-side
 * (virtualized), so this is how crawlers find the entry pages. Collections
 * live in the browser and are left out (and marked noindex).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "/",
    "/examples",
    ...EXAMPLES.map((e) => `/examples/${e.slug}`),
    ...REFERENCE_TYPES.map((t) => referenceHref(t)),
    ...getIndex().map((e) => referenceHref(e.type, e.slug)),
    "/about",
  ];
  return paths.map((p) => ({ url: p === "/" ? SITE_URL : `${SITE_URL}${p}` }));
}
