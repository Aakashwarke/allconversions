import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { IconCheck } from "@/components/Icons";

export const metadata: Metadata = {
  title: "Pricing",
  description: `${BRAND.name} is free for everyone, with an optional Pro plan that removes ads and adds batch mode, presets and API access.`,
};

const TIERS = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    summary: "Everything most people ever need.",
    features: [
      "All 281 conversions",
      "Unlimited files, no daily cap",
      "Files up to 2GB",
      "No watermarks, ever",
      "No account required",
      "Supported by a single unobtrusive ad",
    ],
    cta: { label: "Start converting", href: "/" },
    highlight: false,
  },
  {
    name: "Pro",
    price: "$3",
    cadence: "per month",
    summary: "For people who convert files every day.",
    features: [
      "Everything in Free",
      "No ads anywhere on the site",
      "Batch queue with saved presets",
      "Installable desktop app (offline)",
      "OCR for scanned PDFs",
      "Priority support",
    ],
    cta: { label: "Go Pro", href: "/" },
    highlight: true,
  },
  {
    name: "API",
    price: "$19",
    cadence: "per month",
    summary: "Conversion inside your own product.",
    features: [
      "10,000 conversions per month",
      "Server-side REST endpoint",
      "Same engines, headless",
      "Webhooks and signed URLs",
      "99.9% uptime target",
      "Usage-based overage",
    ],
    cta: { label: "Read the docs", href: "/" },
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Free because it&apos;s <span className="gradient-text">cheap to run</span>
        </h1>
        <p className="mt-4 text-lg text-muted">
          Your device does the work, so we have no conversion servers to pay for.
          That&apos;s why the free tier has no file caps and no watermarks — and why
          Pro costs about the same as a coffee.
        </p>
      </div>

      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className={`relative rounded-[var(--radius-card)] border p-7 ${
              tier.highlight
                ? "border-[var(--color-brand-500)] surface-raised shadow-[var(--shadow-float)]"
                : "border-hair surface-raised shadow-[var(--shadow-lift)]"
            }`}
          >
            {tier.highlight && (
              <span className="absolute -top-3 left-7 rounded-full bg-[var(--color-brand-500)] px-3 py-1 text-xs font-semibold text-white">
                Most popular
              </span>
            )}
            <h2 className="font-semibold tracking-tight">{tier.name}</h2>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span className="text-4xl font-bold tracking-tight">{tier.price}</span>
              <span className="text-sm text-muted">{tier.cadence}</span>
            </p>
            <p className="mt-2 text-sm text-muted">{tier.summary}</p>

            <ul className="mt-6 space-y-2.5">
              {tier.features.map((f) => (
                <li key={f} className="flex gap-2.5 text-sm">
                  <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent-500)]" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Link
              href={tier.cta.href}
              className={`focus-ring mt-7 block rounded-xl px-5 py-3 text-center text-sm font-semibold transition-all ${
                tier.highlight
                  ? "bg-[var(--color-brand-500)] text-white hover:bg-[var(--color-brand-600)]"
                  : "border border-hair hover:surface-sunken"
              }`}
            >
              {tier.cta.label}
            </Link>
          </div>
        ))}
      </div>

      <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-muted">
        Pro and API are the planned paid tiers. The free converter above is fully
        functional today and always will be.
      </p>
    </div>
  );
}
