/**
 * Writes the link preview (Open Graph) images (runs before `dev` and `build`):
 *   public/og/<hash>/site.png             home page, and pages without their own
 *   public/og/<hash>/<route>.png          reference sections (spells.png, …)
 *   public/og/<hash>/<route>/<slug>.png   reference entries
 *   public/og/<hash>/examples/<slug>.png  example collections
 * Pages link them with `ogImage()` (src/lib/seo.ts). Rendering them here rather
 * than with Next's opengraph-image routes keeps next/og (resvg and yoga wasm,
 * ~1MB gzipped) out of the Worker bundle. Older hash folders are removed.
 */
import fs from "node:fs";
import path from "node:path";
import { GiCardRandom } from "react-icons/gi";
import { EXAMPLES } from "../src/lib/examples";
import {
  OG_TYPE_COLORS,
  OgChip,
  ogImage,
  OgTypeLabel,
} from "../src/lib/og/card";
import { ogHash } from "../src/lib/og/hash";
import { CARD_TYPES, REFERENCE_TYPES } from "../src/lib/srd/card-types";
import { SRD_DATA_DIR } from "../src/lib/srd/data-hash";
import type { IndexEntry, SrdEntry } from "../src/lib/srd/schema";

const PUBLIC_DIR = path.join(process.cwd(), "public", "og");

type Image = { key: string; render: () => Promise<Response> };

function images(): Image[] {
  const index = JSON.parse(
    fs.readFileSync(path.join(SRD_DATA_DIR, "index.json"), "utf8"),
  ) as IndexEntry[];
  const list: Image[] = [
    {
      key: "site",
      render: () =>
        ogImage({
          accent: OG_TYPE_COLORS.spell,
          top: REFERENCE_TYPES.map((t) => (
            <OgChip
              key={t}
              icon={CARD_TYPES[t].icon}
              color={OG_TYPE_COLORS[t]}
              size={64}
            />
          )),
          title: "The SRD 5.2.1, as cards",
          subtitle:
            "Browse spells, monsters, and more, and organize them into stacks for a character, an encounter, or a campaign.",
          footnote: "5E compatible",
        }),
    },
  ];
  for (const type of REFERENCE_TYPES) {
    const config = CARD_TYPES[type];
    const color = OG_TYPE_COLORS[type];
    const count = index.filter((e) => e.type === type).length;
    list.push({
      key: config.route!,
      render: () =>
        ogImage({
          accent: color,
          top: (
            <OgTypeLabel icon={config.icon} color={color} label="Reference" />
          ),
          title: config.plural,
          subtitle: `${count} entries from the System Reference Document 5.2.1`,
        }),
    });
    const entries = JSON.parse(
      fs.readFileSync(path.join(SRD_DATA_DIR, `${type}.json`), "utf8"),
    ) as SrdEntry[];
    for (const entry of entries)
      list.push({
        key: `${config.route}/${entry.slug}`,
        render: () =>
          ogImage({
            accent: color,
            top: (
              <OgTypeLabel
                icon={config.icon}
                color={color}
                label={config.label}
              />
            ),
            title: entry.name,
            subtitle: entry.subtitle,
            footnote: `SRD 5.2.1 · p. ${entry.page}`,
          }),
      });
  }
  for (const example of EXAMPLES) {
    const cards = example.stacks.reduce((n, s) => n + s.cards.length, 0);
    list.push({
      key: `examples/${example.slug}`,
      render: () =>
        ogImage({
          accent: OG_TYPE_COLORS.custom,
          top: (
            <OgTypeLabel
              icon={GiCardRandom}
              color={OG_TYPE_COLORS.custom}
              label="Example collection"
            />
          ),
          title: example.name.replace(/\s*\(example\)$/, ""),
          subtitle: example.summary,
          footnote: `${example.stacks.length} stacks · ${cards} cards`,
        }),
    });
  }
  return list;
}

export async function emitOgImages() {
  const hash = ogHash();
  const target = path.join(PUBLIC_DIR, hash);
  const done = path.join(target, ".done");
  if (fs.existsSync(done)) {
    console.log(`OG images ${hash} already emitted.`);
    return;
  }
  const started = Date.now();
  fs.rmSync(PUBLIC_DIR, { recursive: true, force: true });
  const list = images();
  for (const { key, render } of list) {
    const file = path.join(target, `${key}.png`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(await (await render()).arrayBuffer()));
  }
  // Written last, so an interrupted run starts over.
  fs.writeFileSync(done, "");
  console.log(
    `Emitted ${list.length} OG images to public/og/${hash}/ in ${Date.now() - started}ms.`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) await emitOgImages();
