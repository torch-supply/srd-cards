import Link from "next/link";
import { referenceHref } from "@/lib/srd/card-types";
import type {
  ClassEntry,
  ConditionEntry,
  EquipmentEntry,
  FeatEntry,
  MagicItemEntry,
  RuleEntry,
  SpellEntry,
  SrdEntry,
  SubclassEntry,
} from "@/lib/srd/schema";
import { FeatureAccordion, type FeatureItem } from "./feature-list";
import { Facts, Html, SectionTitle } from "./html";
import { SrdTableView } from "./srd-table";
import { StatBlockView } from "./stat-block";

/**
 * Full details of a rendered SRD entry (prose fields are HTML).
 * `compact` is the in-card variant: long content (class features) collapses
 * into an accordion and the widest tables link to the reference page.
 */
export function EntryDetail({ entry, compact = false }: { entry: SrdEntry; compact?: boolean }) {
  switch (entry.type) {
    case "spell":
      return <SpellDetail entry={entry} />;
    case "monster":
      return <StatBlockView block={entry} />;
    case "class":
      return <ClassDetail entry={entry} compact={compact} />;
    case "subclass":
      return <SubclassDetail entry={entry} compact={compact} />;
    case "equipment":
      return <EquipmentDetail entry={entry} />;
    case "magic-item":
      return <MagicItemDetail entry={entry} />;
    case "feat":
      return <FeatDetail entry={entry} />;
    case "condition":
    case "rule":
      return <TextDetail entry={entry} />;
  }
}

function SpellDetail({ entry }: { entry: SpellEntry }) {
  return (
    <div className="space-y-3">
      <Facts
        rows={[
          { label: "Casting Time", value: entry.castingTime },
          { label: "Range", value: entry.range },
          { label: "Components", value: entry.componentsText },
          { label: "Duration", value: entry.duration },
          { label: "Classes", value: entry.classes.join(", ") },
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

function Features({ features, compact }: { features: FeatureItem[]; compact: boolean }) {
  if (compact) return <FeatureAccordion features={features} />;
  return (
    <div className="space-y-4">
      {features.map((f, i) => (
        <section key={`${f.level}-${f.name}-${i}`}>
          <h4 className="font-serif text-base font-semibold">
            <span className="mr-2 text-sm font-normal text-muted-foreground">Level {f.level}:</span>
            {f.name}
          </h4>
          <Html html={f.description} className="mt-1" />
        </section>
      ))}
    </div>
  );
}

function ClassDetail({ entry, compact }: { entry: ClassEntry; compact: boolean }) {
  return (
    <div className="space-y-3">
      <Facts rows={entry.coreTraits.map((t) => ({ label: t.label, value: t.value }))} className="text-[0.8125rem]" />
      {compact ? (
        <p className="text-xs text-muted-foreground">
          <Link href={referenceHref("class", entry.slug)} className="underline underline-offset-2">
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
      {!compact && entry.spellList && (
        <>
          <SectionTitle>{entry.name} Spell List</SectionTitle>
          <div className="space-y-2 text-sm">
            {entry.spellList.map((group) => (
              <p key={group.level}>
                <b>{group.level === 0 ? "Cantrips" : `Level ${group.level}`}:</b> {group.spells.join(", ")}
              </p>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SubclassDetail({ entry, compact }: { entry: SubclassEntry; compact: boolean }) {
  return (
    <div className="space-y-3">
      <Html html={entry.description} />
      <SectionTitle>Subclass Features</SectionTitle>
      <Features features={entry.features} compact={compact} />
    </div>
  );
}

function EquipmentDetail({ entry }: { entry: EquipmentEntry }) {
  const rows: { label: string; value: React.ReactNode }[] = [];
  if (entry.weapon) {
    rows.push({ label: "Damage", value: entry.weapon.damage });
    rows.push({ label: "Properties", value: entry.weapon.properties.join(", ") || "—" });
    rows.push({ label: "Mastery", value: entry.weapon.mastery });
  }
  if (entry.armor) {
    rows.push({ label: "Armor Class", value: entry.armor.ac });
    rows.push({ label: "Strength", value: entry.armor.strength });
    rows.push({ label: "Stealth", value: entry.armor.stealth });
  }
  for (const f of entry.fields ?? []) rows.push({ label: f.label, value: <span dangerouslySetInnerHTML={{ __html: f.value }} /> });
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

