// Builds small, valid sample files for each family we claim to support.
// Everything is generated in-process so the test suite has no binary fixtures.
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Document, Packer, Paragraph, HeadingLevel } from "docx";
import * as XLSX from "xlsx";
import { zipSync, strToU8 } from "fflate";
import { deflateSync } from "node:zlib";

export async function samplePdf(pages = 2) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([595, 842]);
    page.drawText(`Quarterly Report`, { x: 56, y: 760, size: 24, font });
    page.drawText(`Page ${i} of ${pages}. Revenue grew by 12 percent.`,
                  { x: 56, y: 720, size: 12, font });
    page.drawText(`The second line of page ${i} for extraction testing.`,
                  { x: 56, y: 700, size: 12, font });
  }
  return Buffer.from(await doc.save());
}

/** A PDF with no text layer, standing in for a scanned document. */
export async function imageOnlyPdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 200]);
  const png = await doc.embedPng(samplePng());
  page.drawImage(png, { x: 20, y: 20, width: 260, height: 160 });
  return Buffer.from(await doc.save());
}

export async function sampleDocx() {
  const doc = new Document({
    sections: [{ children: [
      new Paragraph({ text: "Project Brief", heading: HeadingLevel.HEADING_1 }),
      new Paragraph("This paragraph exists so extraction has something to find."),
      new Paragraph({ text: "Milestones", heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ text: "Ship the beta", bullet: { level: 0 } }),
    ]}],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

export function sampleXlsx() {
  const sheet = XLSX.utils.json_to_sheet([
    { region: "EMEA", units: 120, revenue: 40200.5 },
    { region: "APAC", units: 98,  revenue: 31880.0 },
    { region: "AMER", units: 143, revenue: 52310.25 },
  ]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Sales");
  return Buffer.from(XLSX.write(book, { bookType: "xlsx", type: "buffer" }));
}

/** A 4x3 PNG written by hand so the fixture has no image dependency. */
export function samplePng() {
  const w = 4, h = 3;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 4 + 1);
    raw[row] = 0;                                  // filter: none
    for (let x = 0; x < w; x++) {
      const p = row + 1 + x * 4;
      raw[p] = (x * 60) & 255; raw[p + 1] = (y * 80) & 255;
      raw[p + 2] = 200; raw[p + 3] = 255;
    }
  }
  const crcTable = [...Array(256)].map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, cr]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export function sampleEpub() {
  const chapter = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Ch 1</title></head>
<body><h1>The Lighthouse</h1><p>It stood where the cliff gave way to nothing.</p>
<p>Every night it turned, and every night the sea ignored it.</p></body></html>`;
  return Buffer.from(zipSync({
    mimetype: [strToU8("application/epub+zip"), { level: 0 }],
    "META-INF/container.xml": strToU8(`<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`),
    "OEBPS/content.opf": strToU8(`<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">x1</dc:identifier>
<dc:title>The Lighthouse</dc:title><dc:language>en</dc:language></metadata>
<manifest><item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/></manifest>
<spine><itemref idref="c1"/></spine></package>`),
    "OEBPS/chapter1.xhtml": strToU8(chapter),
  }));
}

export const SAMPLE_JSON = JSON.stringify({
  team: "platform",
  members: [
    { name: "A", role: "eng", active: true },
    { name: "B", role: "design", active: false },
  ],
}, null, 2);

export const SAMPLE_CSV = "region,units,revenue\nEMEA,120,40200.5\nAPAC,98,31880\nAMER,143,52310.25\n";
export const SAMPLE_MD = "# Release Notes\n\nShipped the **converter**.\n\n## Fixes\n\n- Handled empty files\n- Fixed the zip name\n";
export const SAMPLE_HTML = "<!doctype html><html><body><h1>Invoice</h1><p>Amount due: 240.00</p><ul><li>Line one</li></ul></body></html>";
export const SAMPLE_XML = `<?xml version="1.0"?><catalog><book id="1"><title>Dune</title><year>1965</year></book><book id="2"><title>Ubik</title><year>1969</year></book></catalog>`;
export const SAMPLE_YAML = "service: api\nreplicas: 3\nports:\n  - 80\n  - 443\nenv:\n  LOG_LEVEL: debug\n";
