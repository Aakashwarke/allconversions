import * as XLSX from "xlsx";
import { brandedFilename } from "../naming";
import { textToPdfBytes } from "./pdf-write";
import { ConvertRequest, ConvertResult, ConversionError } from "./types";

/** SheetJS book types keyed by our target extension. */
const BOOK_TYPE: Record<string, XLSX.BookType> = {
  xlsx: "xlsx", xls: "biff8", ods: "ods", csv: "csv", tsv: "txt", html: "html",
};

export async function convertSheet(req: ConvertRequest): Promise<ConvertResult> {
  const { file, to, options, onProgress } = req;

  onProgress?.(0.15, "Reading workbook");
  let book: XLSX.WorkBook;
  try {
    book = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  } catch {
    throw new ConversionError("That spreadsheet could not be read.");
  }
  if (!book.SheetNames.length) throw new ConversionError("This workbook has no sheets.");

  const sheetName = options.sheet && book.SheetNames.includes(options.sheet)
    ? options.sheet
    : book.SheetNames[0];

  onProgress?.(0.55, `Writing ${to.toUpperCase()}`);

  // JSON isn't a SheetJS book type; build it from the active sheet's rows.
  if (to === "json") {
    const rows = XLSX.utils.sheet_to_json(book.Sheets[sheetName], { defval: null });
    return finish(new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" }));
  }

  if (to === "pdf") {
    const text = XLSX.utils.sheet_to_csv(book.Sheets[sheetName], { FS: "  |  " });
    // Landscape-ish margins are handled by the smaller font; tables are wide.
    const bytes = await textToPdfBytes(`${sheetName}\n\n${text}`, { fontSize: 8.5 });
    return finish(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  }

  const bookType = BOOK_TYPE[to];
  if (!bookType) throw new ConversionError(`Cannot write ${to.toUpperCase()} spreadsheets.`);

  // CSV/TSV are single-sheet formats: narrow the book so SheetJS doesn't
  // silently drop everything but the first tab without telling the user.
  let outBook = book;
  if (to === "csv" || to === "tsv") {
    outBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(outBook, book.Sheets[sheetName], sheetName.slice(0, 31));
  }

  // bookType "txt" is SheetJS's tab-separated writer, so TSV needs no extra
  // delimiter option here.
  const written = XLSX.write(outBook, { bookType, type: "array" });
  return finish(new Blob([written], { type: "application/octet-stream" }));

  function finish(blob: Blob): ConvertResult {
    onProgress?.(1, "Done");
    return { blob, filename: brandedFilename(file.name, to) };
  }
}
