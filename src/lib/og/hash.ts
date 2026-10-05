/**
 * Content hash of everything the link preview images are drawn from. Names the
 * public/og/<hash>/ folder (written by `pnpm og:emit`) so the images can be
 * cached forever. Node-only: used by next.config.ts, src/lib/seo.ts, and
 * scripts/og.tsx.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { srdDataHash } from "../srd/data-hash";

const INPUTS = [
  "scripts/og.tsx",
  "src/lib/og/card.tsx",
  "src/lib/og/fonts/CrimsonPro-SemiBold.ttf",
  "src/lib/og/fonts/Geist-Medium.ttf",
  "src/lib/og/fonts/Geist-Regular.ttf",
  "src/lib/srd/card-types.ts",
  "src/lib/examples/index.ts",
  "src/app/icon.svg",
];

export function ogHash(): string {
  const hash = createHash("sha256").update(srdDataHash());
  for (const file of INPUTS) {
    hash.update(file);
    hash.update(fs.readFileSync(path.join(process.cwd(), file)));
  }
  return hash.digest("hex").slice(0, 12);
}
