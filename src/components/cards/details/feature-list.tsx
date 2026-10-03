"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Html } from "./html";

export interface FeatureItem {
  level: number;
  name: string;
  description: string;
}

/** Class/subclass features as a collapsed accordion (used inside compact cards). */
export function FeatureAccordion({ features }: { features: FeatureItem[] }) {
  return (
    <Accordion type="multiple" className="rounded-md border">
      {features.map((f, i) => (
        <AccordionItem key={`${f.level}-${f.name}-${i}`} value={`${i}`} className="px-2.5">
          <AccordionTrigger className="py-2 text-sm hover:no-underline">
            <span className="flex items-baseline gap-2 text-left">
              <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground tabular-nums">Lvl {f.level}</span>
              <span className="font-medium">{f.name}</span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <Html html={f.description} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
