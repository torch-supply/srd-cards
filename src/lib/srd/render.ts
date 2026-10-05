/**
 * Converts SRD markdown fields to sanitized HTML.
 *
 * Runs on the server (reference pages) and at build time (public/srd/*.json),
 * so the browser never needs a markdown parser for SRD content.
 */
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { referenceHref } from "./card-types";
import { rehypeSrdLinks, type SrdLinks } from "./links";
import type { SrdEntry, StatBlock } from "./schema";

interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

/**
 * Marks lists of short terms (“Attack”, “Dash”, …) with `srd-terms` so they can
 * be laid out in columns, as in the PDF.
 */
function rehypeTermLists() {
  const isTerm = (li: HastNode) =>
    li.children?.length === 1 &&
    li.children[0].type === "text" &&
    /^\S+(?: \S+)?$/.test(li.children[0].value?.trim() ?? "");
  const visit = (node: HastNode) => {
    const items = node.children?.filter((c) => c.type === "element") ?? [];
    if (node.tagName === "ul" && items.length >= 3 && items.every(isTerm))
      node.properties = { ...node.properties, className: ["srd-terms"] };
    node.children?.forEach(visit);
  };
  return (tree: HastNode) => visit(tree);
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize)
  .use(rehypeTermLists)
  .use(rehypeStringify);

export function renderSrdMarkdown(markdown: string): string {
  return String(processor.processSync(markdown));
}

const stripParagraph = (html: string) =>
  html.trim().replace(/^<p>([\s\S]*)<\/p>$/, "$1");

/** Renders inline markdown (no wrapping <p>). */
export function renderSrdInline(markdown: string): string {
  return stripParagraph(renderSrdMarkdown(markdown));
}

/** Markdown renderer that also links to other entries (see links.ts), for one entry's page. */
function linkingRenderer(links: SrdLinks, self: string) {
  const linking = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeTermLists)
    .use(rehypeSrdLinks, { links, seen: new Set<string>(), self })
    .use(rehypeStringify);
  return (markdown: string) => String(linking.processSync(markdown));
}

type Render = (markdown: string) => string;

function renderStatBlock(block: StatBlock, render: Render): StatBlock {
  return {
    ...block,
    fields: block.fields.map((f) => ({
      ...f,
      value: stripParagraph(render(f.value)),
    })),
    sections: block.sections.map((s) => ({
      ...s,
      ...(s.intro ? { intro: render(s.intro) } : {}),
      entries: s.entries.map((e) => ({
        ...e,
        description: render(e.description),
      })),
    })),
  };
}

/**
 * Returns a copy of the entry with every markdown field rendered to HTML. With
 * `links` (reference pages only), the prose links to other entries.
 */
export function renderEntry<T extends SrdEntry>(entry: T, links?: SrdLinks): T {
  const e = entry as SrdEntry;
  const render: Render = links
    ? linkingRenderer(links, referenceHref(e.type, e.slug))
    : renderSrdMarkdown;
  const renderInline = (markdown: string) => stripParagraph(render(markdown));
  switch (e.type) {
    case "monster":
      return { ...e, ...renderStatBlock(e, render) } as T;
    case "spell":
    case "magic-item":
      return {
        ...e,
        description: render(e.description),
        ...(e.statBlocks
          ? { statBlocks: e.statBlocks.map((b) => renderStatBlock(b, render)) }
          : {}),
      } as T;
    case "class":
      return {
        ...e,
        description: render(e.description),
        features: e.features.map((f) => ({
          ...f,
          description: render(f.description),
        })),
      } as T;
    case "subclass":
      return {
        ...e,
        description: render(e.description),
        features: e.features.map((f) => ({
          ...f,
          description: render(f.description),
        })),
      } as T;
    case "equipment":
      return {
        ...e,
        ...(e.description ? { description: render(e.description) } : {}),
        ...(e.fields
          ? {
              fields: e.fields.map((f) => ({
                ...f,
                value: renderInline(f.value),
              })),
            }
          : {}),
      } as T;
    case "feat":
    case "condition":
    case "rule":
      return { ...e, description: render(e.description) } as T;
  }
}
