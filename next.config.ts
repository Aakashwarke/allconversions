import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static export -> deployable to any CDN (Cloudflare Pages, S3, Netlify)
  // for ~$0/month. This is the core of the cost model: no servers to run.
  output: "export",
  reactStrictMode: true,
  images: { unoptimized: true },
  trailingSlash: true,
  // pdf.js ships an optional `canvas` import for its Node build; the browser
  // build never reaches it, so stub it out rather than pulling in a native dep.
  turbopack: {
    resolveAlias: { canvas: "./lib/stubs/empty.ts" },
  },
};

export default nextConfig;
