import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { brandedFilename } from "../naming";
import { decodeImage, flatten } from "./raster";
import { ConvertRequest, ConvertResult, ConversionError, DEFAULTS } from "./types";

const PAGE: Record<string, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

/** Images -> PDF. Every raster format we can decode can become a page. */
export async function imageToPdf(req: ConvertRequest): Promise<ConvertResult> {
  const { file, from, options, onProgress } = req;
  onProgress?.(0.15, "Decoding image");

  const raster = flatten(await decodeImage(file, from), options.background ?? "#ffffff");

  // pdf-lib embeds only JPEG and PNG, so everything is normalised to PNG first
  // (lossless, and the source has already been decoded to pixels anyway).
  const png = await new Promise<Blob | null>((r) => raster.canvas.toBlob(r, "image/png"));
  if (!png) throw new ConversionError("Could not rasterise the image.");

  onProgress?.(0.55, "Building PDF");
  const doc = await PDFDocument.create();
  const embedded = await doc.embedPng(await png.arrayBuffer());

  const size = options.pageSize ?? DEFAULTS.pageSize;
  if (size === "fit") {
    // Page matches the image exactly: no letterboxing, no cropping.
    const page = doc.addPage([embedded.width, embedded.height]);
    page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
  } else {
    const [pw, ph] = PAGE[size] ?? PAGE.a4;
    const page = doc.addPage([pw, ph]);
    const margin = 36;
    const scale = Math.min((pw - margin * 2) / embedded.width, (ph - margin * 2) / embedded.height);
    const w = embedded.width * scale;
    const h = embedded.height * scale;
    page.drawImage(embedded, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
  }

  doc.setProducer("AllConversions");
  doc.setCreator("AllConversions");

  onProgress?.(0.9, "Saving");
  const bytes = await doc.save();
  return {
    blob: new Blob([bytes as BlobPart], { type: "application/pdf" }),
    filename: brandedFilename(file.name, "pdf"),
  };
}

/** Lay plain text onto PDF pages with wrapping and pagination. */
export async function textToPdfBytes(
  text: string,
  opts: { pageSize?: string; fontSize?: number } = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const [pw, ph] = PAGE[opts.pageSize ?? "a4"] ?? PAGE.a4;
  const fontSize = opts.fontSize ?? 11;
  const lineHeight = fontSize * 1.45;
  const margin = 56;
  const usable = pw - margin * 2;

  let page = doc.addPage([pw, ph]);
  let y = ph - margin;

  const flush = () => {
    page = doc.addPage([pw, ph]);
    y = ph - margin;
  };

  for (const paragraph of text.split(/\r?\n/)) {
    if (!paragraph.trim()) {
      y -= lineHeight * 0.6;
      if (y < margin) flush();
      continue;
    }
    for (const line of wrap(paragraph, font, fontSize, usable)) {
      if (y < margin) flush();
      page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0.1, 0.1, 0.12) });
      y -= lineHeight;
    }
  }

  doc.setProducer("AllConversions");
  doc.setCreator("AllConversions");
  return doc.save();
}

type Measurable = { widthOfTextAtSize(t: string, s: number): number };

function wrap(text: string, font: Measurable, size: number, maxWidth: number): string[] {
  // WinAnsi is all the standard PDF fonts can encode; swap anything else for
  // "?" rather than throwing partway through a long document.
  const safe = text.replace(/[^\x20-\x7E -ÿ]/g, "?");
  const words = safe.split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    // A single word longer than the line has to be broken by character.
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      let chunk = "";
      for (const ch of word) {
        if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
          lines.push(chunk);
          chunk = ch;
        } else chunk += ch;
      }
      line = chunk;
    } else {
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}
