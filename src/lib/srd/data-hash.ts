/**
 * Content hash of src/data/srd/*.json. Names the public data folder
 * (public/srd/<hash>/) so those files can be cached forever.
 * Node-only: used by next.config.ts and scripts/srd/emit.ts.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const SRD_DATA_DIR = path.join(process.cwd(), "src", "data", "srd");

export function srdDataHash(dir = SRD_DATA_DIR): string {
  const hash = createHash("sha256");
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    hash.update(file);
    hash.update(fs.readFileSync(path.join(dir, file)));
  }
  return hash.digest("hex").slice(0, 12);
}
