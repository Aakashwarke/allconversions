import type { MetadataRoute } from "next";
import { CONVERSIONS } from "@/lib/matrix";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const statics = ["", "/tools/", "/pricing/", "/privacy/"].map((path) => ({
    url: `${SITE_URL}${path || "/"}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));

  // Only canonical slugs are listed; aliases exist as pages but point their
  // canonical tag back here, so listing them would split ranking signals.
  const tools = CONVERSIONS.map((c) => ({
    url: `${SITE_URL}/convert/${c.slug}/`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: c.popularity > 0 ? 0.9 : 0.6,
  }));

  return [...statics, ...tools];
}
