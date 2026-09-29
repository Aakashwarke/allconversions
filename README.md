# AllConversions

A file converter that runs **entirely in the browser**. 281 conversions across
documents, images, spreadsheets, data formats, ebooks, audio and video — with no
upload, no account, no watermark and no server to pay for.

```
npm install
npm run dev      # http://localhost:3000
npm run build    # static export to out/
npm test         # 36 end-to-end checks in a real browser
```

---

## Why it's built this way

Every competitor in this space uploads your file to their server. That gives
them a per-conversion cost, which is why they all have file-size caps, daily
limits and paywalls — and it gives them a liability, because they are holding
your documents.

Doing the work client-side with WebAssembly removes both. The user's own CPU
does the conversion, so:

- **there is no upload wait** — most files finish before a normal site would
  have finished uploading them;
- **hosting is a static CDN**, which costs roughly nothing (see
  [docs/BUSINESS.md](docs/BUSINESS.md) for the full cost model);
- **files genuinely never leave the device**, which is verifiable by anyone with
  a Network tab open.

The one exception is documented honestly: audio and video download a one-time
31MB FFmpeg core. The *media file* still never leaves the browser.

---

## Architecture

```
app/                     Next.js app router, statically exported
  page.tsx               home
  convert/[slug]/        one static page per conversion (374 URLs)
  tools/ pricing/ privacy/
components/
  Converter.tsx          the whole interactive surface
lib/
  formats.ts             38 formats: id, mime, category, copy
  matrix.ts              capability rules -> 281 conversion pairs
  convert.ts             dispatcher; lazy-loads one engine per conversion
  naming.ts              the AllConversions_ download prefix
  engines/
    raster.ts            canvas decode/encode + hand-written BMP and ICO writers
    image.ts             all raster <-> raster
    pdf-write.ts         images -> PDF, text -> PDF (wrapping + pagination)
    pdf-read.ts          PDF -> raster (pdf.js), PDF text-layer extraction
    doc.ts               docx/md/html/rtf/txt via a shared Block model
    sheet.ts             spreadsheets (SheetJS)
    data.ts              json/yaml/xml/ndjson/csv + flattening for tabular targets
    ebook.ts             EPUB and FB2 in, EPUB out
    archive.ts           zip
    av.ts                FFmpeg wasm, loaded on demand
```

### The conversion matrix

`lib/matrix.ts` does not list 281 pairs by hand. It declares what each engine can
read and write, then expands that into pairs — so adding a decoder to
`raster.ts` adds its whole row of conversions automatically, and the site's page
count grows with it.

It also generates **SEO aliases**: nobody searches "pdf to docx", they search
"pdf to word". `/convert/pdf-to-word/` and `/convert/pdf-to-docx/` are both real
static pages, with the canonical tag pointing at one of them.

### Engine loading

`lib/convert.ts` imports every engine dynamically. SheetJS, docx, pdf-lib and
pdf.js are ~1.4MB between them; loading all of it up front would make the page
that converts a 40KB JPEG as heavy as the one that rebuilds a spreadsheet.

Measured first load: **180 KB gzipped**, with none of those libraries in it.

### Three things worth knowing

**`@ffmpeg/ffmpeg` cannot be bundled.** Its worker loads the core with
`await import(coreURL)`, where `coreURL` is a blob URL built at runtime.
Turbopack tries to resolve that expression at build time, fails, and substitutes
a stub that throws *"Cannot find module as expression is too dynamic"* — which
breaks all 107 audio and video conversions with no build error. The library and
`@ffmpeg/util` are therefore copied into `public/vendor/ffmpeg/` as plain ESM
and imported at runtime behind `turbopackIgnore`, so the browser resolves the
blob URL natively.

**The FFmpeg core must be the ESM build.** `@ffmpeg/ffmpeg` spawns a *module*
worker, where `importScripts()` is unavailable, so it falls back to
`(await import(coreURL)).default`. The UMD build has no default export and fails
at runtime with "failed to import ffmpeg-core.js".

**Single-threaded FFmpeg is a deliberate choice.** The multi-threaded core needs
`SharedArrayBuffer`, which needs COOP/COEP cross-origin isolation, which breaks
every third-party ad and analytics script on the page. Slower encoding is worth
more than a broken business model.

---

## Downloaded file naming

Every output is named `AllConversions_<original>.<ext>`:

```
report.pdf  ->  AllConversions_report.docx
```

`lib/naming.ts` also strips unsafe characters, caps the length below the
255-byte filesystem limit, and refuses to stack the prefix when you convert an
already-converted file. It is a filename, not a watermark — file contents are
untouched.

---

## Testing

`npm test` builds the site, serves the static export, and drives it in headless
Chromium: real files in, real download out, asserting the **suggested filename**,
the magic bytes and the decoded content of every result — plus four failure
paths, which assert the error message and whether Retry is offered.

This is not optional thoroughness. Every engine here depends on browser APIs —
canvas, `DOMParser`, WebAssembly — that cannot be exercised from Node, and the
suite caught three bugs that would otherwise have shipped: both FFmpeg loading
failures above — the second of which only appears in the *bundled* app, so a
test that imported the engine directly would have missed it — and a pdf.js
version that relied on `Map.getOrInsertComputed`, a proposal not yet available
in Safari or older Chrome.

Media fixtures are generated on demand by FFmpeg's own `lavfi` inputs rather
than committed as binaries. `SKIP_MEDIA=1 npm test` skips them for a fast run.

---

## Deploying

The build is a plain static export — any CDN will serve it.

```bash
npm run build                    # -> out/
npx wrangler pages deploy out    # Cloudflare Pages
```

Set `NEXT_PUBLIC_SITE_URL` so canonical tags and the sitemap point at the real
domain.

**Use Cloudflare, not S3 + CloudFront.** At 10 TB of monthly egress the same
files cost ~$850/month on AWS and $0 on Cloudflare R2/Pages. With a 31MB wasm
core in the asset mix, that one decision dominates the entire infrastructure
bill.

Recommended headers for `out/`:

```
/vendor/*        Cache-Control: public, max-age=31536000, immutable
/_next/static/*  Cache-Control: public, max-age=31536000, immutable
```

---

## What's not done

- **OCR for scanned PDFs.** Currently detected and reported clearly rather than
  silently returning an empty document. Tesseract wasm is the intended fix and
  the natural Pro feature.
- **High-fidelity DOCX → PDF.** Text and structure survive; complex layout does
  not. A server-side LibreOffice path is the planned Pro upsell.
- **HEIC and TIFF decoding**, which browsers don't do natively.
- **Payments.** The pricing page describes the intended tiers; nothing is wired
  to a processor.
