/**
 * Server-only access to the full SRD data (reference pages, metadata).
 * Never import this from a client component: it would ship megabytes of JSON.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { renderEntry } from "./render";
import {
  type EntryOfType,
  type SrdEntry,
  SRD_TYPES,
  type SrdType,
} from "./schema";

const DATA_DIR = path.join(process.cwd(), "src", "data", "srd");

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8")) as T;
}

/** All raw (markdown) entries of a type, sorted by name. */
export const getEntries = cache(
  <T extends SrdType>(type: T): EntryOfType<T>[] => {
    return readJson<EntryOfType<T>[]>(`${type}.json`);
  },
);

/** One entry with its markdown rendered to HTML, or undefined. */
export const getRenderedEntry = cache(
  <T extends SrdType>(type: T, slug: string): EntryOfType<T> | undefined => {
    const entry = getEntries(type).find((e) => e.slug === slug);
    return entry ? renderEntry(entry) : undefined;
  },
);

export { getIndex, getIndexForType } from "./server-index";

export function isSrdType(value: string): value is SrdType {
  return (SRD_TYPES as readonly string[]).includes(value);
}

export type { SrdEntry };
