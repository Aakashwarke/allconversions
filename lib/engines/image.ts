import { brandedFilename } from "../naming";
import { decodeImage, encodeImage, flatten, resize, HAS_ALPHA } from "./raster";
import { ConvertRequest, ConvertResult, DEFAULTS } from "./types";

export async function convertImage(req: ConvertRequest): Promise<ConvertResult> {
  const { file, from, to, options, onProgress } = req;
  const quality = options.quality ?? DEFAULTS.quality;

  onProgress?.(0.1, "Decoding");
  let raster = await decodeImage(file, from);

  if (options.maxDimension) {
    onProgress?.(0.4, "Resizing");
    raster = resize(raster, options.maxDimension);
  }

  // JPEG and BMP have no alpha; without this, transparency renders black.
  if (!HAS_ALPHA.has(to)) {
    raster = flatten(raster, options.background ?? DEFAULTS.background);
  }

  onProgress?.(0.7, "Encoding");
  const blob = await encodeImage(raster, to, quality);

  onProgress?.(1, "Done");
  return { blob, filename: brandedFilename(file.name, to) };
}
