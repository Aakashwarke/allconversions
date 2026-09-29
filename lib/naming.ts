import { BRAND } from "./brand";

/** Characters that are unsafe in filenames across Windows / macOS / Linux. */
const UNSAFE = /[<>:"/\\|?*\u0000-\u001f]/g;

/** Strip the extension from a filename, keeping dots inside the stem. */
export function stemOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i > 0 ? filename.slice(0, i) : filename;
}

export function extOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i > 0 ? filename.slice(i + 1).toLowerCase() : "";
}

/**
 * Build the download filename for a converted file.
 *
 * Every file we hand back is stamped with the site name, which is both the
 * user-visible promise ("you'll know where this came from") and our cheapest
 * growth channel: a file named AllConversions_invoice.pdf travels with the
 * user into email threads and shared drives.
 *
 *   report.pdf  ->  AllConversions_report.docx
 *
 * Re-converting an already-stamped file does not stack prefixes.
 */
export function brandedFilename(originalName: string, targetExt: string): string {
  const { filePrefix, fileSeparator } = BRAND;

  let stem = stemOf(originalName).replace(UNSAFE, "").trim();
  if (!stem) stem = "converted";

  // Don't produce AllConversions_AllConversions_report.docx on a second pass.
  const existing = `${filePrefix}${fileSeparator}`;
  while (stem.toLowerCase().startsWith(existing.toLowerCase())) {
    stem = stem.slice(existing.length);
  }
  if (!stem) stem = "converted";

  // Keep well under the 255-byte filename limit once the prefix is added.
  const budget = 200 - filePrefix.length - fileSeparator.length - targetExt.length;
  if (stem.length > budget) stem = stem.slice(0, budget);

  return `${filePrefix}${fileSeparator}${stem}.${targetExt}`;
}

/** Name for a multi-file result delivered as a zip (e.g. PDF -> 12 JPGs). */
export function brandedZipName(originalName: string, targetExt: string): string {
  return brandedFilename(`${stemOf(originalName)}-${targetExt}`, "zip");
}
