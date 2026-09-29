import { brandedFilename } from "../naming";
import { ConvertRequest, ConvertResult, ConversionError, DEFAULTS } from "./types";

/**
 * Audio and video run on a WebAssembly build of FFmpeg, in the user's own tab.
 *
 * We deliberately use the SINGLE-THREADED core. The multi-threaded build needs
 * SharedArrayBuffer, which needs COOP/COEP cross-origin isolation, which breaks
 * every third-party ad and analytics script on the page. Single-threaded is
 * slower but keeps the business model intact and works in every browser.
 */
// Served from our own origin (see scripts/copy-assets.mjs) rather than a public
// CDN: one less third party in the request path, and it cannot break when
// someone else's CDN does.
const CORE_BASE = "/vendor/ffmpeg";

type FFmpegInstance = import("@ffmpeg/ffmpeg").FFmpeg;
let instance: FFmpegInstance | null = null;
let loading: Promise<FFmpegInstance> | null = null;

export function isFfmpegLoaded(): boolean {
  return instance !== null;
}

async function getFfmpeg(onProgress?: (f: number, label?: string) => void): Promise<FFmpegInstance> {
  if (instance) return instance;
  if (loading) return loading;

  loading = (async () => {
    onProgress?.(0.02, "Loading converter (one-time, ~32MB)");
    const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
      import("@ffmpeg/ffmpeg"),
      import("@ffmpeg/util"),
    ]);

    const ff = new FFmpeg();
    try {
      // The core is handed over as a blob URL so ffmpeg.wasm can spawn its
      // worker from it regardless of how the site is deployed (subpath,
      // preview domain, custom CDN host).
      //
      // This must be the ESM core build: @ffmpeg/ffmpeg creates a *module*
      // worker, where importScripts() is unavailable, so it falls back to
      // `(await import(coreURL)).default`. The UMD build has no default export
      // and fails there.
      await ff.load({
        coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      });
    } catch {
      loading = null;
      throw new ConversionError(
        "The media converter could not be loaded.",
        "Check your connection and try again — it needs a one-time 32MB download.",
      );
    }
    instance = ff;
    return ff;
  })();

  return loading;
}

const AUDIO = new Set(["mp3", "wav", "ogg", "opus", "m4a", "aac", "flac"]);

/**
 * Encoder flags per target. Chosen for broad compatibility over raw speed:
 * yuv420p + faststart is what makes an MP4 play on iOS, Android and in Slack.
 */
function encoderArgs(to: string, quality: number): string[] {
  const crf = String(Math.round(34 - quality * 16));   // q 1.0 -> CRF 18, q 0.5 -> CRF 26
  const audioKbps = `${Math.round(96 + quality * 128)}k`;

  switch (to) {
    // ---- audio ----
    case "mp3":  return ["-vn", "-c:a", "libmp3lame", "-b:a", audioKbps];
    case "wav":  return ["-vn", "-c:a", "pcm_s16le"];
    case "ogg":  return ["-vn", "-c:a", "libvorbis", "-b:a", audioKbps];
    case "opus": return ["-vn", "-c:a", "libopus", "-b:a", audioKbps];
    case "m4a":
    case "aac":  return ["-vn", "-c:a", "aac", "-b:a", audioKbps];
    case "flac": return ["-vn", "-c:a", "flac"];

    // ---- video ----
    case "mp4":
      return ["-c:v", "libx264", "-preset", "veryfast", "-crf", crf,
              "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart"];
    case "webm":
      return ["-c:v", "libvpx", "-crf", crf, "-b:v", "1M", "-c:a", "libvorbis"];
    case "mkv":
    case "mov":
    case "avi":
      return ["-c:v", "libx264", "-preset", "veryfast", "-crf", crf,
              "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k"];

    // GIF needs a generated palette or it dithers to mud.
    case "gif":
      return ["-vf", "fps=12,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse",
              "-loop", "0"];
    default:
      throw new ConversionError(`Cannot write ${to.toUpperCase()} media.`);
  }
}

const MIME: Record<string, string> = {
  mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", opus: "audio/opus",
  m4a: "audio/mp4", aac: "audio/aac", flac: "audio/flac",
  mp4: "video/mp4", webm: "video/webm", mkv: "video/x-matroska",
  mov: "video/quicktime", avi: "video/x-msvideo", gif: "image/gif",
};

export async function convertMedia(req: ConvertRequest): Promise<ConvertResult> {
  const { file, from, to, options, onProgress } = req;
  const quality = options.quality ?? DEFAULTS.quality;

  const ff = await getFfmpeg(onProgress);
  const { fetchFile } = await import("@ffmpeg/util");

  // FFmpeg's virtual filesystem needs real extensions to pick a demuxer.
  const input = `in.${from}`;
  const output = `out.${to}`;

  const handleProgress = ({ progress }: { progress: number }) => {
    // Reserve the first 10% for load, the last 5% for readback.
    if (progress > 0 && progress <= 1) {
      onProgress?.(0.1 + progress * 0.85, AUDIO.has(to) ? "Encoding audio" : "Encoding video");
    }
  };
  ff.on("progress", handleProgress);

  try {
    onProgress?.(0.08, "Reading file");
    await ff.writeFile(input, await fetchFile(file));

    await ff.exec(["-i", input, ...encoderArgs(to, quality), "-y", output]);

    const data = await ff.readFile(output);
    if (!data || (data as Uint8Array).length === 0) {
      throw new ConversionError(
        `FFmpeg produced an empty ${to.toUpperCase()} file.`,
        "The source may use a codec this build doesn't support.",
      );
    }

    onProgress?.(1, "Done");
    return {
      blob: new Blob([data as BlobPart], { type: MIME[to] ?? "application/octet-stream" }),
      filename: brandedFilename(file.name, to),
    };
  } catch (err) {
    if (err instanceof ConversionError) throw err;
    throw new ConversionError(
      `Could not convert this ${from.toUpperCase()} file.`,
      "It may be corrupt, DRM-protected, or use an unsupported codec.",
    );
  } finally {
    ff.off("progress", handleProgress);
    // Always reclaim the virtual filesystem; a stale 500MB video would
    // otherwise sit in wasm memory until the tab closes.
    await ff.deleteFile(input).catch(() => {});
    await ff.deleteFile(output).catch(() => {});
  }
}
