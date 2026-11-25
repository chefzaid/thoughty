/**
 * Which of a build's files the service worker keeps for offline use, chosen when the app is built
 * (`scripts/serviceWorkerPlugin.ts`): the scripts, styles, fonts, icons and manifest the app needs to open
 * and to write without a connection. Left out: `index.html` (the worker keeps it under its own key), the
 * worker itself, source maps, the licence texts, the `.woff` fonts every browser that runs a service worker
 * skips for `.woff2`, PDF.js (about 1.7 MB, only the book preview reads it, which needs the API anyway), and the
 * speech-recognition worker with transformers.js (about 0.6 MB, and its WebAssembly, which no `.wasm` is kept for:
 * only a diary on the writer's own model loads them, to transcribe a recording it reads from the API).
 */
const KEPT_EXTENSIONS = new Set(['js', 'css', 'woff2', 'ttf', 'svg', 'png', 'ico', 'webmanifest']);
const LEFT_OUT = [
  /^index\.html$/,
  /^sw\.js$/,
  /^licenses\//,
  /^assets\/pdf(?:\.worker)?(?:\.min)?-[\w-]+\.js$/,
  /^assets\/(?:speechWorker|transformers\.web)-[\w-]+\.js$/,
];

/** The build's files to keep, as same-origin paths, from the paths relative to the build folder. */
export function selectPrecachePaths(files: readonly string[]): string[] {
  return files
    .map((file) => file.replaceAll('\\', '/'))
    .filter((file) => KEPT_EXTENSIONS.has(file.slice(file.lastIndexOf('.') + 1)))
    .filter((file) => !LEFT_OUT.some((pattern) => pattern.test(file)))
    .sort()
    .map((file) => `/${file}`);
}
