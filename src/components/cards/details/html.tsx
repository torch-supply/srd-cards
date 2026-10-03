import { cn } from "@/lib/utils";

/** SRD prose: HTML rendered from markdown and sanitized at build time. */
export function Html({ html, className }: { html: string; className?: string }) {
  return <div className={cn("srd-prose", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/** Prefixes the first paragraph with a bold-italic run-in name ("Amphibious."). */
export function RunIn({ name, html, className }: { name: string; html: string; className?: string }) {
  const runIn = `<strong><em>${escapeHtml(name)}.</em></strong> `;
  const withRunIn = html.startsWith("<p>") ? `<p>${runIn}${html.slice(3)}` : `<p>${runIn}</p>${html}`;
  return <Html html={withRunIn} className={className} />;
}

/** Label/value rows (spell header, core traits, equipment stats). */
export function Facts({ rows, className }: { rows: { label: string; value: React.ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm", className)}>
      {rows.map((r) => (
        <div key={r.label} className="contents">
          <dt className="font-semibold text-foreground">{r.label}</dt>
          <dd className="text-foreground/90">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn("mt-4 border-b pb-1 font-serif text-base font-semibold tracking-wide", className)}>{children}</h3>
  );
}
