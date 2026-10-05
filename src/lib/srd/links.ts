/**
 * Links between SRD entries on the reference pages, so every entry page links
 * to related ones (for readers and for crawlers). In prose (a rehype plugin):
 *   - italic spell and magic item names (“*Fireball*”),
 *   - quoted references to rules (“See also “Encounter.””),
 *   - defined game terms, which 5.2.1 writes in Title Case: condition names,
 *     multi-word glossary terms (“Difficult Terrain”), distinctive one-word
 *     terms (“Advantage”), and actions (“Dash action”).
 * Each target is linked once per page, and never to the page itself. Only the
 * reference pages link: the board's card JSON (public/srd/) stays link-free,
 * so clicking in a card never navigates away.
 */
import { referenceHref } from "./card-types";
import type { SrdEntry, SrdType } from "./schema";

export interface SrdLinks {
  /** Spells and magic items by lowercased name. */
  italic: Map<string, string>;
  /** Rules and conditions by exact name. */
  quoted: Map<string, string>;
  /** Exact term text → href. */
  terms: Map<string, string>;
  pattern: RegExp;
  /** `type:lowercased name` and `tag:lowercased name` (tagged rules) → href. */
  named: Map<string, string>;
  /** Entry id → name and href. */
  byId: Map<string, { name: string; href: string }>;
}

/** One-word glossary terms that aren't also everyday words starting a sentence. */
const ONE_WORD_TERMS = new Set([
  "Advantage",
  "Disadvantage",
  "Attunement",
  "Blindsight",
  "Bloodied",
  "Concentration",
  "Darkvision",
  "Tremorsense",
  "Truesight",
  "Telepathy",
  "Teleportation",
  "Immunity",
  "Resistance",
  "Vulnerability",
  "Dehydration",
  "Malnutrition",
  "Suffocation",
]);

const GLOSSARY = "Rules Glossary";
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function buildSrdLinks(entries: SrdEntry[]): SrdLinks {
  const italic = new Map<string, string>();
  const quoted = new Map<string, string>();
  const terms = new Map<string, string>();
  const named = new Map<string, string>();
  const byId = new Map<string, { name: string; href: string }>();
  const setOnce = (map: Map<string, string>, key: string, href: string) => {
    if (!map.has(key)) map.set(key, href);
  };
  // Glossary entries first, so they win over same-named chapter sections.
  const ordered = [...entries].sort(
    (a, b) =>
      Number(b.type === "rule" && b.section === GLOSSARY) -
      Number(a.type === "rule" && a.section === GLOSSARY),
  );
  for (const e of ordered) {
    const href = referenceHref(e.type, e.slug);
    byId.set(e.id, { name: e.name, href });
    setOnce(named, `${e.type}:${e.name.toLowerCase()}`, href);
    if (e.type === "spell" || e.type === "magic-item") {
      setOnce(italic, e.name.toLowerCase(), href);
      // “Potions of Healing” is cited as *Potion of Healing*, “Ioun Stone” as *Ioun Stones*.
      const variant = e.name.startsWith("Potions of ")
        ? e.name.replace("Potions of ", "Potion of ")
        : `${e.name}s`;
      setOnce(italic, variant.toLowerCase(), href);
    }
    if (e.type === "condition") {
      setOnce(quoted, e.name, href);
      setOnce(terms, e.name, href);
    }
    if (e.type !== "rule") continue;
    setOnce(quoted, e.name, href);
    if (e.tag) setOnce(named, `${e.tag}:${e.name.toLowerCase()}`, href);
    if (e.section !== GLOSSARY) continue;
    if (e.tag === "Action") setOnce(terms, `${e.name} action`, href);
    else if (e.tag === "Area of Effect" || ONE_WORD_TERMS.has(e.name))
      setOnce(terms, e.name, href);
    else if (e.name.includes(" ") && !e.tag) {
      setOnce(terms, e.name, href);
      // Plural or singular too: “Saving Throws”, “Opportunity Attack”, “Hit Point Die”.
      setOnce(
        terms,
        e.name.endsWith("Dice")
          ? e.name.replace(/Dice$/, "Die")
          : e.name.endsWith("s")
            ? e.name.slice(0, -1)
            : `${e.name}s`,
        href,
      );
    }
  }
  const alternatives = [...terms.keys()]
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join("|");
  // A quoted reference, or a whole-word term.
  const pattern = new RegExp(
    `“([^”]{1,60}?)([.,]?)”|(?<![\\p{L}\\p{N}’'-])(${alternatives})(?![\\p{L}\\p{N}’'-])`,
    "gu",
  );
  return { italic, quoted, terms, pattern, named, byId };
}

/** The href of an entry of `type` (or of a rule with `tag`) named `name`. */
export function hrefFor(
  links: SrdLinks | undefined,
  kind: SrdType | "Weapon Property" | "Mastery Property",
  name: string,
) {
  return links?.named.get(`${kind}:${name.toLowerCase()}`);
}

interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

const text = (value: string): HastNode => ({ type: "text", value });
const anchor = (href: string, children: HastNode[]): HastNode => ({
  type: "element",
  tagName: "a",
  properties: { href },
  children,
});

/**
 * Rehype plugin adding the links. `seen` is shared by every field of one entry
 * (link each target once per page); `self` is the entry's own href.
 */
export function rehypeSrdLinks({
  links,
  seen,
  self,
}: {
  links: SrdLinks;
  seen: Set<string>;
  self: string;
}) {
  const claim = (href: string | undefined) => {
    if (!href || href === self || seen.has(href)) return undefined;
    seen.add(href);
    return href;
  };

  const linkText = (value: string): HastNode[] => {
    const out: HastNode[] = [];
    let last = 0;
    for (const m of value.matchAll(links.pattern)) {
      const [whole, quotedName, punctuation, term] = m;
      const href = claim(
        quotedName !== undefined
          ? links.quoted.get(quotedName)
          : links.terms.get(term),
      );
      if (!href) continue;
      out.push(text(value.slice(last, m.index)));
      if (quotedName !== undefined)
        out.push(
          text("“"),
          anchor(href, [text(quotedName)]),
          text(`${punctuation}”`),
        );
      else out.push(anchor(href, [text(term)]));
      last = m.index + whole.length;
    }
    if (!out.length) return [text(value)];
    out.push(text(value.slice(last)));
    return out.filter((n) => n.value !== "");
  };

  const italicHref = (em: HastNode) => {
    const only = em.children?.length === 1 ? em.children[0] : undefined;
    return only?.type === "text"
      ? links.italic.get(only.value!.trim().toLowerCase())
      : undefined;
  };

  const visit = (node: HastNode) => {
    if (!node.children) return;
    node.children = node.children.flatMap((child) => {
      if (child.type === "text") return linkText(child.value ?? "");
      if (child.type !== "element") return [child];
      // Leave links, headings, and bold run-in names (“***Recharge.***”) alone.
      if (child.tagName === "a" || child.tagName === "strong") return [child];
      if (/^h[1-6]$/.test(child.tagName ?? "")) return [child];
      const italic = child.tagName === "em" && italicHref(child);
      if (italic) {
        // Linked once; later mentions stay plain (not matched as terms).
        const href = claim(italic);
        return [href ? anchor(href, [child]) : child];
      }
      visit(child);
      return [child];
    });
  };
  return (tree: HastNode) => visit(tree);
}
