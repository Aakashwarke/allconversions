export type Category =
  | "image" | "document" | "spreadsheet" | "data"
  | "ebook" | "archive" | "audio" | "video";

export interface Format {
  id: string;          // canonical extension, lowercase
  name: string;        // display name
  mime: string;
  category: Category;
  /** Long-form copy used on the per-conversion landing pages. */
  blurb: string;
}

const F = (
  id: string, name: string, mime: string, category: Category, blurb: string,
): Format => ({ id, name, mime, category, blurb });

export const FORMATS: Format[] = [
  // ---- image ----
  F("jpg",  "JPEG Image", "image/jpeg", "image", "The universal lossy photo format. Small files, no transparency."),
  F("png",  "PNG Image",  "image/png",  "image", "Lossless raster with alpha transparency. Ideal for logos and screenshots."),
  F("webp", "WebP Image", "image/webp", "image", "Google's modern format: ~30% smaller than JPEG at the same quality."),
  F("avif", "AVIF Image", "image/avif", "image", "AV1-based next-gen format with the best compression available in browsers."),
  F("gif",  "GIF Image",  "image/gif",  "image", "256-colour format known for short looping animations."),
  F("bmp",  "Bitmap Image", "image/bmp", "image", "Uncompressed Windows raster format."),
  F("ico",  "Icon File",  "image/x-icon", "image", "Windows and favicon icon container."),
  F("svg",  "SVG Vector", "image/svg+xml", "image", "XML vector graphics that scale to any size without quality loss."),

  // ---- document ----
  F("pdf",  "PDF Document", "application/pdf", "document", "The fixed-layout standard for sharing and printing documents."),
  F("docx", "Word Document", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "document", "Microsoft Word's modern editable document format."),
  F("rtf",  "Rich Text",  "application/rtf", "document", "Portable formatted text readable by nearly every word processor."),
  F("txt",  "Plain Text", "text/plain", "document", "Raw unformatted text, readable everywhere."),
  F("md",   "Markdown",   "text/markdown", "document", "Lightweight plain-text markup used across the web and in docs."),
  F("html", "HTML Page",  "text/html", "document", "The markup language of the web, viewable in any browser."),

  // ---- spreadsheet ----
  F("xlsx", "Excel Workbook", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "spreadsheet", "Microsoft Excel's modern spreadsheet format."),
  F("xls",  "Excel 97-2003",  "application/vnd.ms-excel", "spreadsheet", "The legacy binary Excel format still used by older systems."),
  F("ods",  "OpenDocument Sheet", "application/vnd.oasis.opendocument.spreadsheet", "spreadsheet", "The open standard spreadsheet used by LibreOffice and OpenOffice."),
  F("csv",  "CSV",  "text/csv", "spreadsheet", "Comma-separated values: the lingua franca of tabular data."),
  F("tsv",  "TSV",  "text/tab-separated-values", "spreadsheet", "Tab-separated values, safer than CSV when your data contains commas."),

  // ---- data ----
  F("json", "JSON", "application/json", "data", "The dominant structured data format for APIs and configuration."),
  F("yaml", "YAML", "application/yaml", "data", "Human-friendly structured data used for config files and CI pipelines."),
  F("xml",  "XML",  "application/xml", "data", "Verbose, strongly structured markup used in enterprise and legacy systems."),
  F("ndjson", "NDJSON", "application/x-ndjson", "data", "Newline-delimited JSON for streaming and log pipelines."),

  // ---- ebook ----
  F("epub", "EPUB eBook", "application/epub+zip", "ebook", "The open ebook standard supported by almost every reader except Kindle."),
  F("fb2",  "FictionBook", "application/x-fictionbook+xml", "ebook", "XML-based ebook format popular across Eastern Europe."),

  // ---- archive ----
  F("zip",  "ZIP Archive", "application/zip", "archive", "The universal compressed archive format."),

  // ---- audio ----
  F("mp3",  "MP3 Audio", "audio/mpeg", "audio", "The most widely compatible compressed audio format in existence."),
  F("wav",  "WAV Audio", "audio/wav", "audio", "Uncompressed PCM audio used for editing and mastering."),
  F("ogg",  "OGG Vorbis", "audio/ogg", "audio", "Royalty-free compressed audio used in games and open-source software."),
  F("opus", "Opus Audio", "audio/opus", "audio", "The best-in-class low-latency codec behind most modern voice chat."),
  F("m4a",  "M4A Audio", "audio/mp4", "audio", "AAC audio in an MP4 container; Apple's default for music."),
  F("aac",  "AAC Audio", "audio/aac", "audio", "The successor to MP3, standard in streaming and broadcast."),
  F("flac", "FLAC Audio", "audio/flac", "audio", "Lossless compression that halves file size with zero quality loss."),

  // ---- video ----
  F("mp4",  "MP4 Video", "video/mp4", "video", "The default video container for the web, phones and social platforms."),
  F("webm", "WebM Video", "video/webm", "video", "Google's open, royalty-free video format built for the web."),
  F("mkv",  "Matroska Video", "video/x-matroska", "video", "A flexible container that holds virtually any codec and track count."),
  F("mov",  "QuickTime Video", "video/quicktime", "video", "Apple's container, produced by iPhones and professional editors."),
  F("avi",  "AVI Video", "video/x-msvideo", "video", "Microsoft's legacy container, still common in older archives."),
];

export const FORMAT_BY_ID = new Map(FORMATS.map((f) => [f.id, f]));

export const CATEGORY_LABEL: Record<Category, string> = {
  image: "Images", document: "Documents", spreadsheet: "Spreadsheets",
  data: "Data", ebook: "eBooks", archive: "Archives",
  audio: "Audio", video: "Video",
};

/** Common aliases users type or that files actually carry. */
export const ALIASES: Record<string, string> = {
  jpeg: "jpg", jpe: "jpg", htm: "html",
  yml: "yaml", markdown: "md", text: "txt", mpeg4: "mp4",
};

export function resolveFormat(ext: string): Format | undefined {
  const k = ext.toLowerCase().replace(/^\./, "");
  return FORMAT_BY_ID.get(ALIASES[k] ?? k);
}
