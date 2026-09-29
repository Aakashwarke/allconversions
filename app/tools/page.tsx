import type { Metadata } from "next";
import { ConversionGrid } from "@/components/ConversionGrid";
import { CATEGORY_LABEL, Category, FORMAT_BY_ID } from "@/lib/formats";
import { CONVERSIONS } from "@/lib/matrix";

export const metadata: Metadata = {
  title: "All conversion tools",
  description: `Browse all ${CONVERSIONS.length} file conversions. Documents, images, spreadsheets, ebooks, audio and video — all converted in your browser with no upload.`,
};

export default function ToolsPage() {
  // Group by the source format's category so the page reads as a directory
  // rather than an undifferentiated wall of 281 links.
  const groups = new Map<Category, typeof CONVERSIONS>();
  for (const c of CONVERSIONS) {
    const category = FORMAT_BY_ID.get(c.from)!.category;
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category)!.push(c);
  }

  const order: Category[] = ["document", "image", "spreadsheet", "data", "ebook", "audio", "video", "archive"];

  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <h1 className="text-4xl font-bold tracking-tight">All conversion tools</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        {CONVERSIONS.length} conversions across {order.length} categories. Every one runs
        in your browser — no upload, no account, no watermark.
      </p>

      <nav className="mt-8 flex flex-wrap gap-2">
        {order.filter((c) => groups.has(c)).map((category) => (
          <a key={category} href={`#${category}`}
             className="focus-ring rounded-lg border border-hair surface-raised px-3.5 py-2 text-sm font-medium transition-colors hover:border-[var(--color-brand-400)]">
            {CATEGORY_LABEL[category]}
            <span className="ml-1.5 text-muted">{groups.get(category)!.length}</span>
          </a>
        ))}
      </nav>

      {order.filter((c) => groups.has(c)).map((category) => (
        <section key={category} id={category} className="scroll-mt-20 pt-14">
          <h2 className="mb-5 text-2xl font-bold tracking-tight">
            From {CATEGORY_LABEL[category].toLowerCase()}
          </h2>
          <ConversionGrid items={groups.get(category)!} />
        </section>
      ))}
    </div>
  );
}
