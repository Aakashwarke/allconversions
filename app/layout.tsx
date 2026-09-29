import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { BRAND } from "@/lib/brand";
import { SITE_URL } from "@/lib/site";
import { Footer, Header } from "@/components/SiteChrome";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND.name} — Convert PDF, Word, images, audio and video free`,
    template: `%s | ${BRAND.name}`,
  },
  description:
    "Convert between 280+ file formats right in your browser. No uploads, no sign-up, no watermarks. PDF to Word, JPG to PDF, EPUB to PDF and hundreds more.",
  keywords: ["file converter", "pdf to word", "jpg to pdf", "epub to pdf", "online converter", "free file conversion"],
  openGraph: { type: "website", siteName: BRAND.name, url: SITE_URL },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a14" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        <a href="#main" className="focus-ring sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--surface-raised)] focus:px-4 focus:py-2 focus:shadow-lg">
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
