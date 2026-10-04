import { ABILITIES } from "@/lib/srd/constants";
import type { StatBlock } from "@/lib/srd/schema";
import { cn } from "@/lib/utils";
import { Html, RunIn } from "./html";

const ABILITY_LABELS: Record<(typeof ABILITIES)[number], string> = {
  str: "Str",
  dex: "Dex",
  con: "Con",
  int: "Int",
  wis: "Wis",
  cha: "Cha",
};

/** A compact 5.2.1-style stat block that fits a ~340px column. */
export function StatBlockView({
  block,
  showName,
  className,
}: {
  block: StatBlock;
  showName?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("@container space-y-2 text-sm", className)}>
      {showName && (
        <div className="font-serif text-lg font-semibold leading-tight">
          {block.name}
        </div>
      )}
      <p className="italic text-muted-foreground">{block.meta}</p>

      <div className="space-y-0.5">
        <p>
          <b>AC</b> {block.ac}
          {block.initiative && (
            <>
              <span className="mx-2 text-muted-foreground/60">·</span>
              <b>Initiative</b> {block.initiative}
            </>
          )}
        </p>
        <p>
          <b>HP</b> {block.hp}
        </p>
        <p>
          <b>Speed</b> {block.speed}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-md bg-muted/60 p-1.5 text-center text-xs tabular-nums @lg:grid-cols-6">
        {ABILITIES.map((key) => {
          const a = block.abilities[key];
          return (
            <div key={key} className="rounded bg-background/70 px-1 py-1">
              <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                {ABILITY_LABELS[key]}
              </div>
              <div className="text-sm font-semibold">{a.score}</div>
              <div className="text-muted-foreground">
                <span title="Modifier">{a.mod}</span>
                <span className="mx-1 opacity-50">/</span>
                <span title="Saving throw">{a.save}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-0.5">
        {block.fields.map((f) => (
          <p key={f.label}>
            <b>{f.label}</b>{" "}
            <span dangerouslySetInnerHTML={{ __html: f.value }} />
          </p>
        ))}
        <p>
          <b>CR</b> {block.cr}
          {block.crDetail && (
            <span className="text-muted-foreground"> ({block.crDetail})</span>
          )}
        </p>
      </div>

      {block.sections.map((section) => (
        <div key={section.title}>
          <h4 className="mt-3 border-b pb-0.5 font-serif text-[0.95rem] font-semibold">
            {section.title}
          </h4>
          {section.intro && (
            <Html
              html={section.intro}
              className="mt-1.5 italic text-muted-foreground"
            />
          )}
          <div className="mt-1.5 space-y-1.5">
            {section.entries.map((entry, i) => (
              <RunIn
                key={`${entry.name}-${i}`}
                name={entry.name}
                html={entry.description}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
