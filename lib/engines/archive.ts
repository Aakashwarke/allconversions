import { zipSync } from "fflate";
import { brandedFilename } from "../naming";
import { ConvertRequest, ConvertResult } from "./types";

/** Compress a single file into a zip. Batch jobs zip many at the call site. */
export async function convertArchive(req: ConvertRequest): Promise<ConvertResult> {
  const { file, onProgress } = req;

  onProgress?.(0.3, "Compressing");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const zipped = zipSync({ [file.name]: bytes }, { level: 6 });

  onProgress?.(1, "Done");
  return {
    blob: new Blob([zipped as BlobPart], { type: "application/zip" }),
    filename: brandedFilename(file.name, "zip"),
  };
}

/** Bundle several already-converted results into one download. */
export function bundleResults(results: { filename: string; bytes: Uint8Array }[]): Blob {
  const entries: Record<string, Uint8Array> = {};
  for (const r of results) {
    // Two source files can convert to the same name; disambiguate rather than
    // letting the later one silently overwrite the earlier.
    let name = r.filename;
    let n = 2;
    while (entries[name]) {
      const dot = r.filename.lastIndexOf(".");
      name = `${r.filename.slice(0, dot)} (${n++})${r.filename.slice(dot)}`;
    }
    entries[name] = r.bytes;
  }
  return new Blob([zipSync(entries, { level: 6 }) as BlobPart], { type: "application/zip" });
}
