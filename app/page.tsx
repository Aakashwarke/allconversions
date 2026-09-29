import Link from "next/link";
import { Converter } from "@/components/Converter";
import { ConversionGrid } from "@/components/ConversionGrid";
import { IconBolt, IconShield, IconTag } from "@/components/Icons";
import { BRAND } from "@/lib/brand";
import { CONVERSIONS, POPULAR } from "@/lib/matrix";
import { FORMATS } from "@/lib/formats";

const PROMISES = [
  {
    icon: IconShield,
    title: "Your files never leave this device",
    body: "Conversion runs in your browser with WebAssembly. There is no upload, no server copy and nothing for us to lose.",
  },
  {
    icon: IconBolt,
    title: "No upload wait, no queue",
    body: "Most files finish before a normal site would have finished uploading them. Works offline once the page has loaded.",
  },
  {
    icon: IconTag,
    title: "Clearly named downloads",
    body: `Every file comes back as ${BRAND.filePrefix}${BRAND.fileSeparator}yourfile.ext, so you always know which copy is the converted one.`,
  },
];

export default function HomePage() {
  return (
    <>
      <section className="aurora relative overflow-hidden">
        <div className="relative mx-auto max-w-4xl px-4 pb-4 pt-16 text-center sm:pt-24">
          <p className="inline-flex items-center gap-2 rounded-full border border-hair surface-raised px-3.5 py-1.5 text-xs font-medium text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent-500)]" />
            {CONVERSIONS.length} conversions · {FORMATS.length} formats · nothing uploaded
          </p>

          <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight sm:text-6xl">
            Convert anything.{" "}
            <span className="gradient-text">In your browser.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-muted">
            PDF to Word, JPG to PDF, EPUB to PDF, MP4 to MP3 and {CONVERSIONS.length - 4} more.
            Free, unlimited, no sign-up, no watermarks.
          </p>
        </div>

        <div className="relative mx-auto max-w-3xl px-4 pb-16 pt-6">
          <Converter />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-4 sm:grid-cols-3">
          {PROMISES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-hair surface-raised p-6 shadow-[var(--shadow-lift)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-500)]/10 text-[var(--color-brand-500)]">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold tracking-tight">{title}</h3>
              <p className="mt-1.5 text-sm text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Most-used conversions</h2>
            <p className="mt-1 text-sm text-muted">Each one opens a dedicated tool page.</p>
          </div>
          <Link href="/tools/"
                className="focus-ring shrink-0 rounded-lg text-sm font-medium text-[var(--color-brand-500)] hover:underline">
            All {CONVERSIONS.length} →
          </Link>
        </div>
        <ConversionGrid items={POPULAR} limit={24} />
      </section>
    </>
  );
}
