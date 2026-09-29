/**
 * Single source of truth for the brand. Changing SITE_NAME here renames the
 * product everywhere, including the prefix stamped onto every downloaded file.
 */
export const BRAND = {
  name: "AllConversions",
  domain: "allconversions.com",
  tagline: "Convert anything. In your browser.",
  /** Prefix + separator applied to every output file, e.g. AllConversions_report.docx */
  filePrefix: "AllConversions",
  fileSeparator: "_",
} as const;
