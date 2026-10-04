import { NotebookPenIcon } from "lucide-react";
import { CARD_TYPES, type CardKind } from "@/lib/srd/card-types";
import { cn } from "@/lib/utils";
import { Highlight, termsNotIn } from "./highlight";
import { TypeChip } from "./type-icon";

/** The collapsed card row: type chip, name, subtitle, quantity and notes markers. */
export function CardHeaderContent({
  kind,
  name,
  subtitle,
  quantity = 1,
  hasNotes,
  missing,
  highlight,
  className,
}: {
  kind: CardKind;
  name: string;
  subtitle?: string;
  quantity?: number;
  hasNotes?: boolean;
  missing?: boolean;
  /** Search terms (from `queryTerms`) to mark in the name and subtitle. */
  highlight?: string[];
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-2.5", className)}>
      <TypeChip kind={kind} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="truncate font-serif text-[1.02rem] font-semibold leading-tight">
            {name ? (
              <Highlight text={name} terms={highlight ?? []} />
            ) : (
              "Untitled"
            )}
          </span>
          {quantity > 1 && (
            <span
              className={cn(
                "shrink-0 rounded px-1 text-xs font-semibold tabular-nums",
                CARD_TYPES[kind].className.soft,
                CARD_TYPES[kind].className.fg,
              )}
              aria-label={`Quantity ${quantity}`}
            >
              ×{quantity}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {missing ? (
            <span className="text-destructive">Missing SRD entry</span>
          ) : (
            <span className="truncate">
              {subtitle && highlight?.length ? (
                <Highlight
                  text={subtitle}
                  terms={termsNotIn(name, highlight)}
                  wordStart
                />
              ) : (
                subtitle
              )}
            </span>
          )}
          {hasNotes && (
            <NotebookPenIcon
              className="size-3 shrink-0"
              aria-label="Has notes"
            />
          )}
        </div>
      </div>
    </div>
  );
}
