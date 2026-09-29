// Copies runtime worker and wasm assets into public/ so the exported site is
// fully self-hosted. Nothing on the critical path comes from a third-party CDN:
// it is faster (same origin, our own cache headers), it cannot break when
// someone else's CDN does, and no request about the user's activity leaves for
// a domain we don't control.
//
// These files are gitignored and regenerated from node_modules on every build.
import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

// @ffmpeg/core restricts "exports" so its package.json cannot be resolved;
// fall back to the plain node_modules path for packages like it.
function resolvePkg(name) {
  try {
    return dirname(require.resolve(`${name}/package.json`));
  } catch {
    return join(process.cwd(), "node_modules", name);
  }
}

const files = [
  {
    from: join(resolvePkg("pdfjs-dist"), "build/pdf.worker.min.mjs"),
    to: "public/vendor/pdf.worker.min.mjs",
  },
  // The ESM core, not the UMD one: @ffmpeg/ffmpeg spawns a *module* worker, so
  // importScripts() throws there and it falls back to `(await import(url)).default`.
  // The UMD build has no default export, which fails at runtime with
  // "failed to import ffmpeg-core.js".
  {
    from: join(resolvePkg("@ffmpeg/core"), "dist/esm/ffmpeg-core.js"),
    to: "public/vendor/ffmpeg/ffmpeg-core.js",
  },
  {
    from: join(resolvePkg("@ffmpeg/core"), "dist/esm/ffmpeg-core.wasm"),
    to: "public/vendor/ffmpeg/ffmpeg-core.wasm",
  },
];

/**
 * @ffmpeg/ffmpeg and @ffmpeg/util ship as plain ESM with only relative imports,
 * and they are served as static files rather than bundled.
 *
 * They have to be. @ffmpeg/ffmpeg's worker loads the core with
 * `await import(coreURL)` where coreURL is a blob URL built at runtime.
 * Turbopack tries to resolve that expression at build time, cannot, and
 * replaces it with a stub that throws "Cannot find module as expression is too
 * dynamic" — so every audio and video conversion fails. Served as static
 * assets and imported at runtime, the browser resolves the blob URL natively
 * and the library works as its authors intended.
 */
const dirs = [
  { from: join(resolvePkg("@ffmpeg/ffmpeg"), "dist/esm"), to: "public/vendor/ffmpeg/lib" },
  { from: join(resolvePkg("@ffmpeg/util"), "dist/esm"), to: "public/vendor/ffmpeg/util" },
];

for (const { from, to } of dirs) {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    if (name.endsWith(".js")) files.push({ from: join(from, name), to: join(to, name) });
  }
}

for (const { from, to } of files) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}

const total = files.reduce((n, f) => n + statSync(f.to).size, 0);
console.log(`  copied ${files.length} vendor files (${(total / 1024 / 1024).toFixed(1)} MB) -> public/vendor/`);
