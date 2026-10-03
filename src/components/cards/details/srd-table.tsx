import type { SrdTable } from "@/lib/srd/schema";
import { cn } from "@/lib/utils";

interface HeaderGroup {
  label: string;
  start: number;
  span: number;
}

/** A structured SRD table (class features tables), horizontally scrollable when wide. */
export function SrdTableView({
  table,
  className,
}: {
  table: SrdTable & { headerGroups?: HeaderGroup[] };
  className?: string;
}) {
  const groups = table.headerGroups ?? [];
  const groupRow: { label: string; span: number }[] = [];
  for (let col = 0; col < table.header.length; ) {
    const g = groups.find((x) => x.start === col);
    if (g) {
      groupRow.push({ label: g.label, span: g.span });
      col += g.span;
    } else {
      groupRow.push({ label: "", span: 1 });
      col++;
    }
  }
  return (
    <div className={cn("overflow-x-auto rounded-md border", className)}>
      <table className="w-full border-collapse text-xs tabular-nums">
        {table.title && <caption className="px-2 py-1.5 text-left font-serif text-sm font-semibold">{table.title}</caption>}
        <thead className="bg-muted/60">
          {groups.length > 0 && (
            <tr>
              {groupRow.map((g, i) => (
                <th key={i} colSpan={g.span} className="px-2 pt-1 text-center font-semibold">
                  {g.label}
                </th>
              ))}
            </tr>
          )}
          <tr>
            {table.header.map((h, i) => (
              <th key={i} className="whitespace-nowrap border-b px-2 py-1 text-left align-bottom font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r} className="even:bg-muted/30">
              {row.map((cell, c) => (
                <td key={c} className={cn("border-b border-border/50 px-2 py-1 align-top", cell.length < 24 && "whitespace-nowrap")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
