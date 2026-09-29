import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Converter } from "@/components/Converter";
import { ConversionGrid } from "@/components/ConversionGrid";
import { BRAND } from "@/lib/brand";
import { FORMAT_BY_ID } from "@/lib/formats";
import { ALL_SLUGS, CONVERSIONS, findConversion, titleOf } from "@/lib/matrix";
import { SITE_URL } from "@/lib/site";

// Every conversion pair — and every SEO alias of it — becomes its own static
// HTML file at build time. This is the whole organic-traffic strategy: people
// search "pdf to word", not "file converter".
export function generateStaticParams() {
  return ALL_SLUGS.map((slug) => ({ slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const conversion = findConversion(slug);
  if (!conversion) return {};

  const from = FORMAT_BY_ID.get(conversion.from)!;
  const to = FORMAT_BY_ID.get(conversion.to)!;
  const title = `${titleOf(conversion)} — free, private, no upload`;
  const description = `Convert ${from.name} to ${to.name} free in your browser. No upload, no sign-up, no watermark. Files stay on your device and download as ${BRAND.filePrefix}${BRAND.fileSeparator}yourfile.${to.id}.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/convert/${conversion.slug}/` },
    openGraph: { title, description, url: `${SITE_URL}/convert/${conversion.slug}/` },
  };
}

export default async function ConvertPage({ params }: Props) {
  const { slug } = await params;
  const conversion = findConversion(slug);
  if (!conversion) notFound();

  const from = FORMAT_BY_ID.get(conversion.from)!;
  const to = FORMAT_BY_ID.get(conversion.to)!;

  const related = CONVERSIONS.filter(
    (c) => c.slug !== conversion.slug && (c.from === conversion.from || c.to === conversion.to),
  ).slice(0, 8);

  const faq = [
    {
      q: `Is this ${titleOf(conversion)} converter really free?`,
      a: "Yes, and without the usual catch. There is no file limit, no daily cap, no account and no watermark. Conversion happens on your own device, so it costs us nothing to let you run it as often as you like.",
    },
    {
      q: "Are my files uploaded anywhere?",
      a: `No. The ${from.name} is read, converted and written entirely inside this browser tab using WebAssembly. Nothing is transmitted to a server, which you can verify in your browser's network inspector.`,
    },
    {
      q: "What will the converted file be called?",
      a: `Your download is named ${BRAND.filePrefix}${BRAND.fileSeparator}yourfilename.${to.id}. The prefix makes the converted copy easy to spot next to the original.`,
    },
    conversion.heavy
      ? {
          q: "Why does the first conversion take longer?",
          a: "Audio and video need a one-time 32MB download of the FFmpeg engine. Your browser caches it, so every conversion after the first starts instantly.",
        }
      : {
          q: `How large a ${from.name} can I convert?`,
          a: "Up to 2GB per file. The limit is your browser's memory rather than an artificial tier, since there is no server in the loop.",
        },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: `${titleOf(conversion)} Converter`,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Any",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
      {
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="aurora relative overflow-hidden">
        <div className="relative mx-auto max-w-3xl px-4 pt-12 sm:pt-16">
          <nav aria-label="Breadcrumb" className="text-sm text-muted">
            <Link href="/" className="focus-ring rounded hover:text-[var(--text)]">Home</Link>
            <span className="mx-2">/</span>
            <Link href="/tools/" className="focus-ring rounded hover:text-[var(--text)]">Tools</Link>
            <span className="mx-2">/</span>
            <span className="text-[var(--text)]">{titleOf(conversion)}</span>
          </nav>

          <h1 className="mt-5 text-balance text-3xl font-bold tracking-tight sm:text-5xl">
            Convert <span className="gradient-text">{from.id.toUpperCase()} to {to.id.toUpperCase()}</span>
          </h1>
          <p className="mt-4 text-pretty text-lg text-muted">
            Turn {from.name} files into {to.name} without uploading anything.
            Free, unlimited and watermark-free.
          </p>
        </div>

        <div className="relative mx-auto max-w-3xl px-4 pb-14 pt-8">
          <Converter lockedFrom={conversion.from} lockedTo={conversion.to} />
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-10">
        <div className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-hair surface-raised p-6">
            <h2 className="font-semibold tracking-tight">About {from.name}</h2>
            <p className="mt-2 text-sm text-muted">{from.blurb}</p>
          </article>
          <article className="rounded-2xl border border-hair surface-raised p-6">
            <h2 className="font-semibold tracking-tight">About {to.name}</h2>
            <p className="mt-2 text-sm text-muted">{to.blurb}</p>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-10">
        <h2 className="text-2xl font-bold tracking-tight">How to convert {from.id.toUpperCase()} to {to.id.toUpperCase()}</h2>
        <ol className="mt-5 space-y-4">
          {[
            `Drop your ${from.name} onto the box above, or click to browse for it.`,
            `Press Convert. The work happens on this device, so there's no upload bar to wait through.`,
            `Save the result. It downloads as ${BRAND.filePrefix}${BRAND.fileSeparator}yourfile.${to.id}.`,
          ].map((step, i) => (
            <li key={i} className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-500)]/10 text-sm font-semibold text-[var(--color-brand-500)]">
                {i + 1}
              </span>
              <p className="pt-0.5 text-muted">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-10">
        <h2 className="text-2xl font-bold tracking-tight">Questions</h2>
        <dl className="mt-5 space-y-3">
          {faq.map((item) => (
            <div key={item.q} className="rounded-2xl border border-hair surface-raised p-5">
              <dt className="font-semibold tracking-tight">{item.q}</dt>
              <dd className="mt-1.5 text-sm text-muted">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {related.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="mb-5 text-2xl font-bold tracking-tight">Related conversions</h2>
          <ConversionGrid items={related} />
        </section>
      )}
    </>
  );
}
