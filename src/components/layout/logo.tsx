import { cn } from "@/lib/utils";

/**
 * The srd.cards mark: a fanned hand of cards in the class, spell, and monster
 * colors. Same drawing as src/app/icon.svg (favicon and link preview images),
 * except the front card's outline follows the page background.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("shrink-0", className)} aria-hidden>
      <rect
        x="9"
        y="5"
        width="14"
        height="20"
        rx="2.5"
        transform="rotate(-20 16 30)"
        fill="#a78bfa"
      />
      <rect
        x="9"
        y="5"
        width="14"
        height="20"
        rx="2.5"
        transform="rotate(20 16 30)"
        fill="#fbbf24"
      />
      <rect
        x="9"
        y="4"
        width="14"
        height="20"
        rx="2.5"
        fill="#f87171"
        strokeWidth="1.5"
        className="stroke-background"
      />
    </svg>
  );
}
