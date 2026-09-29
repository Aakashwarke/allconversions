import { BRAND } from "./brand";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? `https://${BRAND.domain}`;

export const NAV = [
  { href: "/tools/", label: "All tools" },
  { href: "/pricing/", label: "Pricing" },
  { href: "/privacy/", label: "Privacy" },
];
