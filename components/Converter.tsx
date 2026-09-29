"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BRAND } from "@/lib/brand";
import { bundleAndDownload, convertFile, downloadResult, formatBytes, ConversionError, ConvertOptions, ConvertResult, MAX_FILE_BYTES } from "@/lib/convert";
import { CATEGORY_LABEL, resolveFormat } from "@/lib/formats";
import { conversionFor, targetsFor } from "@/lib/matrix";
import { extOf } from "@/lib/naming";
import { IconAlert, IconCheck, IconDownload, IconTag, IconUpload, IconX } from "./Icons";

type Status = "queued" | "working" | "done" | "error";

interface Job {
  id: string;
  file: File;
  from: string;
  to: string;
  status: Status;
  progress: number;
  label: string;
  result?: ConvertResult;
  error?: string;
  hint?: string;
  /**
   * Set when the file was rejected before conversion was ever attempted — an
   * unrecognised extension, an oversized file, the wrong type for a locked
   * tool. Retrying these can only fail the same way, so no Retry is offered.
   */
  fatal?: boolean;
}

interface Props {
  /** Pins the converter to one pair, used on the per-conversion landing pages. */
  lockedFrom?: string;
  lockedTo?: string;
}

let seq = 0;

export function Converter({ lockedFrom, lockedTo }: Props) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dragging, setDragging] = useState(false);
  const [options, setOptions] = useState<ConvertOptions>({ quality: 0.9, dpi: 150, pageSize: "fit" });
  const inputRef = useRef<HTMLInputElement>(null);

  const update = useCallback((id: string, patch: Partial<Job>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const next: Job[] = [];
    for (const file of Array.from(files)) {
      const detected = resolveFormat(extOf(file.name));
      const from = lockedFrom ?? detected?.id ?? "";

      // Pick a sensible default target: the locked one, else the most popular
      // destination available for this source type.
      const available = from ? targetsFor(from) : [];
      const to = lockedTo ?? available[0]?.id ?? "";

      const job: Job = {
        id: `j${++seq}`,
        file, from, to,
        status: "queued", progress: 0, label: "",
      };

      const reject = (error: string, hint?: string) => {
        job.status = "error";
        job.error = error;
        job.hint = hint;
        job.fatal = true;
      };

      if (!from) {
        reject(`We don't recognise .${extOf(file.name) || "?"} files yet.`);
      } else if (file.size > MAX_FILE_BYTES) {
        reject(`${formatBytes(file.size)} is over the 2GB limit.`);
      } else if (lockedFrom && detected && detected.id !== lockedFrom) {
        reject(
          `This tool expects a ${lockedFrom.toUpperCase()} file, but that's a ${detected.id.toUpperCase()}.`,
          "Use the All tools page to pick the right converter.",
        );
      } else if (!to) {
        reject(`Nothing to convert ${from.toUpperCase()} into yet.`);
      }
      next.push(job);
    }
    setJobs((prev) => [...prev, ...next]);
  }, [lockedFrom, lockedTo]);

  const runJob = useCallback(async (job: Job) => {
    // A failed conversion stays retryable — only files rejected up front don't.
    if (job.fatal || !job.from || !job.to) return;
    update(job.id, {
      status: "working", progress: 0.01, label: "Starting",
      error: undefined, hint: undefined,
    });
    try {
      const result = await convertFile({
        file: job.file,
        from: job.from,
        to: job.to,
        options,
        onProgress: (p, label) =>
          update(job.id, { progress: Math.min(0.99, p), label: label ?? "" }),
      });
      update(job.id, { status: "done", progress: 1, label: "", result });
    } catch (err) {
      const ce = err instanceof ConversionError ? err : null;
      update(job.id, {
        status: "error",
        progress: 0,
        error: ce?.message ?? (err as Error)?.message ?? "Something went wrong.",
        hint: ce?.hint,
      });
    }
  }, [options, update]);

  const pending = jobs.filter((j) => j.status === "queued");
  const finished = jobs.filter((j) => j.status === "done");
  const busy = jobs.some((j) => j.status === "working");

  const convertAll = useCallback(async () => {
    // Sequential, not parallel: each engine can hold hundreds of megabytes of
    // decoded pixels, and racing them is how a tab runs out of memory.
    for (const job of jobs.filter((j) => j.status === "queued")) {
      await runJob(job);
    }
  }, [jobs, runJob]);

  const downloadAll = useCallback(async () => {
    const ready = jobs.filter((j) => j.status === "done" && j.result);
    if (ready.length === 1) return downloadResult(ready[0].result!);

    await bundleAndDownload(
      ready.map((j) => j.result!),
      `${BRAND.filePrefix}${BRAND.fileSeparator}converted-files.zip`,
    );
  }, [jobs]);

  // Let people drop a file anywhere on the page, not just on the box.
  useEffect(() => {
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) { e.preventDefault(); setDragging(true); }
    };
    const leave = (e: DragEvent) => { if (!e.relatedTarget) setDragging(false); };
    const drop = (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [addFiles]);

  const accept = useMemo(() => {
    if (!lockedFrom) return undefined;
    const f = resolveFormat(lockedFrom);
    return f ? `.${f.id},${f.mime}` : undefined;
  }, [lockedFrom]);

  const showQuality = jobs.some((j) => ["jpg", "webp", "avif", "mp3", "mp4", "webm", "ogg", "opus", "m4a", "aac", "mkv", "mov", "avi"].includes(j.to));
  const showDpi = jobs.some((j) => j.from === "pdf" && ["jpg", "png", "webp"].includes(j.to));
  const showPageSize = jobs.some((j) => j.to === "pdf");

  return (
    <div className="w-full">
      {/* Drop zone --------------------------------------------------- */}
      <div
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
        role="button"
        tabIndex={0}
        aria-label="Choose files to convert"
        className={`focus-ring group relative cursor-pointer rounded-[var(--radius-card)] border-2 border-dashed p-10 text-center transition-all duration-200 sm:p-14 ${
          dragging
            ? "scale-[1.01] border-[var(--color-brand-500)] bg-[color-mix(in_srgb,var(--color-brand-500)_8%,var(--surface))]"
            : "border-hair surface-sunken hover:border-[var(--color-brand-400)]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="sr-only"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
        />
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-brand-500)]/10 text-[var(--color-brand-500)] transition-transform duration-200 group-hover:scale-105">
          <IconUpload className="h-7 w-7" />
        </div>
        <p className="mt-5 text-lg font-semibold tracking-tight">
          {dragging ? "Drop it anywhere" : "Drop files here, or click to browse"}
        </p>
        <p className="mt-1.5 text-sm text-muted">
          {lockedFrom && lockedTo
            ? `${lockedFrom.toUpperCase()} files up to 2GB — converted on this device`
            : "Any format below, up to 2GB each — converted on this device"}
        </p>
      </div>

      {/* Options ----------------------------------------------------- */}
      {(showQuality || showDpi || showPageSize) && (
        <div className="rise mt-4 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl border border-hair surface-raised px-5 py-4">
          {showQuality && (
            <label className="flex items-center gap-3 text-sm">
              <span className="font-medium">Quality</span>
              <input
                type="range" min={0.3} max={1} step={0.05}
                value={options.quality}
                onChange={(e) => setOptions((o) => ({ ...o, quality: Number(e.target.value) }))}
                className="h-1.5 w-32 cursor-pointer accent-[var(--color-brand-500)]"
              />
              <span className="w-9 tabular-nums text-muted">{Math.round((options.quality ?? 0.9) * 100)}%</span>
            </label>
          )}
          {showDpi && (
            <label className="flex items-center gap-3 text-sm">
              <span className="font-medium">Resolution</span>
              <select
                value={options.dpi}
                onChange={(e) => setOptions((o) => ({ ...o, dpi: Number(e.target.value) }))}
                className="focus-ring rounded-lg border border-hair surface px-2.5 py-1.5 text-sm"
              >
                <option value={72}>72 DPI — screen</option>
                <option value={150}>150 DPI — standard</option>
                <option value={300}>300 DPI — print</option>
              </select>
            </label>
          )}
          {showPageSize && (
            <label className="flex items-center gap-3 text-sm">
              <span className="font-medium">Page size</span>
              <select
                value={options.pageSize}
                onChange={(e) => setOptions((o) => ({ ...o, pageSize: e.target.value as ConvertOptions["pageSize"] }))}
                className="focus-ring rounded-lg border border-hair surface px-2.5 py-1.5 text-sm"
              >
                <option value="fit">Fit to content</option>
                <option value="a4">A4</option>
                <option value="letter">US Letter</option>
              </select>
            </label>
          )}
        </div>
      )}

      {/* Job list ---------------------------------------------------- */}
      {jobs.length > 0 && (
        <ul className="mt-4 space-y-3">
          {jobs.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              locked={Boolean(lockedTo)}
              onRetarget={(to) => update(job.id, { to, status: "queued", result: undefined, error: undefined })}
              onRemove={() => setJobs((p) => p.filter((j) => j.id !== job.id))}
              onRun={() => runJob(job)}
            />
          ))}
        </ul>
      )}

      {/* Actions ----------------------------------------------------- */}
      {jobs.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {pending.length > 0 && (
            <button
              onClick={convertAll}
              disabled={busy}
              className="focus-ring rounded-xl bg-[var(--color-brand-500)] px-6 py-3 text-sm font-semibold text-white shadow-[var(--shadow-lift)] transition-all hover:bg-[var(--color-brand-600)] disabled:opacity-50"
            >
              {busy ? "Converting…" : `Convert ${pending.length} file${pending.length > 1 ? "s" : ""}`}
            </button>
          )}
          {finished.length > 0 && (
            <button
              onClick={downloadAll}
              className="focus-ring inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent-500)] px-6 py-3 text-sm font-semibold text-white shadow-[var(--shadow-lift)] transition-all hover:brightness-95"
            >
              <IconDownload className="h-4 w-4" />
              {finished.length === 1 ? "Download" : `Download all (${finished.length})`}
            </button>
          )}
          <button
            onClick={() => setJobs([])}
            className="focus-ring rounded-xl px-4 py-3 text-sm font-medium text-muted transition-colors hover:text-[var(--text)]"
          >
            Clear
          </button>
        </div>
      )}

      {/* The filename promise, stated where it matters. */}
      {finished.length > 0 && (
        <p className="rise mt-4 inline-flex items-center gap-2 rounded-xl border border-hair surface-sunken px-4 py-2.5 text-sm text-muted">
          <IconTag className="h-4 w-4 shrink-0 text-[var(--color-brand-500)]" />
          Every file is saved with the{" "}
          <code className="rounded surface px-1.5 py-0.5 font-medium text-[var(--text)]">
            {BRAND.filePrefix}{BRAND.fileSeparator}
          </code>{" "}
          prefix.
        </p>
      )}
    </div>
  );
}

function JobRow({ job, locked, onRetarget, onRemove, onRun }: {
  job: Job;
  locked: boolean;
  onRetarget: (to: string) => void;
  onRemove: () => void;
  onRun: () => void;
}) {
  const targets = useMemo(() => (job.from ? targetsFor(job.from) : []), [job.from]);
  const grouped = useMemo(() => {
    const map = new Map<string, typeof targets>();
    for (const t of targets) {
      if (!map.has(t.category)) map.set(t.category, []);
      map.get(t.category)!.push(t);
    }
    return [...map.entries()];
  }, [targets]);

  const heavy = job.from && job.to ? conversionFor(job.from, job.to)?.heavy : false;

  return (
    <li className="rise rounded-2xl border border-hair surface-raised p-4 shadow-[var(--shadow-lift)]">
      <div className="flex items-start gap-3">
        <StatusDot status={job.status} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={job.file.name}>{job.file.name}</p>
          <p className="mt-0.5 text-xs text-muted">
            {formatBytes(job.file.size)}
            {job.from && ` · ${job.from.toUpperCase()}`}
            {job.status === "done" && job.result?.bundled ? ` · ${job.result.bundled} pages zipped` : ""}
          </p>

          {job.status === "working" && (
            <div className="mt-3">
              <div className="h-1.5 overflow-hidden rounded-full surface-sunken">
                <div
                  className="h-full rounded-full bg-[var(--color-brand-500)] transition-[width] duration-300 ease-out"
                  style={{ width: `${Math.round(job.progress * 100)}%` }}
                />
              </div>
              {job.label && <p className="mt-1.5 text-xs text-muted">{job.label}</p>}
            </div>
          )}

          {job.status === "error" && (
            <div className="mt-2 flex items-start gap-2 text-xs">
              <IconAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
              <div>
                <p className="font-medium text-red-600 dark:text-red-400">{job.error}</p>
                {job.hint && <p className="mt-0.5 text-muted">{job.hint}</p>}
              </div>
            </div>
          )}

          {job.status === "done" && job.result && (
            <p className="mt-2 truncate text-xs">
              <span className="text-muted">Saved as </span>
              <span className="font-medium text-[var(--color-accent-500)]">{job.result.filename}</span>
              <span className="text-muted"> · {formatBytes(job.result.blob.size)}</span>
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!locked && job.from && !job.fatal && job.status !== "working" && (
            <select
              value={job.to}
              onChange={(e) => onRetarget(e.target.value)}
              aria-label="Convert to"
              className="focus-ring rounded-lg border border-hair surface px-2.5 py-1.5 text-xs font-medium"
            >
              {grouped.map(([category, list]) => (
                <optgroup key={category} label={CATEGORY_LABEL[category as keyof typeof CATEGORY_LABEL]}>
                  {list.map((t) => <option key={t.id} value={t.id}>{t.id.toUpperCase()}</option>)}
                </optgroup>
              ))}
            </select>
          )}

          {job.status === "queued" && (
            <button onClick={onRun}
                    className="focus-ring rounded-lg bg-[var(--color-brand-500)] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-brand-600)]">
              Convert
            </button>
          )}
          {job.status === "error" && !job.fatal && (
            <button onClick={onRun}
                    className="focus-ring rounded-lg border border-hair px-3.5 py-1.5 text-xs font-semibold transition-colors hover:surface-sunken">
              Retry
            </button>
          )}
          {job.status === "done" && job.result && (
            <button onClick={() => downloadResult(job.result!)}
                    className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent-500)] px-3.5 py-1.5 text-xs font-semibold text-white transition-all hover:brightness-95">
              <IconDownload className="h-3.5 w-3.5" />
              Save
            </button>
          )}
          <button onClick={onRemove} aria-label={`Remove ${job.file.name}`}
                  className="focus-ring rounded-lg p-1.5 text-muted transition-colors hover:text-[var(--text)]">
            <IconX className="h-4 w-4" />
          </button>
        </div>
      </div>

      {heavy && job.status === "queued" && (
        <p className="mt-2.5 border-t border-hair pt-2.5 text-xs text-muted">
          Audio and video use a one-time 32MB engine download. After that it stays cached.
        </p>
      )}
    </li>
  );
}

function StatusDot({ status }: { status: Status }) {
  if (status === "done") {
    return (
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-500)]/15 text-[var(--color-accent-500)]">
        <IconCheck className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-500">
        <IconAlert className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (status === "working") {
    return (
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--color-brand-500)] border-t-transparent" />
      </span>
    );
  }
  return <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--color-ink-300)]" />;
}
