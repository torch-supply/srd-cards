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

/** Renders inline markdown (no wrapping <p>). */
export function renderSrdInline(markdown: string): string {
  return renderSrdMarkdown(markdown)
    .trim()
    .replace(/^<p>([\s\S]*)<\/p>$/, "$1");
}

function renderStatBlock(block: StatBlock): StatBlock {
  return {
    ...block,
    fields: block.fields.map((f) => ({
      ...f,
      value: renderSrdInline(f.value),
    })),
    sections: block.sections.map((s) => ({
      ...s,
      ...(s.intro ? { intro: renderSrdMarkdown(s.intro) } : {}),
      entries: s.entries.map((e) => ({
        ...e,
        description: renderSrdMarkdown(e.description),
      })),
    })),
  };
}

/** Returns a copy of the entry with every markdown field rendered to HTML. */
export function renderEntry<T extends SrdEntry>(entry: T): T {
  const e = entry as SrdEntry;
  switch (e.type) {
    case "monster":
      return { ...e, ...renderStatBlock(e) } as T;
    case "spell":
    case "magic-item":
      return {
        ...e,
        description: renderSrdMarkdown(e.description),
        ...(e.statBlocks
          ? { statBlocks: e.statBlocks.map(renderStatBlock) }
          : {}),
      } as T;
    case "class":
      return {
        ...e,
        description: renderSrdMarkdown(e.description),
        features: e.features.map((f) => ({
          ...f,
          description: renderSrdMarkdown(f.description),
        })),
      } as T;
    case "subclass":
      return {
        ...e,
        description: renderSrdMarkdown(e.description),
        features: e.features.map((f) => ({
          ...f,
          description: renderSrdMarkdown(f.description),
        })),
      } as T;
    case "equipment":
      return {
        ...e,
        ...(e.description
          ? { description: renderSrdMarkdown(e.description) }
          : {}),
        ...(e.fields
          ? {
              fields: e.fields.map((f) => ({
                ...f,
                value: renderSrdInline(f.value),
              })),
            }
          : {}),
      } as T;
    case "feat":
    case "condition":
    case "rule":
      return { ...e, description: renderSrdMarkdown(e.description) } as T;
  }
}
