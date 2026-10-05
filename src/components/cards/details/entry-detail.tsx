import Link from "next/link";
import { Fragment } from "react";
import { referenceHref } from "@/lib/srd/card-types";
import { hrefFor, type SrdLinks } from "@/lib/srd/links";
import type {
  BackgroundEntry,
  ClassEntry,
  ConditionEntry,
  EquipmentEntry,
  FeatEntry,
  MagicItemEntry,
  RuleEntry,
  SpeciesEntry,
  SpellEntry,
  SrdEntry,
  SubclassEntry,
} from "@/lib/srd/schema";
import { FeatureAccordion, type FeatureItem } from "./feature-list";
import { entryLinkClass, Facts, Html, SectionTitle } from "./html";
import { SrdTableView } from "./srd-table";
import { StatBlockView } from "./stat-block";

/**
 * Full details of a rendered SRD entry (prose fields are HTML).
 * `compact` is the in-card variant: long content (class features) collapses
 * into an accordion and the widest tables link to the reference page.
 * `links` (reference pages only) links names in structured fields to their
 * entries: a spell's classes, a class's spell list, a weapon's properties.
 */
export function EntryDetail({
  entry,
  compact = false,
  links,
}: {
  entry: SrdEntry;
  compact?: boolean;
  links?: SrdLinks;
}) {
  switch (entry.type) {
    case "background":
      return <BackgroundDetail entry={entry} links={links} />;
    case "species":
      return <SpeciesDetail entry={entry} />;
    case "spell":
      return <SpellDetail entry={entry} links={links} />;
    case "monster":
      return <StatBlockView block={entry} />;
    case "class":
      return <ClassDetail entry={entry} compact={compact} links={links} />;
    case "subclass":
      return <SubclassDetail entry={entry} compact={compact} links={links} />;
    case "equipment":
      return <EquipmentDetail entry={entry} links={links} />;
    case "magic-item":
      return <MagicItemDetail entry={entry} />;
    case "feat":
      return <FeatDetail entry={entry} />;
    case "condition":
    case "rule":
      return <TextDetail entry={entry} />;
  }
}

/** Names joined by commas, each linked when `href` finds its entry. */
function LinkedNames({
  names,
  href,
}: {
  names: string[];
  href: (name: string) => string | undefined;
}) {
  return names.map((name, i) => {
    const to = href(name);
    return (
      <Fragment key={`${name}-${i}`}>
        {i > 0 && ", "}
        {to ? (
          <Link href={to} className={entryLinkClass}>
            {name}
          </Link>
        ) : (
          name
        )}
      </Fragment>
    );
  });
}

function SpellDetail({
  entry,
  links,
}: {
  entry: SpellEntry;
  links?: SrdLinks;
}) {
  return (
    <div className="space-y-3">
      <Facts
        rows={[
          { label: "Casting Time", value: entry.castingTime },
          { label: "Range", value: entry.range },
          { label: "Components", value: entry.componentsText },
          { label: "Duration", value: entry.duration },
          {
            label: "Classes",
            value: (
              <LinkedNames
                names={entry.classes}
                href={(name) => hrefFor(links, "class", name)}
              />
            ),
          },
        ]}
      />
      <Html html={entry.description} />
      {entry.statBlocks?.map((block) => (
        <div key={block.name} className="rounded-md border bg-muted/20 p-3">
          <StatBlockView block={block} showName />
        </div>
      ))}
    </div>
  );
}

function Features({
  features,
  compact,
}: {
  features: FeatureItem[];
  compact: boolean;
}) {
  if (compact) return <FeatureAccordion features={features} />;
  return (
    <div className="space-y-4">
      {features.map((f, i) => (
        <section key={`${f.level}-${f.name}-${i}`}>
          <h4 className="font-serif text-base font-semibold">
            <span className="mr-2 text-sm font-normal text-muted-foreground">
              Level {f.level}:
            </span>
            {f.name}
          </h4>
          <Html html={f.description} className="mt-1" />
        </section>
      ))}
    </div>
  );
}

function ClassDetail({
  entry,
  compact,
  links,
}: {
  entry: ClassEntry;
  compact: boolean;
  links?: SrdLinks;
}) {
  const subclasses = links
    ? entry.subclassIds.flatMap((id) => links.byId.get(id) ?? [])
    : [];
  return (
    <div className="space-y-3">
      <Facts
        rows={entry.coreTraits.map((t) => ({ label: t.label, value: t.value }))}
        className="text-[0.8125rem]"
      />
      {compact ? (
        <p className="text-xs text-muted-foreground">
          <Link
            href={referenceHref("class", entry.slug)}
            className="underline underline-offset-2"
          >
            Full {entry.name} Features table ↗
          </Link>
        </p>
      ) : (
        <>
          <Html html={entry.description} />
          <SrdTableView table={entry.featuresTable} />
        </>
      )}
      <SectionTitle>Class Features</SectionTitle>
      <Features features={entry.features} compact={compact} />
      {subclasses.length > 0 && (
        <>
          <SectionTitle>{entry.name} Subclasses</SectionTitle>
          <p className="text-sm">
            <LinkedNames
              names={subclasses.map((s) => s.name)}
              href={(name) => subclasses.find((s) => s.name === name)?.href}
            />
          </p>
        </>
      )}
      {!compact && entry.spellList && (
        <>
          <SectionTitle>{entry.name} Spell List</SectionTitle>
          <div className="space-y-2 text-sm">
            {entry.spellList.map((group) => (
              <p key={group.level}>
                <b>
                  {group.level === 0 ? "Cantrips" : `Level ${group.level}`}:
                </b>{" "}
                <LinkedNames
                  names={group.spells}
                  href={(name) => hrefFor(links, "spell", name)}
                />
              </p>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SubclassDetail({
  entry,
  compact,
  links,
}: {
  entry: SubclassEntry;
  compact: boolean;
  links?: SrdLinks;
}) {
  const parent = links?.byId.get(entry.classId);
  return (
    <div className="space-y-3">
      {parent && (
        <Facts
          rows={[
            {
              label: "Class",
              value: (
                <Link href={parent.href} className={entryLinkClass}>
                  {parent.name}
                </Link>
              ),
            },
          ]}
        />
      )}
      <Html html={entry.description} />
      <SectionTitle>Subclass Features</SectionTitle>
      <Features features={entry.features} compact={compact} />
    </div>
  );
}

function BackgroundDetail({
  entry,
  links,
}: {
  entry: BackgroundEntry;
  links?: SrdLinks;
}) {
  const feat = links?.byId.get(entry.featId);
  return (
    <Facts
      rows={entry.fields.map((f) => ({
        label: f.label,
        value:
          // “Magic Initiate (Cleric) (see “Feats”)”: link the feat's name.
          f.label === "Feat" && feat && f.value.startsWith(entry.feat) ? (
            <>
              <Link href={feat.href} className={entryLinkClass}>
                {entry.feat}
              </Link>
              <span
                className="srd-inline"
                dangerouslySetInnerHTML={{
                  __html: f.value.slice(entry.feat.length),
                }}
              />
            </>
          ) : f.label === "Tool Proficiency" &&
            hrefFor(links, "equipment", f.value) ? (
            <LinkedNames
              names={[f.value]}
              href={(name) => hrefFor(links, "equipment", name)}
            />
          ) : (
            <span
              className="srd-inline"
              dangerouslySetInnerHTML={{ __html: f.value }}
            />
          ),
      }))}
    />
  );
}

function SpeciesDetail({ entry }: { entry: SpeciesEntry }) {
  return (
    <div className="space-y-3">
      <Facts
        rows={[
          { label: "Creature Type", value: entry.creatureType },
          { label: "Size", value: entry.size },
          { label: "Speed", value: entry.speed },
        ]}
      />
      <Html html={entry.description} />
    </div>
  );
}

function EquipmentDetail({
  entry,
  links,
}: {
  entry: EquipmentEntry;
  links?: SrdLinks;
}) {
  const rows: { label: string; value: React.ReactNode }[] = [];
  if (entry.weapon) {
    rows.push({ label: "Damage", value: entry.weapon.damage });
    rows.push({
      label: "Properties",
      value: entry.weapon.properties.length ? (
        <LinkedNames
          names={entry.weapon.properties}
          // “Versatile (1d10)” is the Versatile property.
          href={(name) =>
            hrefFor(links, "Weapon Property", name.replace(/ \(.*$/, ""))
          }
        />
      ) : (
        "—"
      ),
    });
    rows.push({
      label: "Mastery",
      value: (
        <LinkedNames
          names={[entry.weapon.mastery]}
          href={(name) => hrefFor(links, "Mastery Property", name)}
        />
      ),
    });
  }
  if (entry.armor) {
    rows.push({ label: "Armor Class", value: entry.armor.ac });
    rows.push({ label: "Strength", value: entry.armor.strength });
    rows.push({ label: "Stealth", value: entry.armor.stealth });
  }
  for (const f of entry.fields ?? [])
    rows.push({
      label: f.label,
      value: (
        <span
          className="srd-inline"
          dangerouslySetInnerHTML={{ __html: f.value }}
        />
      ),
    });
  if (entry.weight) rows.push({ label: "Weight", value: entry.weight });
  if (entry.cost) rows.push({ label: "Cost", value: entry.cost });
  return (
    <div className="space-y-3">
      {rows.length > 0 && <Facts rows={rows} />}
      {entry.description && <Html html={entry.description} />}
    </div>
  );
}

function MagicItemDetail({ entry }: { entry: MagicItemEntry }) {
  return (
    <div className="space-y-3">
      <p className="text-sm italic text-muted-foreground">{entry.meta}</p>
      <Html html={entry.description} />
      {entry.statBlocks?.map((block) => (
        <div key={block.name} className="rounded-md border bg-muted/20 p-3">
          <StatBlockView block={block} showName />
        </div>
      ))}
    </div>
  );
}

function FeatDetail({ entry }: { entry: FeatEntry }) {
  return (
    <div className="space-y-3">
      <p className="text-sm italic text-muted-foreground">{entry.meta}</p>
      <Html html={entry.description} />
    </div>
  );
}

function TextDetail({ entry }: { entry: ConditionEntry | RuleEntry }) {
  return <Html html={entry.description} />;
}
