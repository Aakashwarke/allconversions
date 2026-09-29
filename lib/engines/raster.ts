import { ConversionError } from "./types";

/**
 * Decoding and encoding primitives shared by every engine that touches pixels.
 * Everything here runs on the browser's own image codecs, which is what makes
 * image conversion effectively free for us and instant for the user.
 */

export interface Raster {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

/** Formats canvas.toBlob can emit natively. */
const NATIVE_ENCODE: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

export async function decodeImage(file: Blob, ext: string): Promise<Raster> {
  // SVG has no intrinsic bitmap; it must go through an <img> so the browser
  // rasterises it at the size we ask for.
  if (ext === "svg") return decodeSvg(file);

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // ICO and a few odd JPEGs decode through <img> but not createImageBitmap.
    return decodeViaImgElement(file);
  }

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ConversionError("Your browser blocked canvas rendering.");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return { canvas, width: canvas.width, height: canvas.height };
}

function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ConversionError("That image could not be decoded."));
    img.src = url;
  });
}

async function decodeViaImgElement(file: Blob): Promise<Raster> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImg(url);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d")!.drawImage(img, 0, 0);
    return { canvas, width: canvas.width, height: canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function decodeSvg(file: Blob): Promise<Raster> {
  const source = await file.text();
  // Render vectors at 2x their declared size so raster output stays crisp.
  const scale = 2;
  const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }));
  try {
    const img = await loadImg(url);
    const w = Math.max(1, Math.round((img.naturalWidth || 512) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || 512) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    return { canvas, width: w, height: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Scale down so the longest edge fits `max`. Never upscales. */
export function resize(src: Raster, max: number): Raster {
  if (!max || (src.width <= max && src.height <= max)) return src;
  const ratio = Math.min(max / src.width, max / src.height);
  const w = Math.max(1, Math.round(src.width * ratio));
  const h = Math.max(1, Math.round(src.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src.canvas, 0, 0, w, h);
  return { canvas, width: w, height: h };
}

/** Composite onto an opaque background, for targets with no alpha channel. */
export function flatten(src: Raster, background: string): Raster {
  const canvas = document.createElement("canvas");
  canvas.width = src.width;
  canvas.height = src.height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, src.width, src.height);
  ctx.drawImage(src.canvas, 0, 0);
  return { canvas, width: src.width, height: src.height };
}

export const HAS_ALPHA = new Set(["png", "webp", "avif", "gif", "ico"]);

export async function encodeImage(src: Raster, ext: string, quality: number): Promise<Blob> {
  if (ext === "bmp") return encodeBmp(src);
  if (ext === "ico") return encodeIco(src);

  const mime = NATIVE_ENCODE[ext];
  if (!mime) throw new ConversionError(`Cannot write ${ext.toUpperCase()} files.`);

  const blob = await new Promise<Blob | null>((resolve) =>
    src.canvas.toBlob(resolve, mime, quality),
  );
  if (!blob) throw new ConversionError(`Your browser cannot write ${ext.toUpperCase()}.`);

  // Safari silently falls back to PNG for AVIF/WebP rather than failing.
  if (blob.type !== mime) {
    throw new ConversionError(
      `Your browser cannot write ${ext.toUpperCase()}.`,
      "Try Chrome or Edge, or pick PNG instead.",
    );
  }
  return blob;
}

/** 32-bit BI_BITFIELDS BMP writer — canvas has no native BMP encoder. */
function encodeBmp(src: Raster): Blob {
  const { width, height } = src;
  const data = src.canvas.getContext("2d")!.getImageData(0, 0, width, height).data;
  const headerSize = 14 + 40;
  const pixelBytes = width * height * 4;
  const buffer = new ArrayBuffer(headerSize + pixelBytes);
  const view = new DataView(buffer);

  view.setUint16(0, 0x4d42, true);              // "BM"
  view.setUint32(2, buffer.byteLength, true);
  view.setUint32(10, headerSize, true);
  view.setUint32(14, 40, true);                 // DIB header size
  view.setInt32(18, width, true);
  view.setInt32(22, -height, true);             // negative = top-down rows
  view.setUint16(26, 1, true);                  // planes
  view.setUint16(28, 32, true);                 // bits per pixel
  view.setUint32(34, pixelBytes, true);
  view.setInt32(38, 2835, true);                // 72 DPI
  view.setInt32(42, 2835, true);

  const out = new Uint8Array(buffer, headerSize);
  for (let i = 0, o = 0; i < data.length; i += 4, o += 4) {
    out[o] = data[i + 2];      // B
    out[o + 1] = data[i + 1];  // G
    out[o + 2] = data[i];      // R
    out[o + 3] = data[i + 3];  // A
  }
  return new Blob([buffer], { type: "image/bmp" });
}

/** ICO containing a single PNG frame (valid for Windows Vista and newer). */
async function encodeIco(src: Raster): Promise<Blob> {
  // Icons are square and capped at 256px, which is the format's hard limit.
  const size = Math.min(256, Math.max(src.width, src.height));
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  canvas.getContext("2d")!.drawImage(src.canvas, 0, 0, size, size);

  const png = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!png) throw new ConversionError("Could not build the icon.");
  const pngBytes = new Uint8Array(await png.arrayBuffer());

  const header = new ArrayBuffer(22);
  const view = new DataView(header);
  view.setUint16(0, 0, true);                       // reserved
  view.setUint16(2, 1, true);                       // type: icon
  view.setUint16(4, 1, true);                       // one image
  view.setUint8(6, size >= 256 ? 0 : size);         // 0 means 256
  view.setUint8(7, size >= 256 ? 0 : size);
  view.setUint8(8, 0);                              // palette colours
  view.setUint8(9, 0);                              // reserved
  view.setUint16(10, 1, true);                      // colour planes
  view.setUint16(12, 32, true);                     // bits per pixel
  view.setUint32(14, pngBytes.length, true);
  view.setUint32(18, 22, true);                     // offset to pixel data

  return new Blob([header, pngBytes], { type: "image/x-icon" });
}
