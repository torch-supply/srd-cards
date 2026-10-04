"use client";

import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TypeIcon } from "@/components/cards/type-icon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SrdType } from "@/lib/srd/schema";

export function ReferenceNav({
  links,
}: {
  links: { href: string; label: string; type: SrdType }[];
}) {
  const pathname = usePathname();
  const active = links.find(
    (l) => pathname === l.href || pathname.startsWith(`${l.href}/`),
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="text-muted-foreground data-[active=true]:text-foreground"
          data-active={!!active}
        >
          {active ? active.label : "Browse SRD"}
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {links.map((l) => (
          <DropdownMenuItem key={l.href} asChild>
            <Link href={l.href}>
              <TypeIcon kind={l.type} />
              {l.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
