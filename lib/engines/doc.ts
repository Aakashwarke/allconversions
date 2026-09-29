import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { marked } from "marked";
import { brandedFilename } from "../naming";
import { extractPdfText, pagesToPlainText } from "./pdf-read";
import { textToPdfBytes } from "./pdf-write";
import { ConvertRequest, ConvertResult, ConversionError } from "./types";

/** A format-neutral view of a document: a flat list of typed blocks. */
export interface Block {
  kind: "h1" | "h2" | "h3" | "p" | "li" | "code";
  text: string;
}

// ---------------------------------------------------------------- readers ---

export async function readBlocks(
  file: File, ext: string, onProgress?: (f: number, l?: string) => void,
): Promise<Block[]> {
  switch (ext) {
    case "docx": {
      onProgress?.(0.2, "Reading Word file");
      const mammoth = await import("mammoth");
      const { value } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
      return htmlToBlocks(value);
    }
    case "pdf": {
      const pages = await extractPdfText(file, onProgress);
      return pagesToPlainText(pages).split(/\n{2,}/).map(textBlock);
    }
    case "md":
      onProgress?.(0.2, "Parsing Markdown");
      return htmlToBlocks(await marked.parse(await file.text(), { async: true }));
    case "html":
      onProgress?.(0.2, "Parsing HTML");
      return htmlToBlocks(await file.text());
    case "rtf":
      onProgress?.(0.2, "Reading rich text");
      return rtfToText(await file.text()).split(/\n{2,}/).map(textBlock);
    case "txt":
    default:
      onProgress?.(0.2, "Reading text");
      return (await file.text()).split(/\n{2,}/).map(textBlock);
  }
}

const textBlock = (t: string): Block => ({ kind: "p", text: t.trim() });

/**
 * Parse HTML into blocks using the browser's own parser, so we inherit correct
 * entity handling and malformed-markup recovery for free.
 */
function htmlToBlocks(html: string): Block[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, noscript").forEach((n) => n.remove());

  const blocks: Block[] = [];
  const selector = "h1, h2, h3, h4, h5, h6, p, li, pre, blockquote";
  for (const el of Array.from(doc.body.querySelectorAll(selector))) {
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const tag = el.tagName.toLowerCase();
    const kind: Block["kind"] =
      tag === "h1" ? "h1"
      : tag === "h2" ? "h2"
      : /^h[3-6]$/.test(tag) ? "h3"
      : tag === "li" ? "li"
      : tag === "pre" ? "code"
      : "p";
    blocks.push({ kind, text });
  }

  // A fragment with no block-level elements still has text worth keeping.
  if (!blocks.length) {
    const text = (doc.body.textContent ?? "").trim();
    if (text) blocks.push({ kind: "p", text });
  }
  return blocks.filter((b) => b.text);
}

/** Minimal RTF reader: enough for documents produced by word processors. */
function rtfToText(rtf: string): string {
  return rtf
    .replace(/\\'([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\par[d]?\s?/g, "\n")
    .replace(/\\tab\s?/g, "\t")
    .replace(/\{\\\*[^}]*\}/g, "")   // drop metadata groups entirely
    .replace(/\\[a-z]+-?\d*\s?/gi, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------- writers ---

export function blocksToPlainText(blocks: Block[]): string {
  return blocks
    .map((b) => (b.kind === "li" ? `• ${b.text}` : b.text))
    .join("\n\n");
}

export function blocksToMarkdown(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.kind) {
        case "h1": return `# ${b.text}`;
        case "h2": return `## ${b.text}`;
        case "h3": return `### ${b.text}`;
        case "li": return `- ${b.text}`;
        case "code": return "```\n" + b.text + "\n```";
        default: return b.text;
      }
    })
    .join("\n\n");
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
   .replace(/"/g, "&quot;");

export function blocksToHtml(blocks: Block[], title: string): string {
  const body = blocks
    .map((b) => {
      const text = escapeHtml(b.text);
      switch (b.kind) {
        case "h1": return `  <h1>${text}</h1>`;
        case "h2": return `  <h2>${text}</h2>`;
        case "h3": return `  <h3>${text}</h3>`;
        case "li": return `  <li>${text}</li>`;
        case "code": return `  <pre><code>${text}</code></pre>`;
        default: return `  <p>${text}</p>`;
      }
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body { max-width: 46rem; margin: 3rem auto; padding: 0 1.25rem;
         font: 16px/1.7 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         color: #1a1a1f; }
  h1, h2, h3 { line-height: 1.25; margin: 2rem 0 .75rem; }
  pre { background: #f5f5f7; padding: 1rem; border-radius: .5rem; overflow-x: auto; }
</style>
</head>
<body>
${body}
</body>
</html>
`;
}

/** RTF control words need braces and backslashes escaped, plus \uN for non-ASCII. */
export function blocksToRtf(blocks: Block[]): string {
  const esc = (s: string) =>
    s.replace(/[\\{}]/g, (c) => `\\${c}`)
     .replace(/[\u0080-￿]/g, (c) => `\\u${c.charCodeAt(0)}?`);

  const body = blocks
    .map((b) => {
      const size = b.kind === "h1" ? 36 : b.kind === "h2" ? 30 : b.kind === "h3" ? 26 : 22;
      const bold = b.kind.startsWith("h") ? "\\b " : "";
      const boldOff = b.kind.startsWith("h") ? "\\b0 " : "";
      const text = b.kind === "li" ? `\\bullet  ${esc(b.text)}` : esc(b.text);
      return `\\pard\\sa180\\fs${size} ${bold}${text}${boldOff}\\par`;
    })
    .join("\n");

  return `{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\fswiss Helvetica;}}\n${body}\n}`;
}

export async function blocksToDocx(blocks: Block[], title: string): Promise<Blob> {
  const HEADING = {
    h1: HeadingLevel.HEADING_1,
    h2: HeadingLevel.HEADING_2,
    h3: HeadingLevel.HEADING_3,
  } as const;

  const children = blocks.map((b) => {
    if (b.kind === "h1" || b.kind === "h2" || b.kind === "h3") {
      return new Paragraph({ text: b.text, heading: HEADING[b.kind] });
    }
    if (b.kind === "li") {
      return new Paragraph({ text: b.text, bullet: { level: 0 } });
    }
    if (b.kind === "code") {
      return new Paragraph({
        children: [new TextRun({ text: b.text, font: "Consolas", size: 20 })],
        spacing: { after: 160 },
      });
    }
    return new Paragraph({
      children: [new TextRun({ text: b.text, size: 22 })],
      spacing: { after: 160 },
    });
  });

  const doc = new Document({
    title,
    creator: "AllConversions",
    description: `Converted with AllConversions`,
    sections: [{ children: children.length ? children : [new Paragraph("")] }],
  });
  return Packer.toBlob(doc);
}

// ------------------------------------------------------------- dispatcher ---

export async function convertDocument(req: ConvertRequest): Promise<ConvertResult> {
  const { file, from, to, onProgress } = req;

  const blocks = await readBlocks(file, from, onProgress);
  if (!blocks.length) throw new ConversionError("That document appears to be empty.");

  onProgress?.(0.8, `Writing ${to.toUpperCase()}`);
  const title = file.name.replace(/\.[^.]+$/, "");

  switch (to) {
    case "txt":
      return done(new Blob([blocksToPlainText(blocks)], { type: "text/plain;charset=utf-8" }));
    case "md":
      return done(new Blob([blocksToMarkdown(blocks)], { type: "text/markdown;charset=utf-8" }));
    case "html":
      return done(new Blob([blocksToHtml(blocks, title)], { type: "text/html;charset=utf-8" }));
    case "rtf":
      return done(new Blob([blocksToRtf(blocks)], { type: "application/rtf" }));
    case "docx":
      return done(await blocksToDocx(blocks, title));
    case "pdf": {
      const bytes = await textToPdfBytes(blocksToPlainText(blocks));
      return done(new Blob([bytes as BlobPart], { type: "application/pdf" }));
    }
    default:
      throw new ConversionError(`Cannot write ${to.toUpperCase()} documents yet.`);
  }

  function done(blob: Blob): ConvertResult {
    onProgress?.(1, "Done");
    return { blob, filename: brandedFilename(file.name, to) };
  }
}
