import { cn } from "@/lib/utils";
import { CARD_TYPES, type CardKind } from "@/lib/srd/card-types";

/** Game Icons glyph for a card type, in the type's accent color. */
export function TypeIcon({
  kind,
  className,
}: {
  kind: CardKind;
  className?: string;
}) {
  const { icon: Icon, className: cls } = CARD_TYPES[kind];
  return (
    <Icon
      aria-hidden
      className={cn("size-4 shrink-0", cls.accent, className)}
    />
  );
}

/** Icon on a tinted rounded square, used in card headers and list rows. */
export function TypeChip({
  kind,
  className,
}: {
  kind: CardKind;
  className?: string;
}) {
  const { icon: Icon, className: cls, label } = CARD_TYPES[kind];
  return (
    <span
      title={label}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-md",
        cls.soft,
        cls.fg,
        className,
      )}
    >
      <Icon aria-hidden className="size-4" />
    </span>
  );
}
