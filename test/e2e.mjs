/**
 * End-to-end conversion tests.
 *
 * These drive the real exported site in a real browser and inspect the real
 * download, because every engine depends on browser APIs (canvas, DOMParser,
 * WebAssembly) that cannot be exercised from Node.
 */
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join } from "node:path";
import { chromium } from "playwright";
import * as fx from "./fixtures.mjs";
import { ensureMediaFixtures, MEDIA_DIR } from "./make-media-fixtures.mjs";

const OUT = "out";
const TMP = process.env.TMPDIR ?? "/tmp";
const WORK = join(TMP, "allconversions-e2e");
const PORT = 4173;

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".wasm": "application/wasm", ".xml": "application/xml",
  ".txt": "text/plain", ".ico": "image/x-icon",
};

function serve() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      let path = decodeURIComponent((req.url ?? "/").split("?")[0]);
      let file = join(OUT, path);
      if (!extname(path)) file = join(OUT, path.replace(/\/$/, ""), "index.html");
      if (!existsSync(file)) {
        res.writeHead(404); res.end("not found"); return;
      }
      res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
      res.end(await readFile(file));
    });
    server.listen(PORT, () => resolve(server));
  });
}

/** Every case: a source file, the tool page, and what the result must satisfy. */
async function cases({ media }) {
  const mediaCases = media ? [
    // FFmpeg paths. These load a 31MB wasm core on first use, so they run last
    // and get a longer timeout than the pure-JS engines.
    { name: "MP3 -> WAV",  slug: "mp3-to-wav",  file: "tone.mp3", data: await readFile(join(MEDIA_DIR, "tone.mp3")),
      expect: "AllConversions_tone.wav", magic: [0x52, 0x49, 0x46, 0x46], slow: true },
    { name: "MP3 -> FLAC", slug: "mp3-to-flac", file: "tone.mp3", data: await readFile(join(MEDIA_DIR, "tone.mp3")),
      expect: "AllConversions_tone.flac", magic: [0x66, 0x4c, 0x61, 0x43], slow: true },
    { name: "MP3 -> OGG",  slug: "mp3-to-ogg",  file: "tone.mp3", data: await readFile(join(MEDIA_DIR, "tone.mp3")),
      expect: "AllConversions_tone.ogg", magic: [0x4f, 0x67, 0x67, 0x53], slow: true },
    { name: "MP4 -> MP3",  slug: "mp4-to-mp3",  file: "clip.mp4", data: await readFile(join(MEDIA_DIR, "clip.mp4")),
      expect: "AllConversions_clip.mp3", minBytes: 2000, slow: true },
    { name: "MP4 -> GIF",  slug: "mp4-to-gif",  file: "clip.mp4", data: await readFile(join(MEDIA_DIR, "clip.mp4")),
      expect: "AllConversions_clip.gif", magic: [0x47, 0x49, 0x46], slow: true },
    { name: "MP4 -> WebM", slug: "mp4-to-webm", file: "clip.mp4", data: await readFile(join(MEDIA_DIR, "clip.mp4")),
      expect: "AllConversions_clip.webm", magic: [0x1a, 0x45, 0xdf, 0xa3], slow: true },
  ] : [];

  return [
    { name: "PDF -> Word",     slug: "pdf-to-docx", file: "report.pdf",  data: await fx.samplePdf(2),
      expect: "AllConversions_report.docx", magic: [0x50, 0x4b], minBytes: 3000 },
    { name: "PDF -> text",     slug: "pdf-to-txt",  file: "report.pdf",  data: await fx.samplePdf(1),
      expect: "AllConversions_report.txt", contains: "Quarterly Report" },
    { name: "PDF -> JPG (multi-page zips)", slug: "pdf-to-jpg", file: "report.pdf", data: await fx.samplePdf(3),
      expect: "AllConversions_report-jpg.zip", magic: [0x50, 0x4b] },
    { name: "PNG -> JPG",      slug: "png-to-jpg",  file: "photo.png",   data: fx.samplePng(),
      expect: "AllConversions_photo.jpg", magic: [0xff, 0xd8, 0xff] },
    { name: "PNG -> WebP",     slug: "png-to-webp", file: "photo.png",   data: fx.samplePng(),
      expect: "AllConversions_photo.webp", magic: [0x52, 0x49, 0x46, 0x46] },
    { name: "PNG -> BMP",      slug: "png-to-bmp",  file: "photo.png",   data: fx.samplePng(),
      expect: "AllConversions_photo.bmp", magic: [0x42, 0x4d] },
    { name: "PNG -> ICO",      slug: "png-to-ico",  file: "logo.png",    data: fx.samplePng(),
      expect: "AllConversions_logo.ico", magic: [0x00, 0x00, 0x01, 0x00] },
    { name: "JPG -> PDF",      slug: "png-to-pdf",  file: "scan.png",    data: fx.samplePng(),
      expect: "AllConversions_scan.pdf", magic: [0x25, 0x50, 0x44, 0x46] },
    { name: "DOCX -> PDF",     slug: "docx-to-pdf", file: "brief.docx",  data: await fx.sampleDocx(),
      expect: "AllConversions_brief.pdf", magic: [0x25, 0x50, 0x44, 0x46] },
    { name: "DOCX -> Markdown",slug: "docx-to-md",  file: "brief.docx",  data: await fx.sampleDocx(),
      expect: "AllConversions_brief.md", contains: "# Project Brief" },
    { name: "Markdown -> PDF", slug: "md-to-pdf",   file: "notes.md",    data: Buffer.from(fx.SAMPLE_MD),
      expect: "AllConversions_notes.pdf", magic: [0x25, 0x50, 0x44, 0x46] },
    { name: "HTML -> DOCX",    slug: "html-to-docx",file: "invoice.html",data: Buffer.from(fx.SAMPLE_HTML),
      expect: "AllConversions_invoice.docx", magic: [0x50, 0x4b] },
    { name: "XLSX -> CSV",     slug: "xlsx-to-csv", file: "sales.xlsx",  data: fx.sampleXlsx(),
      expect: "AllConversions_sales.csv", contains: "EMEA" },
    { name: "CSV -> XLSX",     slug: "csv-to-xlsx", file: "sales.csv",   data: Buffer.from(fx.SAMPLE_CSV),
      expect: "AllConversions_sales.xlsx", magic: [0x50, 0x4b] },
    { name: "XLSX -> JSON",    slug: "xlsx-to-json",file: "sales.xlsx",  data: fx.sampleXlsx(),
      expect: "AllConversions_sales.json", contains: '"region"' },
    { name: "JSON -> CSV",     slug: "json-to-csv", file: "team.json",   data: Buffer.from(fx.SAMPLE_JSON),
      expect: "AllConversions_team.csv", contains: "name" },
    { name: "JSON -> YAML",    slug: "json-to-yaml",file: "team.json",   data: Buffer.from(fx.SAMPLE_JSON),
      expect: "AllConversions_team.yaml", contains: "team: platform" },
    { name: "YAML -> JSON",    slug: "yaml-to-json",file: "conf.yaml",   data: Buffer.from(fx.SAMPLE_YAML),
      expect: "AllConversions_conf.json", contains: '"replicas": 3' },
    { name: "XML -> JSON",     slug: "xml-to-json", file: "catalog.xml", data: Buffer.from(fx.SAMPLE_XML),
      expect: "AllConversions_catalog.json", contains: "Dune" },
    { name: "JSON -> XML",     slug: "json-to-xml", file: "team.json",   data: Buffer.from(fx.SAMPLE_JSON),
      expect: "AllConversions_team.xml", contains: "<team>platform</team>" },
    { name: "EPUB -> PDF",     slug: "epub-to-pdf", file: "book.epub",   data: fx.sampleEpub(),
      expect: "AllConversions_book.pdf", magic: [0x25, 0x50, 0x44, 0x46] },
    { name: "EPUB -> text",    slug: "epub-to-txt", file: "book.epub",   data: fx.sampleEpub(),
      expect: "AllConversions_book.txt", contains: "The Lighthouse" },
    { name: "EPUB -> DOCX",    slug: "epub-to-docx",file: "book.epub",   data: fx.sampleEpub(),
      expect: "AllConversions_book.docx", magic: [0x50, 0x4b] },
    { name: "Markdown -> EPUB",slug: "md-to-epub",  file: "notes.md",    data: Buffer.from(fx.SAMPLE_MD),
      expect: "AllConversions_notes.epub", magic: [0x50, 0x4b] },
    { name: "PDF -> ZIP",      slug: "pdf-to-zip",  file: "report.pdf",  data: await fx.samplePdf(1),
      expect: "AllConversions_report.zip", magic: [0x50, 0x4b] },
    // Re-converting an already-stamped file must not stack the prefix.
    { name: "no double prefix", slug: "png-to-jpg", file: "AllConversions_photo.png", data: fx.samplePng(),
      expect: "AllConversions_photo.jpg", magic: [0xff, 0xd8, 0xff] },

    // ---- failure paths: a bad file must explain itself, not crash ----
    { name: "corrupt PDF explains itself", slug: "pdf-to-docx", file: "broken.pdf",
      data: Buffer.from("this is definitely not a pdf"),
      expectError: /could not be read as a PDF/i, canRetry: true },
    { name: "scanned PDF suggests OCR path", slug: "pdf-to-docx", file: "scanned.pdf",
      data: await fx.imageOnlyPdf(),
      expectError: /no selectable text/i, canRetry: true },
    { name: "wrong type on locked tool", slug: "pdf-to-docx", file: "photo.png",
      data: fx.samplePng(),
      expectError: /expects a PDF file/i, noRetry: true },
    { name: "invalid JSON explains itself", slug: "json-to-csv", file: "bad.json",
      data: Buffer.from("{ not: valid json ,,, }"),
      expectError: /isn't valid JSON/i, canRetry: true },

    ...mediaCases,
  ];
}

const bytesMatch = (buf, magic) => magic.every((b, i) => buf[i] === b);

async function main() {
  const only = process.argv[2];
  await rm(WORK, { recursive: true, force: true });
  await mkdir(WORK, { recursive: true });

  const server = await serve();
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  // Media fixtures need a browser of their own to generate; skip them with
  // SKIP_MEDIA=1 for a fast pure-JS run.
  const media = process.env.SKIP_MEDIA !== "1";
  if (media) await ensureMediaFixtures();

  const all = await cases({ media });
  const list = only ? all.filter((c) => c.name.toLowerCase().includes(only.toLowerCase())) : all;
  const results = [];

  for (const testCase of list) {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on("pageerror", (e) => consoleErrors.push(String(e)));

    try {
      const src = join(WORK, testCase.file);
      await writeFile(src, testCase.data);

      await page.goto(`http://localhost:${PORT}/convert/${testCase.slug}/`, { waitUntil: "load" });
      await page.setInputFiles('input[type="file"]', src);

      // Failure cases assert that a bad file produces a readable message
      // rather than a crash, a hang or a zero-byte download.
      if (testCase.expectError) {
        const convert = page.getByRole("button", { name: /^Convert$/ }).first();
        if (await convert.count()) await convert.click();

        const message = page.locator(".text-red-600").first();
        await message.waitFor({ state: "visible", timeout: 60_000 });
        const text = (await message.textContent()) ?? "";

        const problems = [];
        if (!testCase.expectError.test(text)) {
          problems.push(`message "${text.trim()}" does not match ${testCase.expectError}`);
        }
        // A fatal rejection must not offer a Retry that can only fail again.
        const retries = await page.getByRole("button", { name: /^Retry$/ }).count();
        if (testCase.noRetry && retries > 0) problems.push("offered Retry on an unusable file");
        if (testCase.canRetry && retries === 0) problems.push("no Retry offered on a recoverable failure");

        results.push({
          name: testCase.name, ok: problems.length === 0, problems,
          size: 0, suggested: text.trim().slice(0, 44),
        });
        continue;
      }

      await page.getByRole("button", { name: /^Convert$/ }).first().click();

      const saveButton = page.getByRole("button", { name: /^Save$/ }).first();
      await saveButton.waitFor({ state: "visible", timeout: testCase.slow ? 300_000 : 60_000 });

      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 30_000 }),
        saveButton.click(),
      ]);

      const suggested = download.suggestedFilename();
      const saved = join(WORK, `out-${suggested}`);
      await download.saveAs(saved);
      const buf = await readFile(saved);

      const problems = [];
      if (suggested !== testCase.expect) {
        problems.push(`filename "${suggested}" != "${testCase.expect}"`);
      }
      if (buf.length === 0) problems.push("output is empty");
      if (testCase.minBytes && buf.length < testCase.minBytes) {
        problems.push(`only ${buf.length} bytes, expected >= ${testCase.minBytes}`);
      }
      if (testCase.magic && !bytesMatch(buf, testCase.magic)) {
        problems.push(`bad magic bytes: ${[...buf.subarray(0, 4)].map((b) => b.toString(16)).join(" ")}`);
      }
      if (testCase.contains && !buf.toString("utf8").includes(testCase.contains)) {
        problems.push(`output does not contain "${testCase.contains}"`);
      }
      if (consoleErrors.length) problems.push(`page error: ${consoleErrors[0].slice(0, 120)}`);

      results.push({ name: testCase.name, ok: problems.length === 0, problems, size: buf.length, suggested });
    } catch (err) {
      // Surface the in-page error message rather than just the timeout.
      const shown = await page.locator("p.font-medium.text-red-600, .text-red-600").first()
        .textContent().catch(() => null);
      results.push({
        name: testCase.name, ok: false, size: 0, suggested: "-",
        problems: [shown ? `UI error: ${shown}` : String(err).split("\n")[0].slice(0, 160)],
      });
    } finally {
      await context.close();
    }
  }

  await browser.close();
  server.close();

  let failed = 0;
  console.log("");
  for (const r of results) {
    if (r.ok) {
      console.log(`  PASS  ${r.name.padEnd(32)} ${String(r.size).padStart(8)} B  ${r.suggested}`);
    } else {
      failed++;
      console.log(`  FAIL  ${r.name.padEnd(32)} ${r.problems.join("; ")}`);
    }
  }
  console.log(`\n  ${results.length - failed}/${results.length} passed\n`);
  process.exit(failed ? 1 : 0);
}

main();
