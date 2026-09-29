import { FORMAT_BY_ID, Format, resolveFormat } from "./formats";

/**
 * Which code path actually performs a conversion. Every engine except "av"
 * runs synchronously in the page's worker pool with no network round-trip;
 * "av" lazy-loads a ~25MB WebAssembly build of FFmpeg on first use, which is
 * why audio/video conversions are marked as heavier below.
 */
export type Engine =
  | "image" | "imageToPdf" | "pdfToImage" | "pdfToText"
  | "doc" | "sheet" | "data" | "ebook" | "archive" | "av";

export interface Conversion {
  from: string;
  to: string;
  slug: string;              // canonical URL segment, e.g. "pdf-to-docx"
  aliases: string[];         // extra slugs that redirect/resolve here ("pdf-to-word")
  engine: Engine;
  /** true when the engine must download a large wasm payload first. */
  heavy: boolean;
  /** Search-volume weighting used to order the homepage grid. */
  popularity: number;
}

interface Route {
  engine: Engine;
  from: string[];
  to: string[];
  heavy?: boolean;
}

// Decodable by <img>/ImageBitmap in every evergreen browser.
const IMG_IN  = ["jpg", "png", "webp", "avif", "gif", "bmp", "ico", "svg"];
// Encodable by canvas.toBlob (+ our own BMP/ICO writers).
const IMG_OUT = ["jpg", "png", "webp", "avif", "bmp", "ico"];

const TEXTISH = ["txt", "md", "html", "rtf"];
const SHEETS  = ["xlsx", "xls", "ods", "csv", "tsv"];
const DATA    = ["json", "yaml", "xml", "ndjson", "csv", "tsv"];
const AUDIO   = ["mp3", "wav", "ogg", "opus", "m4a", "aac", "flac"];
const VIDEO   = ["mp4", "webm", "mkv", "mov", "avi"];

const ROUTES: Route[] = [
  // Raster image transcoding, both directions across every pair.
  { engine: "image", from: IMG_IN, to: IMG_OUT },

  // Anything we can draw, we can place on a PDF page.
  { engine: "imageToPdf", from: IMG_IN, to: ["pdf"] },

  // PDF pages rendered back out to raster (multi-page results arrive zipped).
  { engine: "pdfToImage", from: ["pdf"], to: ["jpg", "png", "webp"] },

  // Text-layer extraction, then re-flowed into editable containers.
  { engine: "pdfToText", from: ["pdf"], to: ["txt", "md", "html", "docx", "rtf"] },

  // Word processing formats and lightweight markup, all pairs.
  { engine: "doc", from: ["docx", ...TEXTISH], to: ["docx", "pdf", ...TEXTISH] },

  // Spreadsheets to each other, to data formats, and to print-ready output.
  { engine: "sheet", from: SHEETS, to: [...SHEETS, "json", "html", "pdf"] },

  // Structured data interchange.
  { engine: "data", from: DATA, to: DATA },

  // eBooks out to readable formats, and back in from markup.
  { engine: "ebook", from: ["epub", "fb2"], to: ["pdf", "txt", "html", "md", "docx"] },
  { engine: "ebook", from: ["html", "md", "txt", "docx"], to: ["epub"] },

  // Compression.
  { engine: "archive", from: [...IMG_IN, "pdf", "docx", "xlsx", "txt", "md", "html", "json", "csv"], to: ["zip"] },

  // FFmpeg-backed media. Loaded on demand.
  { engine: "av", from: AUDIO, to: AUDIO, heavy: true },
  { engine: "av", from: VIDEO, to: VIDEO, heavy: true },
  { engine: "av", from: VIDEO, to: [...AUDIO, "gif"], heavy: true },
  { engine: "av", from: ["gif"], to: [...VIDEO], heavy: true },
];

/**
 * SEO aliases. Nobody searches "pdf to docx" — they search "pdf to word".
 * These extra slugs are generated as real static pages so we rank for the
 * phrasing users actually type.
 */
const NAME_ALIASES: Record<string, string[]> = {
  docx: ["word", "doc"],
  xlsx: ["excel"],
  jpg: ["jpeg"],
  md: ["markdown"],
  txt: ["text"],
};

/** Hand-tuned weights; roughly tracks global monthly search volume. */
const POPULARITY: Record<string, number> = {
  "pdf-to-docx": 100, "jpg-to-pdf": 98, "docx-to-pdf": 96, "pdf-to-jpg": 94,
  "png-to-jpg": 90, "heic-to-jpg": 88, "pdf-to-png": 86, "webp-to-png": 84,
  "webp-to-jpg": 82, "png-to-pdf": 80, "epub-to-pdf": 76, "xlsx-to-csv": 74,
  "csv-to-xlsx": 72, "mp4-to-mp3": 70, "png-to-webp": 66, "jpg-to-png": 64,
  "pdf-to-txt": 60, "html-to-pdf": 58, "md-to-pdf": 56, "json-to-csv": 54,
  "csv-to-json": 52, "mov-to-mp4": 50, "wav-to-mp3": 48, "svg-to-png": 46,
  "xlsx-to-pdf": 44, "txt-to-pdf": 42, "json-to-yaml": 38, "mkv-to-mp4": 36,
  "webm-to-mp4": 34, "flac-to-mp3": 32, "gif-to-mp4": 28, "epub-to-docx": 26,
};

function buildAliases(from: string, to: string): string[] {
  const out = new Set<string>();
  const fs = [from, ...(NAME_ALIASES[from] ?? [])];
  const ts = [to, ...(NAME_ALIASES[to] ?? [])];
  for (const a of fs) for (const b of ts) {
    const slug = `${a}-to-${b}`;
    if (slug !== `${from}-to-${to}`) out.add(slug);
  }
  return [...out];
}

function build(): Conversion[] {
  const seen = new Map<string, Conversion>();
  for (const route of ROUTES) {
    for (const from of route.from) {
      for (const to of route.to) {
        if (from === to) continue;
        const slug = `${from}-to-${to}`;
        // First route wins: ROUTES is ordered cheapest/highest-fidelity first.
        if (seen.has(slug)) continue;
        if (!FORMAT_BY_ID.has(from) || !FORMAT_BY_ID.has(to)) continue;
        seen.set(slug, {
          from, to, slug,
          aliases: buildAliases(from, to),
          engine: route.engine,
          heavy: route.heavy ?? false,
          popularity: POPULARITY[slug] ?? 0,
        });
      }
    }
  }
  return [...seen.values()].sort(
    (a, b) => b.popularity - a.popularity || a.slug.localeCompare(b.slug),
  );
}

export const CONVERSIONS: Conversion[] = build();

const BY_SLUG = new Map<string, Conversion>();
for (const c of CONVERSIONS) {
  BY_SLUG.set(c.slug, c);
  for (const a of c.aliases) if (!BY_SLUG.has(a)) BY_SLUG.set(a, c);
}

export const ALL_SLUGS: string[] = [...BY_SLUG.keys()];

export function findConversion(slug: string): Conversion | undefined {
  return BY_SLUG.get(slug.toLowerCase());
}

export function conversionFor(from: string, to: string): Conversion | undefined {
  const a = resolveFormat(from), b = resolveFormat(to);
  return a && b ? BY_SLUG.get(`${a.id}-to-${b.id}`) : undefined;
}

/** Every target format reachable from a given source. */
export function targetsFor(from: string): Format[] {
  const f = resolveFormat(from);
  if (!f) return [];
  const ids = CONVERSIONS.filter((c) => c.from === f.id).map((c) => c.to);
  return [...new Set(ids)].map((id) => FORMAT_BY_ID.get(id)!).filter(Boolean);
}

export const POPULAR = CONVERSIONS.filter((c) => c.popularity > 0);

export function titleOf(c: Conversion): string {
  return `${c.from.toUpperCase()} to ${c.to.toUpperCase()}`;
}
