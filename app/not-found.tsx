import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-28 text-center">
      <p className="text-sm font-semibold text-[var(--color-brand-500)]">404</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">We don&apos;t have that converter</h1>
      <p className="mt-3 text-muted">
        It may not exist yet, or the link may be out of date.
      </p>
      <Link href="/tools/"
            className="focus-ring mt-7 inline-block rounded-xl bg-[var(--color-brand-500)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-600)]">
        Browse all tools
      </Link>
    </div>
  );
}
