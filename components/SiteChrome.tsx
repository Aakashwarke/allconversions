import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { NAV } from "@/lib/site";
import { Logo } from "./Logo";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-hair backdrop-blur-xl"
            style={{ background: "color-mix(in srgb, var(--surface) 82%, transparent)" }}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="focus-ring flex items-center gap-2.5 rounded-lg">
          <Logo className="h-8 w-8" />
          <span className="text-[17px] font-semibold tracking-tight">{BRAND.name}</span>
        </Link>
        <nav className="flex items-center gap-1">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}
                  className="focus-ring rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-[var(--text)]">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-hair surface-sunken">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <Logo className="h-7 w-7" />
              <span className="font-semibold tracking-tight">{BRAND.name}</span>
            </div>
            <p className="mt-3 text-sm text-muted">
              Files are converted inside your browser. Nothing is uploaded, so nothing
              can leak.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm sm:grid-cols-3">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href}
                    className="focus-ring rounded text-muted transition-colors hover:text-[var(--text)]">
                {item.label}
              </Link>
            ))}
            <Link href="/convert/pdf-to-word/" className="focus-ring rounded text-muted hover:text-[var(--text)]">PDF to Word</Link>
            <Link href="/convert/jpg-to-pdf/" className="focus-ring rounded text-muted hover:text-[var(--text)]">JPG to PDF</Link>
            <Link href="/convert/epub-to-pdf/" className="focus-ring rounded text-muted hover:text-[var(--text)]">EPUB to PDF</Link>
          </div>
        </div>
        <p className="mt-10 text-xs text-muted">
          © {new Date().getFullYear()} {BRAND.name}. Converted files are named with the{" "}
          <code className="rounded surface px-1 py-0.5">{BRAND.filePrefix}{BRAND.fileSeparator}</code> prefix.
        </p>
      </div>
    </footer>
  );
}
