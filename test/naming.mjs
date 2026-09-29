/**
 * Unit tests for the download-filename rules.
 *
 * The prefix is a product promise, not cosmetics: it is what tells someone
 * which file in a folder is the converted one. These are the cases that are
 * awkward to reach through the UI — stacked prefixes, names that are nothing
 * but a prefix, filesystem-hostile characters, and names long enough to blow
 * the 255-byte limit once the prefix is added.
 */
import { brandedFilename, brandedZipName, stemOf, extOf } from "../lib/naming.ts";

const cases = [
  ["report.pdf", "docx", "AllConversions_report.docx", "the ordinary case"],
  ["AllConversions_report.pdf", "docx", "AllConversions_report.docx", "does not stack the prefix"],
  ["allconversions_report.pdf", "docx", "AllConversions_report.docx", "strips the prefix case-insensitively"],
  ["AllConversions_AllConversions_x.png", "jpg", "AllConversions_x.jpg", "strips a doubled prefix"],
  ["my.report.v2.pdf", "txt", "AllConversions_my.report.v2.txt", "keeps dots inside the stem"],
  ["noextension", "pdf", "AllConversions_noextension.pdf", "handles a name with no extension"],
  ["bad/name:with*chars.png", "jpg", "AllConversions_badnamewithchars.jpg", "strips filesystem-hostile characters"],
  ["AllConversions_.png", "jpg", "AllConversions_converted.jpg", "falls back when only a prefix remains"],
  [".hidden", "txt", "AllConversions_.hidden.txt", "treats a leading dot as part of the name"],
  ["   .png", "jpg", "AllConversions_converted.jpg", "falls back on a whitespace-only name"],
];

let failed = 0;
const check = (ok, label, detail = "") => {
  if (!ok) failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
};

for (const [input, ext, expected, label] of cases) {
  const got = brandedFilename(input, ext);
  check(got === expected, label, got === expected ? "" : `got "${got}", want "${expected}"`);
}

// A name long enough to exceed the filesystem limit once the prefix is added.
const long = brandedFilename("x".repeat(400) + ".pdf", "docx");
check(long.length <= 255 && long.endsWith(".docx"),
      "truncates over-long names below the 255-byte limit", `${long.length} chars`);

check(brandedZipName("report.pdf", "jpg") === "AllConversions_report-jpg.zip",
      "names a bundled multi-page result");

check(stemOf("a/b.tar.gz") === "a/b.tar" && extOf("a/b.tar.gz") === "gz",
      "stem and extension split on the last dot");

console.log(failed ? `\n  ${failed} failed\n` : `\n  ${cases.length + 3} passed\n`);
process.exit(failed ? 1 : 0);
