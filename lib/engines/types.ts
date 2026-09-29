export interface ConvertOptions {
  /** 0-1 encoder quality for lossy raster and media output. */
  quality?: number;
  /** Longest-edge cap in px; 0 means keep original size. */
  maxDimension?: number;
  /** Page size for generated PDFs. */
  pageSize?: "a4" | "letter" | "fit";
  /** DPI used when rasterising PDF pages. */
  dpi?: number;
  /** Flatten transparency onto this colour when the target has no alpha. */
  background?: string;
  /** For spreadsheet/data output: which sheet to take. */
  sheet?: string;
}

export interface ConvertRequest {
  file: File;
  from: string;
  to: string;
  options: ConvertOptions;
  onProgress?: (fraction: number, label?: string) => void;
}

export interface ConvertResult {
  blob: Blob;
  filename: string;
  /** Set when many outputs were bundled into one archive. */
  bundled?: number;
}

export class ConversionError extends Error {
  constructor(message: string, readonly hint?: string) {
    super(message);
    this.name = "ConversionError";
  }
}

export const DEFAULTS: Required<Pick<ConvertOptions, "quality" | "dpi" | "pageSize" | "background">> = {
  quality: 0.9,
  dpi: 150,
  pageSize: "fit",
  background: "#ffffff",
};
