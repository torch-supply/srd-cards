import type {
  EquipmentEntry,
  LabelValue,
  RuleEntry,
} from "../../../src/lib/srd/schema";
import {
  type Block,
  type HeadingBlock,
  type ParaBlock,
  parseTable,
  type SidebarBlock,
  type Table,
  type TableBlock,
  type TableRow,
  tableToMarkdown,
} from "../pdf/blocks";
import type { Line, Span } from "../pdf/extract";
import { appendLine, slugify, spansText, spansToMarkdown } from "../pdf/text";
import {
  blocksFor,
  blocksToMarkdown,
  CHAPTERS,
  type Ctx,
  titleCase,
} from "./common";

/** A table row; `x` (left edge) tells which rows a group label covers: the ones indented below it. */
type GridRow = TableRow & { x?: number };

/** A titled table, parsed (and merged when the PDF splits it into side-by-side panels). */
interface GridItem {
  kind: "grid";
  table: Table & { rows: GridRow[] };
  page: number;
}

/** A folded sub-heading inside a rule's description. */
interface SubHeading {
  kind: "sub";
  text: string;
  depth: number;
}

type Item = Block | GridItem | SubHeading;

interface Section {
  heading: HeadingBlock;
  /** 1 chapter (26pt), 2 section (18pt), 3 subsection (14pt), 4 entry (12pt). */
  level: number;
  items: Item[];
  children: Section[];
  parent?: Section;
}

/** Sections whose subsections stay inside one rule instead of becoming their own. */
const FOLDED = new Set([
  "Lifestyle Expenses",
  "Crafting Nonmagical Items",
  "Scribing Spell Scrolls",
]);

/** Subsections whose 12pt entries become separate rules, with the slug prefix and tag to use. */
const PROPERTY_LISTS: Record<string, { prefix: string; tag: string }> = {
  Properties: { prefix: "weapon-property", tag: "Weapon Property" },
  "Mastery Properties": { prefix: "mastery", tag: "Mastery Property" },
};

/** Rows of "Tack, Harness, and Drawn Vehicles" that are vehicles rather than tack. */
const DRAWN_VEHICLES = new Set([
  "Carriage",
  "Cart",
  "Chariot",
  "Sled",
  "Wagon",
]);

export function parseEquipment(ctx: Ctx): {
  equipment: EquipmentEntry[];
  rules: RuleEntry[];
} {
  const blocks = blocksFor(ctx, CHAPTERS.equipment).map(fixText);
  const { preamble, sections } = buildTree(parseTables(blocks, ctx));
  placeTables(sections, ctx);

  const equipment: EquipmentEntry[] = [];
  const rules: RuleEntry[] = [];
  const taken = new Set<string>();

  const addItem = (entry: ItemDraft) => {
    let slug = slugify(entry.name);
    if (taken.has(`equipment:${slug}`)) {
      const alt = `${slug}-${slugify(entry.subcategory ?? entry.category)}`;
      ctx.warnings.push(
        `Equipment "${entry.name}": slug "${slug}" taken, using "${alt}".`,
      );
      slug = alt;
    }
    taken.add(`equipment:${slug}`);
    equipment.push({
      id: `equipment:${slug}`,
      type: "equipment",
      slug,
      ...entry,
    });
  };

  const pushRule = (
    name: string,
    page: number,
    description: string,
    section: string,
    opts: { slug?: string; subtitle?: string; tag?: string } = {},
  ) => {
    if (!description) return;
    const slug = opts.slug ?? `equipment-${slugify(name)}`;
    if (taken.has(`rule:${slug}`))
      ctx.warnings.push(`Equipment rule "${name}": duplicate slug "${slug}".`);
    taken.add(`rule:${slug}`);
    rules.push({
      id: `rule:${slug}`,
      type: "rule",
      slug,
      name,
      subtitle: opts.subtitle ?? section,
      page,
      section,
      ...(opts.tag ? { tag: opts.tag } : {}),
      description,
    });
  };

  /** A rule from a section's content; titled sidebars in it ("Improvised Weapons") become rules of their own. */
  const addRule = (
    heading: HeadingBlock,
    items: Item[],
    section: string,
    opts?: Parameters<typeof pushRule>[4],
  ) => {
    const sidebars = items.filter(
      (b): b is SidebarBlock => b.kind === "sidebar" && !!b.title,
    );
    const rest = items.filter((b) => !sidebars.includes(b as SidebarBlock));
    pushRule(heading.text, heading.page, render(rest, ctx), section, opts);
    for (const b of sidebars) {
      pushRule(
        titleCase(b.title!),
        b.page,
        b.paras.map((p) => spansToMarkdown(p)).join("\n\n"),
        section,
      );
    }
  };

  const findTable = (title: string) => {
    for (const s of sections) {
      const t = s.items.find(
        (i): i is GridItem => i.kind === "grid" && i.table.title === title,
      );
      if (t) return t;
    }
    ctx.warnings.push(`Equipment: table "${title}" not found.`);
    return undefined;
  };

  const chapter = sections.find(
    (s) => s.level === 1 && s.heading.text === "Equipment",
  );
  if (!chapter) {
    ctx.warnings.push(`Equipment: chapter heading not found.`);
    return { equipment, rules };
  }
  addRule(chapter.heading, [...preamble, ...chapter.items], "Equipment");

  for (const h2 of chapter.children) {
    const name = h2.heading.text;
    const folded = FOLDED.has(name);
    addRule(h2.heading, folded ? flatten(h2) : h2.items, "Equipment");
    if (folded) continue;

    if (name === "Weapons")
      weaponItems(findTable("Weapons"), ctx).forEach(addItem);
    if (name === "Armor") armorItems(findTable("Armor"), ctx).forEach(addItem);
    if (name === "Mounts and Vehicles") {
      const saddles = h2.children.find((s) => s.heading.text === "Saddles");
      mountItems(
        findTable("Mounts and Other Animals"),
        findTable("Tack, Harness, and Drawn Vehicles"),
        saddles,
        ctx,
      ).forEach(addItem);
      vehicleItems(findTable("Airborne and Waterborne Vehicles")).forEach(
        addItem,
      );
    }
    const gearTable =
      name === "Adventuring Gear" ? findTable("Adventuring Gear") : undefined;
    const gearRows = new Set(records(gearTable).map((r) => r.cells.Item));

    for (const sub of h2.children) {
      const where = `Equipment › ${name}`;
      const list = PROPERTY_LISTS[sub.heading.text];
      if (gearTable && sub.level === 4) {
        for (const item of gearItems(sub, gearTable, ctx)) {
          gearRows.delete(item.name);
          addItem(item);
        }
      } else if (list && name === "Weapons") {
        addRule(sub.heading, sub.items, where);
        for (const prop of sub.children) {
          addRule(
            prop.heading,
            flatten(prop),
            `${where} › ${sub.heading.text}`,
            {
              slug: `${list.prefix}-${slugify(prop.heading.text)}`,
              subtitle: list.tag,
              tag: list.tag,
            },
          );
        }
      } else if (name === "Tools" && sub.children.length) {
        addRule(sub.heading, sub.items, where);
        for (const tool of sub.children)
          toolItems(tool, sub.heading.text, ctx).forEach(addItem);
      } else {
        addRule(sub.heading, flatten(sub), where);
      }
    }
    for (const row of gearRows)
      ctx.warnings.push(
        `Adventuring Gear "${row}": table row without a description.`,
      );
  }
  return { equipment, rules };
}

// --- Items -----------------------------------------------------------------

type ItemDraft = Omit<EquipmentEntry, "id" | "type" | "slug">;

/** Table rows as header → cell maps, with the group label ("Simple Melee Weapons") they fall under. */
function records(
  grid: GridItem | undefined,
): { cells: Record<string, string>; group?: string; page: number }[] {
  if (!grid) return [];
  const out: { cells: Record<string, string>; group?: string; page: number }[] =
    [];
  let group: GridRow | undefined;
  for (const row of grid.table.rows) {
    if (row.group) {
      group = row;
      continue;
    }
    // "Sled" after the indented saddles is back at the group's indent: no longer a saddle.
    if (group?.x !== undefined && row.x !== undefined && row.x <= group.x + 2)
      group = undefined;
    const cells = Object.fromEntries(
      grid.table.header.map((h, i) => [h, row.cells[i] ?? ""]),
    );
    out.push({ cells, group: group?.cells[0], page: row.page });
  }
  return out;
}

/** "—" means "none" in the tables; such values are left out. */
function value(text: string | undefined) {
  return text && text !== "—" ? text : undefined;
}

function weaponItems(grid: GridItem | undefined, ctx: Ctx): ItemDraft[] {
  return records(grid).map(({ cells, group, page }) => {
    if (!group)
      ctx.warnings.push(`Weapon "${cells.Name}": no category row above it.`);
    const subcategory = group ?? "";
    const damage = cells.Damage ?? "";
    return {
      name: cells.Name,
      subtitle: `${subcategory.replace(/s$/, "")} · ${damage}`,
      page,
      category: "Weapon",
      subcategory,
      cost: value(cells.Cost),
      weight: value(cells.Weight),
      weapon: {
        damage,
        properties: value(cells.Properties) ? splitList(cells.Properties) : [],
        mastery: cells.Mastery ?? "",
      },
    };
  });
}

const DON_DOFF = /^(.+?) \((.+?) to Don (?:or Doff|and (.+?) to Doff)\)$/;

function armorItems(grid: GridItem | undefined, ctx: Ctx): ItemDraft[] {
  return records(grid).map(({ cells, group, page }) => {
    const m = group?.match(DON_DOFF);
    if (!m)
      ctx.warnings.push(
        `Armor "${cells.Armor}": unrecognized category row "${group}".`,
      );
    const subcategory = m?.[1] ?? group ?? "";
    const ac = cells["Armor Class (AC)"] ?? "";
    return {
      name: cells.Armor,
      subtitle: `${subcategory} · AC ${ac}`,
      page,
      category: "Armor",
      subcategory,
      cost: value(cells.Cost),
      weight: value(cells.Weight),
      armor: {
        ac,
        strength: cells.Strength ?? "",
        stealth: cells.Stealth ?? "",
      },
      ...(m
        ? {
            fields: [
              { label: "Don", value: m[2] },
              { label: "Doff", value: m[3] ?? m[2] },
            ],
          }
        : {}),
    };
  });
}

/** "Alchemist’s Supplies (50 GP)" → name and cost. */
function nameAndCost(heading: string) {
  const m = heading.match(/^(.+?) \(([^()]+)\)$/);
  return { name: m?.[1] ?? heading, cost: m?.[2] };
}

/** A tool: heading with cost, then label/value lines (Ability, Weight, Utilize, Craft, Variants). */
function toolItems(
  section: Section,
  subcategory: string,
  ctx: Ctx,
): ItemDraft[] {
  const { name, cost } = nameAndCost(section.heading.text);
  const fieldBlock = section.items.find(
    (b): b is TableBlock => b.kind === "table",
  );
  if (!fieldBlock) {
    ctx.warnings.push(`Tool "${name}": missing Ability/Utilize block.`);
    return [];
  }
  // Lines in content-stream order (a tool can continue on the next page or column).
  const parsed: { label: string; spans: Span[] }[] = [];
  for (const line of fieldBlock.lines) {
    let current = parsed[parsed.length - 1];
    let continuation = true;
    for (const span of line.spans) {
      if (span.font === "gill-sb" && /:\s*$/.test(span.text)) {
        current = { label: span.text.replace(/:\s*$/, "").trim(), spans: [] };
        parsed.push(current);
        continuation = false;
      } else if (!current) {
        ctx.warnings.push(
          `Tool "${name}": text before the first label: "${span.text}".`,
        );
      } else if (continuation) {
        appendLine(current.spans, [span], ctx.dict);
        continuation = false;
      } else {
        current.spans.push({ ...span });
      }
    }
  }
  const text = (label: string) => {
    const f = parsed.find((p) => p.label === label);
    return f ? spansToMarkdown(f.spans) : undefined;
  };
  const fields: LabelValue[] = parsed
    .filter((p) => p.label !== "Weight")
    .map((p) => ({ label: p.label, value: spansToMarkdown(p.spans) }));
  const description = render(
    section.items.filter((b) => b !== fieldBlock),
    ctx,
  );
  const tool: ItemDraft = {
    name,
    subtitle: [subcategory, cost].filter(Boolean).join(" · "),
    page: section.heading.page,
    category: "Tool",
    subcategory,
    cost,
    weight: value(text("Weight")),
    fields,
    ...(description ? { description } : {}),
  };

  // Variants ("Bagpipes (30 GP, 6 lb.), drum (6 GP, 3 lb.), …") are items too; they share Ability and Utilize.
  const variants = text("Variants");
  const shared = fields.filter((f) => f.label !== "Variants");
  const children = (variants ? splitList(variants) : []).map((v): ItemDraft => {
    const m = v.match(/^(.+?) \((.+)\)$/);
    if (!m) ctx.warnings.push(`Tool "${name}": unrecognized variant "${v}".`);
    const [vCost, vWeight] = (m?.[2] ?? "").split(/,\s*/);
    const vName = (m?.[1] ?? v).replace(/^\p{Ll}/u, (c) => c.toUpperCase());
    return {
      name: vName,
      subtitle: `${name} · ${vCost}`,
      page: section.heading.page,
      category: "Tool",
      subcategory: name,
      cost: vCost,
      weight: value(vWeight ?? text("Weight")),
      fields: shared.map((f) => ({ ...f })),
    };
  });
  return [tool, ...children];
}

/** An Adventuring Gear entry: heading with price, description, and its Adventuring Gear table row. */
function gearItems(
  section: Section,
  gearTable: GridItem | undefined,
  ctx: Ctx,
): ItemDraft[] {
  const rows = new Map(records(gearTable).map((r) => [norm(r.cells.Item), r]));
  const { name, cost } = nameAndCost(section.heading.text);
  const description = render(section.items, ctx);
  // "Spell Scroll (Cantrip, 30 GP; Level 1, 50 GP)" lists two items.
  const variants = cost?.includes(";")
    ? cost.split(/;\s*/).map((v) => {
        const m = v.match(/^(.+?),\s*(.+)$/);
        return { name: `${name} (${m?.[1] ?? v})`, cost: m?.[2] };
      })
    : [{ name, cost }];

  const items = variants.map((v): ItemDraft => {
    const row = rows.get(norm(v.name));
    if (!row)
      ctx.warnings.push(
        `Adventuring Gear "${v.name}": not in the Adventuring Gear table.`,
      );
    else if (row.cells.Cost !== v.cost) {
      ctx.warnings.push(
        `Adventuring Gear "${v.name}": table cost "${row.cells.Cost}" ≠ heading "${v.cost}".`,
      );
    }
    const itemCost = row?.cells.Cost ?? v.cost;
    return {
      name: v.name,
      subtitle: `Adventuring Gear · ${itemCost}`,
      page: section.heading.page,
      category: "Adventuring Gear",
      cost: itemCost,
      weight: value(row?.cells.Weight),
      ...(description ? { description } : {}),
    };
  });

  // Sub-tables (Ammunition, Arcane Focuses, …) list concrete items with their own cost and weight.
  for (const grid of section.items) {
    if (grid.kind !== "grid") continue;
    for (const { cells, page } of records(grid)) {
      const [first, ...rest] = grid.table.header;
      const m = cells[first].match(/^(.+?) \((.+)\)$/);
      const fields: LabelValue[] = rest
        .filter((h) => h !== "Weight" && h !== "Cost")
        .map((h) => ({ label: h, value: cells[h] }));
      if (m) fields.push({ label: "Note", value: m[2] });
      items.push({
        name: (m?.[1] ?? cells[first]).replace(/^\p{Ll}/u, (c) =>
          c.toUpperCase(),
        ),
        subtitle: `${name} · ${cells.Cost}`,
        page,
        category: "Adventuring Gear",
        subcategory: name,
        cost: value(cells.Cost),
        weight: value(cells.Weight),
        ...(fields.length ? { fields } : {}),
      });
    }
  }
  return items;
}

function mountItems(
  mounts: GridItem | undefined,
  tack: GridItem | undefined,
  saddles: Section | undefined,
  ctx: Ctx,
): ItemDraft[] {
  const items: ItemDraft[] = records(mounts).map(({ cells, page }) => ({
    name: cells.Item,
    subtitle: `Mount · ${cells.Cost}`,
    page,
    category: "Mount",
    cost: value(cells.Cost),
    fields: [{ label: "Carrying Capacity", value: cells["Carrying Capacity"] }],
  }));
  // Saddles are described in the "Saddles" section.
  const saddleText = saddles ? render(saddles.items, ctx) : "";
  for (const { cells, group, page } of records(tack)) {
    const name = group ? `${group}, ${cells.Item}` : cells.Item;
    const vehicle = DRAWN_VEHICLES.has(name);
    items.push({
      name,
      subtitle: `${vehicle ? "Drawn Vehicle" : "Tack and Harness"} · ${cells.Cost}`,
      page,
      category: vehicle ? "Vehicle" : "Tack and Harness",
      ...(vehicle
        ? { subcategory: "Drawn Vehicle" }
        : group
          ? { subcategory: group }
          : {}),
      cost: value(cells.Cost),
      weight: value(cells.Weight),
      ...(group === "Saddle" && saddleText ? { description: saddleText } : {}),
    });
  }
  return items;
}

function vehicleItems(grid: GridItem | undefined): ItemDraft[] {
  if (!grid) return [];
  const [first, ...rest] = grid.table.header;
  return records(grid).map(({ cells, page }) => ({
    name: cells[first],
    subtitle: `Large Vehicle · ${cells.Cost}`,
    page,
    category: "Vehicle",
    subcategory: "Large Vehicle",
    cost: value(cells.Cost),
    fields: rest
      .filter((h) => h !== "Cost")
      .map((h) => ({ label: h, value: cells[h] })),
  }));
}

/** Splits "Ammunition (Range 80/320; Bolt), Loading, Two-Handed" at top-level commas. */
function splitList(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

function norm(name: string) {
  return name
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// --- Sections ---------------------------------------------------------------

function levelOf(h: HeadingBlock) {
  return h.size >= 25 ? 1 : h.size >= 17 ? 2 : h.size >= 13.5 ? 3 : 4;
}

/** Nests headings by size. Returns the content before the first heading and all sections in document order. */
function buildTree(items: Item[]): { preamble: Item[]; sections: Section[] } {
  const preamble: Item[] = [];
  const sections: Section[] = [];
  const stack: Section[] = [];
  for (const item of items) {
    if (item.kind !== "heading") {
      (stack[stack.length - 1]?.items ?? preamble).push(item);
      continue;
    }
    const level = levelOf(item);
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    const parent = stack[stack.length - 1];
    const section: Section = {
      heading: item,
      level,
      items: [],
      children: [],
      parent,
    };
    parent?.children.push(section);
    sections.push(section);
    stack.push(section);
  }
  return { preamble, sections };
}

/** A section's own content plus its subsections as sub-headings. */
function flatten(section: Section, depth = 4): Item[] {
  return [
    ...section.items,
    ...section.children.flatMap((c) => [
      { kind: "sub", text: c.heading.text, depth } as SubHeading,
      ...flatten(c, depth + 1),
    ]),
  ];
}

function ownText(section: Section) {
  return section.items
    .filter((b): b is ParaBlock => b.kind === "para")
    .map((b) => spansText(b.spans))
    .join(" ")
    .toLowerCase();
}

/**
 * Tables sit out of reading order in the content stream. Moves each to the first
 * section that refers to it ("The Armor table …", "the Holy Symbol table"), or,
 * when nothing refers to it, to the enclosing 18pt section.
 */
function placeTables(sections: Section[], ctx: Ctx) {
  const texts = sections.map(ownText);
  for (const section of sections) {
    for (const item of [...section.items]) {
      if (item.kind !== "grid" || !item.table.title) continue;
      const title = item.table.title.toLowerCase();
      const refs = [`${title} table`, `${title.replace(/s$/, "")} table`];
      let owner: Section | undefined =
        sections[texts.findIndex((t) => refs.some((r) => t.includes(r)))];
      if (!owner) {
        owner = section;
        while (owner.parent && owner.level > 2) owner = owner.parent;
        ctx.warnings.push(
          `Equipment: no reference to table "${item.table.title}"; placed in "${owner.heading.text}".`,
        );
      }
      if (owner === section) continue;
      section.items.splice(section.items.indexOf(item), 1);
      owner.items.push(item);
    }
  }
}

function render(items: Item[], ctx: Ctx): string {
  const parts: string[] = [];
  let run: Block[] = [];
  const flush = () => {
    const md = blocksToMarkdown(run, ctx);
    if (md) parts.push(md);
    run = [];
  };
  for (const item of items) {
    if (item.kind === "grid") {
      flush();
      parts.push(tableToMarkdown(item.table));
    } else if (item.kind === "sub") {
      flush();
      parts.push(`${"#".repeat(item.depth)} ${item.text}`);
    } else {
      run.push(item);
    }
  }
  flush();
  return parts.join("\n\n");
}

// --- Text fixes ---------------------------------------------------------------

/**
 * Works around two extraction quirks (see the parser report):
 * - a line ending in "15-" followed by "foot" is joined with a space ("15- foot");
 * - the "½" glyph in body text extracts as "1/2" ("11/2 pints" for "1½ pints").
 */
function fixText(block: Block): Block {
  if (block.kind !== "para") return block;
  const joins: [string, string][] = [];
  for (let i = 0; i + 1 < block.lines.length; i++) {
    const a = spansText(block.lines[i].spans).match(/(\d+)-$/);
    const b = spansText(block.lines[i + 1].spans).match(/^\p{L}+/u);
    if (a && b) joins.push([`${a[1]}-`, b[0]]);
  }
  const spans = block.spans.map((s) => ({
    ...s,
    text: s.font.startsWith("body")
      ? s.text.replace(/\b(\d+)1\/2\b/g, "$1½")
      : s.text,
  }));
  spans.forEach((s, i) => {
    for (const [left, right] of joins) {
      s.text = s.text.replace(`${left} ${right}`, `${left}${right}`);
      // The next line usually starts a new span: "… a 15- " + "foot radius …".
      if (s.text.endsWith(`${left} `) && spans[i + 1]?.text.startsWith(right))
        s.text = s.text.slice(0, -1);
    }
  });
  return { ...block, spans };
}

// --- Tables -------------------------------------------------------------------

const isHeaderLine = (line: Line) =>
  line.spans.every((s) => s.font === "gill-sb");
const isGroupLine = (line: Line) =>
  line.spans.length === 1 && line.spans[0].font === "gill-i";

/** Parses titled table blocks into grid items; other blocks pass through. */
function parseTables(blocks: Block[], ctx: Ctx): Item[] {
  const out: Item[] = [];
  const grids: GridItem[] = [];
  for (const block of blocks) {
    if (block.kind !== "table" || !block.title) {
      out.push(block);
      continue;
    }
    let main: GridItem | undefined;
    for (const panel of panelsOf(block)) {
      const parsed = parsePanel(panel, block, ctx);
      if (!main) {
        main = {
          kind: "grid",
          page: block.page,
          table: { title: block.title, ...parsed },
        };
      } else if (sameHeader(parsed.header, main.table.header)) {
        // Side-by-side halves of one table ("Adventuring Gear").
        main.table.rows.push(...parsed.rows);
      } else {
        // Lines of another table glued on in the content stream ("Food, Drink, and Lodging" on p102).
        const owner = [...grids]
          .reverse()
          .find((g) => sameHeader(g.table.header, parsed.header));
        if (owner) owner.table.rows.push(...parsed.rows);
        else
          ctx.warnings.push(
            `Equipment: table panel [${parsed.header.join(" | ")}] in "${block.title}" has no owner.`,
          );
      }
    }
    if (main) {
      grids.push(main);
      out.push(main);
    }
  }
  return out;
}

interface Panel {
  header: Line[];
  lines: Line[];
}

/** Splits a table block where a header line follows data lines. */
function panelsOf(block: TableBlock): Panel[] {
  const panels: Panel[] = [];
  for (const line of block.lines) {
    const current = panels[panels.length - 1];
    if (isHeaderLine(line)) {
      if (current && !current.lines.length) current.header.push(line);
      else panels.push({ header: [line], lines: [] });
    } else if (current) {
      current.lines.push(line);
    } else {
      panels.push({ header: [], lines: [line] });
    }
  }
  return panels;
}

/** Cells of a line: spans closer than a cell gap belong together ("Spell Scroll" + "(Cantrip)"). */
function lineCells(line: Line): Span[][] {
  const cells: Span[][] = [];
  let prev: Span | undefined;
  for (const span of line.spans) {
    if (prev && span.x - prev.x2 < span.size * 0.9)
      cells[cells.length - 1].push(span);
    else cells.push([span]);
    prev = span;
  }
  return cells;
}

/**
 * One table panel. When every row is a single line with the same number of cells,
 * columns come from the rows and each header word goes to the nearest column
 * (headers of centered columns start well left of their values). Otherwise falls
 * back to `parseTable` (rows with wrapped cells, like Weapons).
 */
function parsePanel(
  panel: Panel,
  block: TableBlock,
  ctx: Ctx,
): { header: string[]; rows: GridRow[] } {
  const data = panel.lines.filter((l) => !isGroupLine(l)).map(lineCells);
  const n = data[0]?.length ?? 0;
  if (!n || data.some((cells) => cells.length !== n)) {
    const t = parseTable(
      { ...block, lines: [...panel.header, ...panel.lines] },
      ctx.dict,
    );
    return { header: t.header, rows: t.rows };
  }
  const cols = Array.from({ length: n }, (_, i) => ({
    x: Math.min(...data.map((cells) => cells[i][0].x)),
    x2: Math.max(...data.map((cells) => cells[i][cells[i].length - 1].x2)),
  }));
  const headerWords: string[][] = cols.map(() => []);
  for (const span of panel.header.flatMap((l) => l.spans)) {
    const perChar = (span.x2 - span.x) / Math.max(span.text.length, 1);
    let offset = 0;
    for (const word of span.text.split(/(\s+)/)) {
      if (word.trim()) {
        const center = span.x + (offset + word.length / 2) * perChar;
        const dist = (c: { x: number; x2: number }) =>
          Math.max(0, c.x - center, center - c.x2) * 1000 +
          Math.abs((c.x + c.x2) / 2 - center);
        const best = cols.reduce(
          (bi, c, i) => (dist(c) < dist(cols[bi]) ? i : bi),
          0,
        );
        headerWords[best].push(word);
      }
      offset += word.length;
    }
  }
  const rows: GridRow[] = panel.lines.map((line) =>
    isGroupLine(line)
      ? {
          cells: [spansText(line.spans)],
          group: true,
          x: line.x,
          y: line.y,
          page: line.page,
        }
      : {
          cells: lineCells(line).map((cells) => spansText(cells)),
          x: line.x,
          y: line.y,
          page: line.page,
        },
  );
  return { header: headerWords.map((w) => w.join(" ")), rows };
}

function sameHeader(a: string[], b: string[]) {
  return a.length === b.length && a.every((h, i) => h === b[i]);
}
