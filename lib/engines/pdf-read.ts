import { zipSync } from "fflate";
import { brandedFilename, brandedZipName, stemOf } from "../naming";
import { ConvertRequest, ConvertResult, ConversionError, DEFAULTS } from "./types";

type PdfjsModule = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfjsModule> | null = null;

/** pdf.js is ~350KB; load it only when a PDF is actually opened. */
async function getPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
      return mod;
    });
  }
  return pdfjsPromise;
}

async function openDocument(file: File) {
  const pdfjs = await getPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  try {
    return await pdfjs.getDocument({ data }).promise;
  } catch (err) {
    const message = String((err as Error)?.message ?? err);
    if (/password/i.test(message)) {
      throw new ConversionError(
        "This PDF is password protected.",
        "Remove the password in your PDF reader, then try again.",
      );
    }
    throw new ConversionError("This file could not be read as a PDF.");
  }
}

const MIME: Record<string, string> = {
  jpg: "image/jpeg", png: "image/png", webp: "image/webp",
};

/**
 * Rasterise every page. A single-page PDF returns the image directly; multiple
 * pages are bundled into one zip so the user gets a single download.
 */
export async function pdfToImage(req: ConvertRequest): Promise<ConvertResult> {
  const { file, to, options, onProgress } = req;
  const dpi = options.dpi ?? DEFAULTS.dpi;
  const quality = options.quality ?? DEFAULTS.quality;

  onProgress?.(0.05, "Opening PDF");
  const doc = await openDocument(file);
  const pages = doc.numPages;
  const mime = MIME[to] ?? "image/png";
  const pad = String(pages).length;

  const rendered: { name: string; bytes: Uint8Array }[] = [];

  for (let n = 1; n <= pages; n++) {
    const page = await doc.getPage(n);
    // pdf.js viewports are in 72dpi points, so scale is simply dpi/72.
    const viewport = page.getViewport({ scale: dpi / 72 });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d")!;
    // PDF pages are transparent; without a white base, JPEG output goes black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    page.cleanup();

    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, mime, quality));
    if (!blob) throw new ConversionError(`Could not encode page ${n}.`);
    rendered.push({
      name: `${stemOf(file.name)}-${String(n).padStart(pad, "0")}.${to}`,
      bytes: new Uint8Array(await blob.arrayBuffer()),
    });

    onProgress?.(0.05 + (n / pages) * 0.9, `Page ${n} of ${pages}`);
  }

  if (rendered.length === 1) {
    return {
      blob: new Blob([rendered[0].bytes as BlobPart], { type: mime }),
      filename: brandedFilename(file.name, to),
    };
  }

  onProgress?.(0.97, "Packaging");
  const zipped = zipSync(Object.fromEntries(rendered.map((p) => [p.name, p.bytes])), { level: 6 });
  return {
    blob: new Blob([zipped as BlobPart], { type: "application/zip" }),
    filename: brandedZipName(file.name, to),
    bundled: rendered.length,
  };
}

export interface ExtractedPage { index: number; lines: string[] }

/**
 * Pull the text layer out of a PDF, reconstructing line breaks from glyph
 * positions. Scanned PDFs have no text layer and are reported as such rather
 * than silently returning an empty document.
 */
export async function extractPdfText(
  file: File,
  onProgress?: (f: number, label?: string) => void,
): Promise<ExtractedPage[]> {
  const doc = await openDocument(file);
  const pages: ExtractedPage[] = [];

  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();

    // Group glyph runs into lines by their vertical position on the page.
    const rows = new Map<number, { x: number; text: string }[]>();
    for (const item of content.items) {
      if (!("str" in item) || !item.str) continue;
      const transform = item.transform as number[];
      // Round to whole points so glyphs on the same baseline group together
      // despite sub-pixel drift.
      const y = Math.round(transform[5]);
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push({ x: transform[4], text: item.str });
    }

    const lines = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])                 // PDF origin is bottom-left
      .map(([, parts]) =>
        parts.sort((a, b) => a.x - b.x).map((p) => p.text).join("").replace(/\s+/g, " ").trim(),
      )
      .filter(Boolean);

    pages.push({ index: n, lines });
    page.cleanup();
    onProgress?.((n / doc.numPages) * 0.7, `Reading page ${n} of ${doc.numPages}`);
  }

  if (!pages.some((p) => p.lines.length)) {
    throw new ConversionError(
      "This PDF has no selectable text.",
      "It looks like a scan. Converting it to Word needs OCR, which we don't run on scanned pages yet — try PDF to JPG instead.",
    );
  }
  return pages;
}

export function pagesToPlainText(pages: ExtractedPage[]): string {
  return pages.map((p) => p.lines.join("\n")).join("\n\n");
}
