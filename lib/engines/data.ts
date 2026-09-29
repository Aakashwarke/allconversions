import * as YAML from "js-yaml";
import * as XLSX from "xlsx";
import { brandedFilename } from "../naming";
import { ConvertRequest, ConvertResult, ConversionError } from "./types";

type Json = unknown;

/** Parse any supported data format into plain JavaScript values. */
function parse(text: string, ext: string): Json {
  switch (ext) {
    case "json":
      return JSON.parse(text);
    case "ndjson":
      return text.split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l));
    case "yaml":
      return YAML.load(text);
    case "xml":
      return xmlToJson(text);
    case "csv":
    case "tsv": {
      const book = XLSX.read(text, { type: "string", raw: false, FS: ext === "tsv" ? "\t" : "," });
      return XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: null });
    }
    default:
      throw new ConversionError(`Cannot read ${ext.toUpperCase()} data.`);
  }
}

function serialise(value: Json, ext: string): string {
  switch (ext) {
    case "json":
      return JSON.stringify(value, null, 2);
    case "ndjson": {
      const rows = Array.isArray(value) ? value : [value];
      return rows.map((r) => JSON.stringify(r)).join("\n");
    }
    case "yaml":
      return YAML.dump(value, { noRefs: true, lineWidth: 100 });
    case "xml":
      return jsonToXml(value);
    case "csv":
    case "tsv": {
      const rows = toRows(value);
      const sheet = XLSX.utils.json_to_sheet(rows);
      return ext === "tsv"
        ? XLSX.utils.sheet_to_csv(sheet, { FS: "\t" })
        : XLSX.utils.sheet_to_csv(sheet);
    }
    default:
      throw new ConversionError(`Cannot write ${ext.toUpperCase()} data.`);
  }
}

/**
 * Tabular targets need an array of flat objects. Nested structures are
 * flattened with dotted keys rather than dropped or stringified as [object].
 */
function toRows(value: Json): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.map((v) =>
      v !== null && typeof v === "object" ? flatten(v as Record<string, unknown>) : { value: v },
    );
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // A wrapper object holding exactly one array is the common API shape.
    const arrays = Object.values(obj).filter(Array.isArray);
    if (arrays.length === 1) return toRows(arrays[0]);
    return [flatten(obj)];
  }
  return [{ value }];
}

function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      Object.assign(out, flatten(val as Record<string, unknown>, path));
    } else if (Array.isArray(val)) {
      out[path] = val.map((v) => (typeof v === "object" ? JSON.stringify(v) : v)).join("; ");
    } else {
      out[path] = val;
    }
  }
  return out;
}

function xmlToJson(text: string): Json {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const error = doc.querySelector("parsererror");
  if (error) throw new ConversionError("That XML is not well-formed.");

  const walk = (el: Element): Json => {
    const children = Array.from(el.children);
    const attrs: Record<string, unknown> = {};
    for (const a of Array.from(el.attributes)) attrs[`@${a.name}`] = a.value;

    if (!children.length) {
      const text = el.textContent?.trim() ?? "";
      return Object.keys(attrs).length ? { ...attrs, "#text": text } : text;
    }

    const out: Record<string, unknown> = { ...attrs };
    for (const child of children) {
      const value = walk(child);
      const existing = out[child.tagName];
      // Repeated tags become an array, which is what callers expect.
      if (existing === undefined) out[child.tagName] = value;
      else if (Array.isArray(existing)) existing.push(value);
      else out[child.tagName] = [existing, value];
    }
    return out;
  };

  return doc.documentElement ? { [doc.documentElement.tagName]: walk(doc.documentElement) } : {};
}

const XML_SAFE = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** XML element names cannot start with a digit or contain most punctuation. */
const tagName = (key: string) => {
  const cleaned = key.replace(/[^A-Za-z0-9_.-]/g, "_");
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `_${cleaned}`;
};

function jsonToXml(value: Json): string {
  const build = (val: Json, name: string, depth: number): string => {
    const pad = "  ".repeat(depth);
    const tag = tagName(name);

    if (Array.isArray(val)) {
      return val.map((v) => build(v, name, depth)).join("\n");
    }
    if (val !== null && typeof val === "object") {
      const inner = Object.entries(val as Record<string, unknown>)
        .map(([k, v]) => build(v, k, depth + 1))
        .join("\n");
      return `${pad}<${tag}>\n${inner}\n${pad}</${tag}>`;
    }
    return `${pad}<${tag}>${XML_SAFE(String(val ?? ""))}</${tag}>`;
  };

  const body = Array.isArray(value)
    ? value.map((v) => build(v, "item", 1)).join("\n")
    : Object.entries((value ?? {}) as Record<string, unknown>)
        .map(([k, v]) => build(v, k, 1))
        .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<root>\n${body}\n</root>\n`;
}

const MIME: Record<string, string> = {
  json: "application/json", ndjson: "application/x-ndjson",
  yaml: "application/yaml", xml: "application/xml",
  csv: "text/csv", tsv: "text/tab-separated-values",
};

export async function convertData(req: ConvertRequest): Promise<ConvertResult> {
  const { file, from, to, onProgress } = req;

  onProgress?.(0.2, `Parsing ${from.toUpperCase()}`);
  let parsed: Json;
  try {
    parsed = parse(await file.text(), from);
  } catch (err) {
    if (err instanceof ConversionError) throw err;
    throw new ConversionError(
      `That file isn't valid ${from.toUpperCase()}.`,
      (err as Error)?.message?.slice(0, 160),
    );
  }

  onProgress?.(0.7, `Writing ${to.toUpperCase()}`);
  const text = serialise(parsed, to);

  onProgress?.(1, "Done");
  return {
    blob: new Blob([text], { type: `${MIME[to] ?? "text/plain"};charset=utf-8` }),
    filename: brandedFilename(file.name, to),
  };
}
