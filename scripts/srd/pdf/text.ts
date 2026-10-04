/**
 * Text helpers: joining wrapped lines (with dictionary-based de-hyphenation)
 * and converting styled spans to markdown.
 */
import type { FontKey, Line, Span } from "./extract";

/** Words seen in the PDF, used to decide whether a line-end hyphen is a soft break. */
export class Dictionary {
  private words = new Map<string, number>();
  private hyphenated = new Map<string, number>();

  constructor(pages: Line[][]) {
    for (const page of pages) {
      for (const line of page) {
        const text = line.spans.map((s) => s.text).join("");
        // Ignore the last token when it is a line-end hyphen fragment.
        const body = text.replace(/[\p{L}\d’'-]+-$/u, "");
        for (const token of body.match(/[\p{L}’']+(?:-[\p{L}’']+)*/gu) ?? []) {
          const lower = token.toLowerCase();
          if (lower.includes("-")) {
            this.hyphenated.set(lower, (this.hyphenated.get(lower) ?? 0) + 1);
            for (const part of lower.split("-")) this.add(part);
          } else {
            this.add(lower);
          }
        }
      }
    }
  }

  private add(word: string) {
    this.words.set(word, (this.words.get(word) ?? 0) + 1);
  }

  /** Records ambiguous joins so the verify report can surface them. */
  readonly ambiguous: string[] = [];

  /**
   * Decides how to join `left-` (end of a line) with `right` (start of the next).
   * Returns true to keep the hyphen ("Two-Handed"), false to merge ("suc-ceed" → "succeed").
   */
  keepHyphen(left: string, right: string): boolean {
    const l = left.toLowerCase();
    const r = right.toLowerCase();
    if (/\d$/.test(l) || /^\d/.test(r)) return true; // "5-foot", "30-foot"
    if (/^\p{Lu}/u.test(right)) return true; // "Two-Handed", "Half-Orc"
    const joined = l + r;
    const hyphenated = `${l}-${r}`;
    const joinedCount = this.words.get(joined) ?? 0;
    const hyphenCount = this.hyphenated.get(hyphenated) ?? 0;
    if (hyphenCount > joinedCount) return true;
    if (joinedCount > 0) return false;
    // Neither form seen elsewhere: soft hyphenation is far more common in this layout.
    if (
      (this.words.get(l) ?? 0) > 0 &&
      (this.words.get(r) ?? 0) > 0 &&
      hyphenCount === 0
    ) {
      this.ambiguous.push(`${left}-${right}`);
    }
    return false;
  }
}

const SENTENCE_END = /[.!?:;)”"’\]]$/;

export function endsSentence(text: string) {
  return SENTENCE_END.test(text.trim());
}

/**
 * Appends `next` spans to `acc`, joining across a line break.
 * Handles soft hyphens, em dashes and slashes at line ends.
 */
export function appendLine(acc: Span[], next: Span[], dict: Dictionary) {
  if (!next.length) return;
  const incoming = next.map((s) => ({ ...s }));
  if (!acc.length) {
    acc.push(...incoming);
    return;
  }
  const last = acc[acc.length - 1];
  const first = incoming[0];
  const hyphen = last.text.match(/([\p{L}\d’']+)-$/u);
  const firstWord = first.text.match(/^([\p{L}\d’']+)/u);
  if (hyphen && firstWord) {
    // Either keep "Two-" + "Handed" together, or drop a soft hyphen: "suc-" + "ceed".
    if (!dict.keepHyphen(hyphen[1], firstWord[1]))
      last.text = last.text.slice(0, -1);
  } else if (/[—–/]$/.test(last.text) || /^[—–]/.test(first.text)) {
    // no space around em dashes or after a slash
  } else if (!/\s$/.test(last.text)) {
    last.text += " ";
  }
  acc.push(...incoming);
}

/** Merges adjacent spans with the same font. */
export function mergeSpans(spans: Span[]): Span[] {
  const out: Span[] = [];
  for (const span of spans) {
    const prev = out[out.length - 1];
    if (prev && styleOf(prev.font) === styleOf(span.font)) {
      prev.text += span.text;
      prev.x2 = span.x2;
    } else {
      out.push({ ...span });
    }
  }
  return out;
}

type Style = "plain" | "bold" | "italic" | "bolditalic";

export function styleOf(font: FontKey): Style {
  switch (font) {
    case "body-b":
    case "gill-sb":
      return "bold";
    case "body-i":
    case "gill-i":
      return "italic";
    case "body-bi":
      return "bolditalic";
    default:
      return "plain";
  }
}

function escapeMd(text: string) {
  return text.replace(/([*_`\\])/g, "\\$1");
}

const MARKERS: Record<Style, string> = {
  plain: "",
  bold: "**",
  italic: "*",
  bolditalic: "***",
};

/** Converts styled spans to inline markdown. Whitespace stays outside the markers. */
export function spansToMarkdown(
  spans: Span[],
  opts: { plainFonts?: FontKey[] } = {},
): string {
  let out = "";
  for (const span of mergeSpans(spans)) {
    const style = opts.plainFonts?.includes(span.font)
      ? "plain"
      : styleOf(span.font);
    const marker = MARKERS[style];
    const m = span.text.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
    if (!m[2]) {
      out += span.text;
      continue;
    }
    out += m[1] + marker + escapeMd(m[2]) + marker + m[3];
  }
  return out.replace(/[ \t]+/g, " ").trim();
}

/** Plain text of spans. */
export function spansText(spans: Span[]): string {
  return spans
    .map((s) => s.text)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lowercase URL slug: "Bigby's Hand" → "bigbys-hand", "+1 Weapon" → "plus-1-weapon". */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "")
    .replace(/\+/g, " plus ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
