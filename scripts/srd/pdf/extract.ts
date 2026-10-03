/**
 * Extracts styled text lines from the SRD 5.2.1 PDF.
 *
 * Each page becomes a list of lines. A line is a run of text items that share a
 * baseline, split into spans by font style. Downstream parsers rely on the
 * consistent typesetting of the SRD: GillSans for headings, labels and tables,
 * Cambria for body text, Optima for monster stat blocks.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export type FontKey =
  | "gill"
  | "gill-sb"
  | "gill-i"
  | "gill-sc"
  | "body"
  | "body-b"
  | "body-i"
  | "body-bi";

export interface Span {
  text: string;
  font: FontKey;
  size: number;
  /** Left and right edges of the span. Table parsers use them to find cell boundaries. */
  x: number;
  x2: number;
}

export interface Line {
  page: number;
  x: number;
  y: number;
  /** Right edge of the last item. */
  x2: number;
  /** Font size of the first span. */
  size: number;
  spans: Span[];
}

export interface PdfLines {
  sha256: string;
  pageCount: number;
  pages: Line[][];
}

export const SRD_PDF_URL =
  "https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf";
export const SRD_PDF_SHA256 =
  "8974902d109d6e63672d7c490bde9ccf052410503d9cfa768237154fbc5e3d87";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const CACHE_DIR = path.join(ROOT, ".cache", "srd");
const DEFAULT_PDF = path.join(ROOT, "docs", "SRD_CC_v5.2.1.pdf");

/** Locates the PDF (SRD_PDF_PATH, docs/, or a verified download into .cache/). */
export async function resolvePdf(): Promise<string> {
  const candidates = [process.env.SRD_PDF_PATH, DEFAULT_PDF, path.join(CACHE_DIR, "SRD_CC_v5.2.1.pdf")];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      assertChecksum(candidate);
      return candidate;
    }
  }
  const target = path.join(CACHE_DIR, "SRD_CC_v5.2.1.pdf");
  console.log(`Downloading SRD 5.2.1 PDF to ${path.relative(ROOT, target)}…`);
  const res = await fetch(SRD_PDF_URL);
  if (!res.ok) throw new Error(`Failed to download SRD PDF: ${res.status}`);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()));
  assertChecksum(target);
  return target;
}

function assertChecksum(file: string) {
  const sha = createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  if (sha !== SRD_PDF_SHA256) {
    throw new Error(
      `${file} does not match the official SRD 5.2.1 PDF (sha256 ${sha}). ` +
        `Expected ${SRD_PDF_SHA256}.`,
    );
  }
}

function fontKey(realName: string): FontKey {
  const name = realName.replace(/^[A-Z]{6}\+/, "");
  if (name.startsWith("GillSans")) {
    if (name.includes("SC700")) return "gill-sc";
    if (name.includes("SemiBold") || name.includes("Bold")) return "gill-sb";
    if (name.includes("Italic")) return "gill-i";
    return "gill";
  }
  const bold = /Bold/.test(name);
  const italic = /Italic|Oblique/.test(name);
  if (bold && italic) return "body-bi";
  if (bold) return "body-b";
  if (italic) return "body-i";
  return "body";
}

const LIGATURES: Record<string, string> = { "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl" };

function clean(text: string) {
  return (
    text
      .replace(/[ﬀﬁﬂﬃﬄ]/g, (c) => LIGATURES[c])
      .replace(/\u00a0/g, " ")
      // pdf.js normalizes "½" to "1/2", which turns "1½" into "11/2".
      .replace(/(\d)1\/2\b/g, "$1½")
  );
}

interface RawItem {
  str: string;
  font: FontKey;
  size: number;
  x: number;
  y: number;
  w: number;
  eol: boolean;
}

/** Page header/footer band ("258 System Reference Document 5.2.1"). */
const FOOTER_MAX_Y = 45;

function itemsToLines(page: number, items: RawItem[]): Line[] {
  const lines: Line[] = [];
  let current: Line | null = null;
  /** Right edge of the last visible item. Whitespace-only items never move it. */
  let lastRight = 0;
  let pendingSpace = false;

  const push = () => {
    if (current) {
      for (const s of current.spans) s.text = s.text.replace(/\s+/g, " ").replace(/(\d)1\/2\b/g, "$1½");
      current.spans = current.spans.filter((s) => s.text.trim().length > 0 || s.text === " ");
      if (current.spans.length) {
        current.spans[0].text = current.spans[0].text.replace(/^\s+/, "");
        const last = current.spans[current.spans.length - 1];
        last.text = last.text.replace(/\s+$/, "");
        current.spans = current.spans.filter((s) => s.text.length > 0);
        if (current.spans.length) lines.push(current);
      }
    }
    current = null;
    pendingSpace = false;
  };

  for (const it of items) {
    if (it.y < FOOTER_MAX_Y) continue;
    const text = clean(it.str);
    if (!text.trim()) {
      // pdf.js emits whitespace items that stretch across gaps (e.g. between
      // table cells). Treat them as a space hint only.
      if (text) pendingSpace = true;
      if (it.eol) push();
      continue;
    }
    const sameLine = current !== null && Math.abs(current.y - it.y) <= 2.5 && it.x >= lastRight - 2;
    if (!sameLine) {
      push();
      current = { page, x: it.x, y: it.y, x2: it.x + it.w, size: it.size, spans: [] };
    }
    const line = current!;
    const prev = line.spans[line.spans.length - 1];
    const gap = it.x - lastRight;
    // A wide gap separates table cells (or label/value columns): start a new span.
    const cellBreak = prev !== undefined && gap > it.size * 0.9;
    const needsSpace =
      prev !== undefined &&
      (pendingSpace || gap > it.size * 0.15) &&
      !/\s$/.test(prev.text) &&
      !/^\s/.test(text);
    if (prev && !cellBreak && prev.font === it.font && Math.abs(prev.size - it.size) < 0.5) {
      prev.text += (needsSpace ? " " : "") + text;
      prev.x2 = it.x + it.w;
    } else {
      if (prev && needsSpace) prev.text += " ";
      line.spans.push({ text, font: it.font, size: it.size, x: it.x, x2: it.x + it.w });
    }
    pendingSpace = false;
    lastRight = it.x + it.w;
    line.x2 = lastRight;
    if (it.eol) push();
  }
  push();
  return lines;
}

export async function extractPdfLines(pdfPath: string): Promise<PdfLines> {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const sha256 = createHash("sha256").update(data).digest("hex");
  const task = getDocument({ data, verbosity: 0 });
  const doc = await task.promise;
  const pages: Line[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    await page.getOperatorList(); // resolves fonts into commonObjs
    const content = await page.getTextContent();
    const fonts = new Map<string, FontKey>();
    const items: RawItem[] = [];
    for (const raw of content.items) {
      if (!("str" in raw)) continue;
      let font = fonts.get(raw.fontName);
      if (!font) {
        let real = raw.fontName;
        try {
          real = (page.commonObjs.get(raw.fontName) as { name?: string })?.name ?? raw.fontName;
        } catch {
          /* font not resolved; fall back to the internal name */
        }
        font = fontKey(real);
        fonts.set(raw.fontName, font);
      }
      const [a, b, , , e, f] = raw.transform as number[];
      items.push({
        str: raw.str,
        font,
        size: Math.round(Math.hypot(a, b) * 10) / 10,
        x: Math.round(e * 10) / 10,
        y: Math.round(f * 10) / 10,
        w: raw.width,
        eol: raw.hasEOL,
      });
    }
    pages.push(itemsToLines(p, items));
    page.cleanup();
  }
  await task.destroy();
  return { sha256, pageCount: pages.length, pages };
}

/** Extracts (or loads from cache) the styled lines for the whole PDF. */
export async function loadPdfLines(): Promise<PdfLines> {
  const pdf = await resolvePdf();
  const cacheFile = path.join(CACHE_DIR, "pdf-lines.json");
  if (fs.existsSync(cacheFile)) {
    const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8")) as PdfLines;
    if (cached.sha256 === SRD_PDF_SHA256) return cached;
  }
  const lines = await extractPdfLines(pdf);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(lines));
  return lines;
}

/** Plain text of a line (spans joined). */
export function lineText(line: Line): string {
  return line.spans.map((s) => s.text).join("");
}
