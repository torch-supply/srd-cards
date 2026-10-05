/**
 * Server-only access to the SRD search index, without the markdown renderer
 * and zod that `server.ts` pulls in. Route handlers (sitemap, llms.txt) are
 * bundled apart from pages, so importing `server.ts` there would add a second
 * copy of the renderer to the Worker.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import type { IndexEntry, SrdType } from "./schema";

export const getIndex = cache(
  (): IndexEntry[] =>
    JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), "src", "data", "srd", "index.json"),
        "utf8",
      ),
    ) as IndexEntry[],
);

export function getIndexForType(type: SrdType): IndexEntry[] {
  return getIndex().filter((e) => e.type === type);
}
