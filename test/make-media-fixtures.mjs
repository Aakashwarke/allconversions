/**
 * Generates real MP3/MP4 fixtures using ffmpeg.wasm's own lavfi generators,
 * driven inside a browser. The container's system ffmpeg is a stripped
 * Playwright build with no filter support, and checking binary media into the
 * repo would bloat it, so the fixtures are produced on demand instead.
 */
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join } from "node:path";
import { chromium } from "playwright";

const PORT = 4174;
export const MEDIA_DIR = join(process.env.TMPDIR ?? "/tmp", "allconversions-media");

const PAGE = `<!doctype html><meta charset="utf-8"><title>fixtures</title><body>ready</body>`;

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".wasm": "application/wasm", ".json": "application/json",
};

function serve() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
      if (path === "/") {
        res.writeHead(200, { "content-type": "text/html" });
        return res.end(PAGE);
      }
      // Serve the built vendor assets and the raw npm packages the page imports.
      for (const root of ["public", "node_modules"]) {
        const file = join(root, path.replace(/^\/(vendor|pkg)\//, root === "public" ? "vendor/" : ""));
        if (existsSync(file) && !file.endsWith("/")) {
          res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
          return res.end(await readFile(file));
        }
      }
      res.writeHead(404); res.end("nf");
    });
    server.listen(PORT, () => resolve(server));
  });
}

export async function ensureMediaFixtures() {
  await mkdir(MEDIA_DIR, { recursive: true });
  const want = [join(MEDIA_DIR, "tone.mp3"), join(MEDIA_DIR, "clip.mp4")];
  if (want.every((f) => existsSync(f))) return MEDIA_DIR;

  const server = await serve();
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error("  [fixture page error]", String(e).slice(0, 200)));
  await page.goto(`http://localhost:${PORT}/`);

  const files = await page.evaluate(async () => {
    const { FFmpeg } = await import("/pkg/@ffmpeg/ffmpeg/dist/esm/index.js");
    const { toBlobURL } = await import("/pkg/@ffmpeg/util/dist/esm/index.js");
    const ff = new FFmpeg();
    await ff.load({
      coreURL: await toBlobURL("/vendor/ffmpeg/ffmpeg-core.js", "text/javascript"),
      wasmURL: await toBlobURL("/vendor/ffmpeg/ffmpeg-core.wasm", "application/wasm"),
    });

    await ff.exec(["-f", "lavfi", "-i", "sine=frequency=440:duration=2",
                   "-c:a", "libmp3lame", "-b:a", "96k", "-y", "tone.mp3"]);
    await ff.exec(["-f", "lavfi", "-i", "testsrc=size=160x120:rate=10:duration=2",
                   "-f", "lavfi", "-i", "sine=frequency=330:duration=2",
                   "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
                   "-c:a", "aac", "-shortest", "-y", "clip.mp4"]);

    const grab = async (name) => Array.from(await ff.readFile(name));
    return { "tone.mp3": await grab("tone.mp3"), "clip.mp4": await grab("clip.mp4") };
  });

  for (const [name, bytes] of Object.entries(files)) {
    await writeFile(join(MEDIA_DIR, name), Buffer.from(bytes));
    console.log(`  fixture ${name}: ${(bytes.length / 1024).toFixed(1)} KB`);
  }

  await browser.close();
  server.close();
  return MEDIA_DIR;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  ensureMediaFixtures().then(() => console.log("  media fixtures ready"));
}
