import { Engine, conversionFor } from "./matrix";
import { ConversionError, ConvertRequest, ConvertResult } from "./engines/types";

export * from "./engines/types";

/**
 * Hard ceiling per file. The real constraint is browser memory: a conversion
 * holds the source, the decoded intermediate and the output simultaneously, so
 * a 2GB input can exhaust a tab well before it finishes.
 */
export const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;

/**
 * Audio and video get a tighter cap.
 *
 * ffmpeg.wasm is a 32-bit build and keeps the input *and* the output in its
 * virtual filesystem at once, on top of the codec's own working memory. Well
 * below 2GB it dies inside wasm with an allocation failure that surfaces as an
 * unhelpful crash, so refuse it up front with a reason the user can act on.
 */
export const MAX_MEDIA_BYTES = 900 * 1024 * 1024;

/** The size ceiling that applies to a given conversion, in bytes. */
export function limitFor(from: string, to: string): number {
  return conversionFor(from, to)?.engine === "av" ? MAX_MEDIA_BYTES : MAX_FILE_BYTES;
}

type EngineFn = (req: ConvertRequest) => Promise<ConvertResult>;

/**
 * Engines are code-split and fetched on first use.
 *
 * This matters more than it looks: SheetJS, docx, pdf-lib and pdf.js are ~1.4MB
 * of JavaScript between them. Loading all of it up front would make the page
 * that converts a 40KB JPEG as heavy as the one that rebuilds a spreadsheet.
 * Keeping the initial bundle to the UI alone is what makes the site feel
 * instant, and each chunk is cached after its first use.
 */
const ENGINES: Record<Engine, () => Promise<EngineFn>> = {
  image:      () => import("./engines/image").then((m) => m.convertImage),
  imageToPdf: () => import("./engines/pdf-write").then((m) => m.imageToPdf),
  pdfToImage: () => import("./engines/pdf-read").then((m) => m.pdfToImage),
  pdfToText:  () => import("./engines/doc").then((m) => m.convertDocument),
  doc:        () => import("./engines/doc").then((m) => m.convertDocument),
  sheet:      () => import("./engines/sheet").then((m) => m.convertSheet),
  data:       () => import("./engines/data").then((m) => m.convertData),
  ebook:      () => import("./engines/ebook").then((m) => m.convertEbook),
  archive:    () => import("./engines/archive").then((m) => m.convertArchive),
  av:         () => import("./engines/av").then((m) => m.convertMedia),
};

export async function convertFile(req: ConvertRequest): Promise<ConvertResult> {
  const conversion = conversionFor(req.from, req.to);
  if (!conversion) {
    throw new ConversionError(
      `We can't convert ${req.from.toUpperCase()} to ${req.to.toUpperCase()} yet.`,
    );
  }
  if (req.file.size === 0) {
    throw new ConversionError("That file is empty.");
  }
  if (conversion.engine === "av" && req.file.size > MAX_MEDIA_BYTES) {
    throw new ConversionError(
      "Audio and video are capped at 900MB.",
      "The in-browser FFmpeg build is 32-bit and runs out of memory above this. Trimming the clip first is the usual fix.",
    );
  }
  if (req.file.size > MAX_FILE_BYTES) {
    throw new ConversionError(
      "That file is larger than 2GB.",
      "Browser tabs run out of memory above this size.",
    );
  }

  req.onProgress?.(0.01, "Loading converter");
  let engine: EngineFn;
  try {
    engine = await ENGINES[conversion.engine]();
  } catch {
    throw new ConversionError(
      "The converter failed to load.",
      "Check your connection and try again.",
    );
  }

  return engine(req);
}

/** Trigger a browser download for a finished conversion. */
export function downloadResult(result: ConvertResult): void {
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = result.filename;   // already carries the AllConversions_ prefix
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download in Firefox.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
  // One decimal only where it adds information: 1.4 MB, but 2 GB and 900 MB.
  const decimals = value >= 10 || i === 0 || Number.isInteger(value) ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[i]}`;
}

/** Zip several finished conversions into one download. */
export async function bundleAndDownload(results: ConvertResult[], zipName: string): Promise<void> {
  const { bundleResults } = await import("./engines/archive");
  const parts = await Promise.all(
    results.map(async (r) => ({
      filename: r.filename,
      bytes: new Uint8Array(await r.blob.arrayBuffer()),
    })),
  );
  downloadResult({ blob: bundleResults(parts), filename: zipName });
}
