import Link from "next/link";
import { Conversion, titleOf } from "@/lib/matrix";
import { IconArrow } from "./Icons";

export function ConversionGrid({ items, limit }: { items: Conversion[]; limit?: number }) {
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {shown.map((c) => (
        <li key={c.slug}>
          <Link
            href={`/convert/${c.slug}/`}
            className="focus-ring group flex items-center justify-between gap-2 rounded-xl border border-hair surface-raised px-4 py-3.5 text-sm font-medium shadow-[var(--shadow-lift)] transition-all hover:-translate-y-0.5 hover:border-[var(--color-brand-400)]"
          >
            <span className="truncate">{titleOf(c)}</span>
            <IconArrow className="h-4 w-4 shrink-0 text-[var(--color-ink-300)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-brand-500)]" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
