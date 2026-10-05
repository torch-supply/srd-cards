/**
 * Site-wide SEO: page metadata (canonical URL, Open Graph), meta descriptions
 * for SRD entries, and JSON-LD structured data.
 */
import type { Metadata } from "next";
import { ogHash } from "./content-hashes";
import { CARD_TYPES } from "./srd/card-types";
import type { SrdEntry } from "./srd/schema";

export const SITE_URL = "https://srd.cards";
export const SITE_NAME = "srd.cards";
export const SOURCE_URL = "https://github.com/torch-supply/srd-cards";
export const SITE_DESCRIPTION =
  "Browse the System Reference Document 5.2.1 and organize spells, monsters, classes, and equipment into stacks of cards. 5E compatible.";

/** Open Graph fields every page shares. */
export const SITE_OPEN_GRAPH = {
  siteName: SITE_NAME,
  type: "website",
  locale: "en_US",
} as const;

export const OG_IMAGE_SIZE = { width: 1200, height: 630 };

/**
 * A link preview image written by `pnpm og:emit` (scripts/og.tsx). `key` is
 * the page's path without its leading slash, or "site" for the site-wide one.
 */
export function ogImage(key: string, alt: string) {
  return {
    url: `/og/${ogHash()}/${key}.png`,
    ...OG_IMAGE_SIZE,
    type: "image/png",
    alt,
  };
}

export function siteOgImage() {
  return ogImage(
    "site",
    "srd.cards: browse the SRD 5.2.1 and organize it as cards",
  );
}

/**
 * Metadata for a page: title, description, canonical URL, `og:url`, and
 * `og:image` (the site-wide image unless given). Metadata merges shallowly, so
 * a page's `openGraph` replaces the root layout's; this keeps the shared
 * fields. Next fills in `og:title`, `og:description`, and the Twitter tags.
 */
export function pageMetadata({
  title,
  description,
  path,
  image = siteOgImage(),
}: {
  title: Metadata["title"];
  description: string;
  path: string;
  image?: ReturnType<typeof ogImage>;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { ...SITE_OPEN_GRAPH, url: path, images: image },
  };
}

export const MAX_DESCRIPTION = 160;

/** Cut at a word boundary to at most `max` characters, ending in "…". */
export function truncate(text: string, max = MAX_DESCRIPTION) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = cut.lastIndexOf(" ");
  return `${cut.slice(0, end > 0 ? end : max - 1).replace(/[\s,;:.—–-]+$/, "")}…`;
}

/** End with a period unless the text already ends a sentence ("10 ft." stays). */
function sentence(text: string) {
  return /[.!?…]$/.test(text) ? text : `${text}.`;
}

/** Plain text of inline markdown (emphasis, links). */
function inline(markdown: string) {
  return markdown.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\*+/g, "");
}

/** Plain text of SRD markdown prose, skipping headings, tables, and italic taglines. */
export function plainText(markdown: string) {
  return markdown
    .split(/\n{2,}/)
    .filter((p) => !/^(#|\|)/.test(p) && !/^\*[^*].*\*$/.test(p.trim()))
    .map((p) =>
      inline(p.replace(/^\s*[-*] /gm, ""))
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .join(" ");
}

/** Meta description for an SRD entry: a factual lead, then the start of its SRD text. */
export function entryDescription(entry: SrdEntry): string {
  const lead =
    entry.subtitle === CARD_TYPES[entry.type].label
      ? ""
      : sentence(entry.subtitle);
  let text: string;
  switch (entry.type) {
    case "spell": {
      const kind =
        entry.level === 0
          ? `${entry.school} cantrip`
          : `Level ${entry.level} ${entry.school} spell`;
      const classes = entry.classes.length
        ? ` (${entry.classes.join(", ")})`
        : "";
      text = `${kind}${classes}. ${plainText(entry.description)}`;
      break;
    }
    case "monster":
      text = sentence(
        `CR ${entry.cr} ${entry.meta}. AC ${entry.ac} · HP ${entry.hp} · Speed ${entry.speed}`,
      );
      break;
    case "class":
      text = entry.coreTraits
        .map((t) => `${t.label}: ${inline(t.value)}`)
        .join("; ");
      break;
    case "background":
      text = entry.fields
        .map((f) => `${f.label}: ${inline(f.value)}`)
        .join("; ");
      break;
    case "equipment": {
      if (entry.description) {
        text = `${lead} ${plainText(entry.description)}`;
        break;
      }
      const { cost, weight, weapon, armor } = entry;
      const facts = [
        cost && !entry.subtitle.includes(cost) && `Cost ${cost}`,
        weight && `Weight ${weight}`,
        weapon?.properties.length &&
          `Properties: ${weapon.properties.join(", ")}`,
        weapon?.mastery && `Mastery: ${weapon.mastery}`,
        armor && armor.strength !== "—" && `Strength ${armor.strength}`,
        armor && armor.stealth !== "—" && `Stealth: ${armor.stealth}`,
        ...(entry.fields ?? []).map((f) => `${f.label}: ${inline(f.value)}`),
      ].filter(Boolean);
      text = `${lead} ${facts.length ? sentence(facts.join(" · ")) : ""}`;
      break;
    }
    default:
      text = `${lead} ${plainText(entry.description)}`;
  }
  text = text.replace(/\s+/g, " ").trim();
  // Short ones (some equipment) also say where the entry comes from.
  if (text.length < 80)
    text = `${text} ${CARD_TYPES[entry.type].label} from the System Reference Document 5.2.1, p. ${entry.page}.`;
  return truncate(text);
}

/** schema.org BreadcrumbList for the path from the home page to this page. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: new URL(item.path, SITE_URL).href,
    })),
  };
}

export const HOME_CRUMB = { name: SITE_NAME, path: "/" };
