// Copies runtime worker and wasm assets into public/ so the exported site is
// fully self-hosted. Nothing on the critical path comes from a third-party CDN:
// it is faster (same origin, our own cache headers), it cannot break when
// someone else's CDN does, and no request about the user's activity leaves for
// a domain we don't control.
//
// These files are gitignored and regenerated from node_modules on every build.
import { copyFileSync, mkdirSync, statSync } from "node:fs";
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

const copies = [
  {
    from: join(resolvePkg("pdfjs-dist"), "build/pdf.worker.min.mjs"),
    to: "public/vendor/pdf.worker.min.mjs",
  },
  // The ESM core, not the UMD one: @ffmpeg/ffmpeg spawns a *module* worker, so
  // importScripts() throws there and it falls back to `(await import(url)).default`.
  // The UMD build has no default export, which fails with "failed to import
  // ffmpeg-core.js" at runtime.
  {
    from: join(resolvePkg("@ffmpeg/core"), "dist/esm/ffmpeg-core.js"),
    to: "public/vendor/ffmpeg/ffmpeg-core.js",
  },
  {
    from: join(resolvePkg("@ffmpeg/core"), "dist/esm/ffmpeg-core.wasm"),
    to: "public/vendor/ffmpeg/ffmpeg-core.wasm",
  },
];

for (const { from, to } of copies) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  const mb = statSync(to).size / 1024 / 1024;
  console.log(`  ${to.padEnd(44)} ${mb.toFixed(1)} MB`);
}
