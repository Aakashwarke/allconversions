import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";
import { brandedFilename, stemOf } from "../naming";
import { Block, blocksToDocx, blocksToHtml, blocksToMarkdown, blocksToPlainText, readBlocks } from "./doc";
import { textToPdfBytes } from "./pdf-write";
import { ConvertRequest, ConvertResult, ConversionError } from "./types";

/**
 * EPUB is a zip of XHTML documents plus an OPF manifest that defines reading
 * order. We follow the spine so chapters come out in the author's order rather
 * than whatever order the zip happens to store them in.
 */
function readEpub(bytes: Uint8Array): { title: string; blocks: Block[] } {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new ConversionError("That EPUB is corrupt or not a valid zip archive.");
  }

  const parser = new DOMParser();
  const readText = (path: string) =>
    files[path] ? strFromU8(files[path]) : undefined;

  // container.xml points at the OPF package document.
  const container = readText("META-INF/container.xml");
  let opfPath = "";
  if (container) {
    const rootfile = parser
      .parseFromString(container, "application/xml")
      .querySelector("rootfile");
    opfPath = rootfile?.getAttribute("full-path") ?? "";
  }
  if (!opfPath) {
    opfPath = Object.keys(files).find((f) => f.toLowerCase().endsWith(".opf")) ?? "";
  }

  const base = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
  let title = "Untitled";
  let ordered: string[] = [];

  const opf = readText(opfPath);
  if (opf) {
    const doc = parser.parseFromString(opf, "application/xml");
    title = doc.querySelector("title")?.textContent?.trim() || title;

    const hrefById = new Map<string, string>();
    for (const item of Array.from(doc.querySelectorAll("manifest > item"))) {
      const id = item.getAttribute("id");
      const href = item.getAttribute("href");
      const type = item.getAttribute("media-type") ?? "";
      if (id && href && /xhtml|html/.test(type)) hrefById.set(id, href);
    }
    ordered = Array.from(doc.querySelectorAll("spine > itemref"))
      .map((ref) => hrefById.get(ref.getAttribute("idref") ?? ""))
      .filter((h): h is string => Boolean(h))
      .map((href) => normalise(base + href));
  }

  // Fall back to every XHTML file in the archive if the spine was unusable.
  if (!ordered.length) {
    ordered = Object.keys(files).filter((f) => /\.x?html?$/i.test(f)).sort();
  }

  const blocks: Block[] = [];
  for (const path of ordered) {
    const html = readText(path);
    if (!html) continue;
    const chapter = parser.parseFromString(html, "text/html");
    chapter.querySelectorAll("script, style").forEach((n) => n.remove());

    for (const el of Array.from(chapter.body?.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,pre") ?? [])) {
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!text) continue;
      const tag = el.tagName.toLowerCase();
      blocks.push({
        kind: tag === "h1" ? "h1" : tag === "h2" ? "h2"
            : /^h[3-6]$/.test(tag) ? "h3" : tag === "li" ? "li"
            : tag === "pre" ? "code" : "p",
        text,
      });
    }
  }

  if (!blocks.length) throw new ConversionError("No readable chapters were found in this EPUB.");
  return { title, blocks };
}

/** Resolve "OEBPS/../images/x" style paths that appear in some EPUBs. */
function normalise(path: string): string {
  const parts: string[] = [];
  for (const seg of path.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

/** FictionBook is a single XML document with <body><section><p> structure. */
function readFb2(text: string): { title: string; blocks: Block[] } {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new ConversionError("That FB2 file is not well-formed XML.");
  }
  const title = doc.querySelector("book-title")?.textContent?.trim() || "Untitled";

  const blocks: Block[] = [];
  for (const body of Array.from(doc.getElementsByTagName("body"))) {
    for (const el of Array.from(body.querySelectorAll("title, subtitle, p"))) {
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!text) continue;
      const tag = el.tagName.toLowerCase();
      blocks.push({ kind: tag === "title" ? "h2" : tag === "subtitle" ? "h3" : "p", text });
    }
  }
  if (!blocks.length) throw new ConversionError("No readable text was found in this FB2 file.");
  return { title, blocks };
}

/** Build a minimal but spec-valid EPUB 3 package. */
function writeEpub(title: string, blocks: Block[]): Blob {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const body = blocks
    .map((b) => {
      const t = esc(b.text);
      switch (b.kind) {
        case "h1": return `<h1>${t}</h1>`;
        case "h2": return `<h2>${t}</h2>`;
        case "h3": return `<h3>${t}</h3>`;
        case "li": return `<li>${t}</li>`;
        case "code": return `<pre>${t}</pre>`;
        default: return `<p>${t}</p>`;
      }
    })
    .join("\n");

  const uid = `urn:uuid:${crypto.randomUUID()}`;
  const safeTitle = esc(title);

  const chapter = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>${safeTitle}</title></head>
<body>
${body}
</body>
</html>`;

  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${uid}</dc:identifier>
    <dc:title>${safeTitle}</dc:title>
    <dc:language>en</dc:language>
    <dc:publisher>AllConversions</dc:publisher>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, "Z")}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine><itemref idref="ch1"/></spine>
</package>`;

  const nav = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Contents</title></head>
<body><nav epub:type="toc"><h1>Contents</h1>
<ol><li><a href="chapter1.xhtml">${safeTitle}</a></li></ol>
</nav></body>
</html>`;

  // mimetype must be the first entry and stored uncompressed (level 0).
  const zipped = zipSync({
    mimetype: [strToU8("application/epub+zip"), { level: 0 }],
    "META-INF/container.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`),
    "OEBPS/content.opf": strToU8(opf),
    "OEBPS/nav.xhtml": strToU8(nav),
    "OEBPS/chapter1.xhtml": strToU8(chapter),
  });

  return new Blob([zipped as BlobPart], { type: "application/epub+zip" });
}

export async function convertEbook(req: ConvertRequest): Promise<ConvertResult> {
  const { file, from, to, onProgress } = req;
  onProgress?.(0.15, "Opening book");

  let title = stemOf(file.name);
  let blocks: Block[];

  if (from === "epub") {
    const parsed = readEpub(new Uint8Array(await file.arrayBuffer()));
    title = parsed.title;
    blocks = parsed.blocks;
  } else if (from === "fb2") {
    const parsed = readFb2(await file.text());
    title = parsed.title;
    blocks = parsed.blocks;
  } else {
    // Markup or Word going the other way, into EPUB.
    blocks = await readBlocks(file, from, onProgress);
  }

  onProgress?.(0.7, `Writing ${to.toUpperCase()}`);

  const finish = (blob: Blob): ConvertResult => {
    onProgress?.(1, "Done");
    return { blob, filename: brandedFilename(file.name, to) };
  };

  switch (to) {
    case "epub": return finish(writeEpub(title, blocks));
    case "txt":  return finish(new Blob([blocksToPlainText(blocks)], { type: "text/plain;charset=utf-8" }));
    case "md":   return finish(new Blob([blocksToMarkdown(blocks)], { type: "text/markdown;charset=utf-8" }));
    case "html": return finish(new Blob([blocksToHtml(blocks, title)], { type: "text/html;charset=utf-8" }));
    case "docx": return finish(await blocksToDocx(blocks, title));
    case "pdf": {
      const bytes = await textToPdfBytes(`${title}\n\n${blocksToPlainText(blocks)}`);
      return finish(new Blob([bytes as BlobPart], { type: "application/pdf" }));
    }
    default:
      throw new ConversionError(`Cannot write ${to.toUpperCase()} from an ebook.`);
  }
}
