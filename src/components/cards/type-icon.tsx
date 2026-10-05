import { iconParts } from "@/lib/icon-parts";
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

const symbolId = (kind: CardKind) => `type-icon-${kind}`;

/**
 * Defines type icons once as SVG symbols, for `TypeChip shared`: a long list
 * then references the icon instead of repeating its paths (~2.5KB a row).
 */
export function TypeIconSymbols({ kinds }: { kinds: CardKind[] }) {
  return (
    <svg aria-hidden className="absolute size-0 overflow-hidden">
      {kinds.map((kind) => {
        const { attr, children } = iconParts(CARD_TYPES[kind].icon);
        return (
          <symbol key={kind} id={symbolId(kind)} viewBox={attr.viewBox}>
            {children}
          </symbol>
        );
      })}
    </svg>
  );
}

/**
 * Icon on a tinted rounded square, used in card headers and list rows.
 * `shared` uses the symbol from a `TypeIconSymbols` on the page.
 */
export function TypeChip({
  kind,
  className,
  shared = false,
}: {
  kind: CardKind;
  className?: string;
  shared?: boolean;
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
      {shared ? (
        <svg aria-hidden className="size-4" fill="currentColor">
          <use href={`#${symbolId(kind)}`} />
        </svg>
      ) : (
        <Icon aria-hidden className="size-4" />
      )}
    </span>
  );
}
