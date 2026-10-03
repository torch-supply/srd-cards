/**
 * Writes the browser-facing SRD files (runs before `dev` and `build`):
 *   public/srd/<hash>/index.json          lightweight index for search and lists
 *   public/srd/<hash>/<type>/<slug>.json  one rendered entry (markdown → HTML)
 * Older hash folders are removed.
 */
import fs from "node:fs";
import path from "node:path";
import { srdDataHash, SRD_DATA_DIR } from "../../src/lib/srd/data-hash";
import { renderEntry } from "../../src/lib/srd/render";
import { type SrdEntry, SRD_TYPES } from "../../src/lib/srd/schema";

const PUBLIC_DIR = path.join(process.cwd(), "public", "srd");

export function emitPublic() {
  const hash = srdDataHash();
  const target = path.join(PUBLIC_DIR, hash);
  if (fs.existsSync(path.join(target, "index.json"))) {
    console.log(`SRD data ${hash} already emitted.`);
    return;
  }
  const started = Date.now();
  fs.rmSync(PUBLIC_DIR, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  fs.copyFileSync(path.join(SRD_DATA_DIR, "index.json"), path.join(target, "index.json"));
  const aliases = path.join(process.cwd(), "scripts", "srd", "aliases.json");
  fs.writeFileSync(path.join(target, "aliases.json"), fs.existsSync(aliases) ? fs.readFileSync(aliases) : "{}");
  let count = 0;
  for (const type of SRD_TYPES) {
    const entries = JSON.parse(fs.readFileSync(path.join(SRD_DATA_DIR, `${type}.json`), "utf8")) as SrdEntry[];
    fs.mkdirSync(path.join(target, type), { recursive: true });
    for (const entry of entries) {
      fs.writeFileSync(path.join(target, type, `${entry.slug}.json`), JSON.stringify(renderEntry(entry)));
      count++;
    }
  }
  console.log(`Emitted ${count} SRD entries to public/srd/${hash}/ in ${Date.now() - started}ms.`);
}

if (import.meta.url === `file://${process.argv[1]}`) emitPublic();
