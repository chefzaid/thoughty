# ADR 0021: Preview Books Page by Page with a Pinned, Self-Hosted PDF.js

- Status: Accepted
- Date: 2026-10-27

## Context

Writers want to see their book page by page before downloading or printing it, with page numbers that match the PDF they will print, on desktop and on phones. The book is laid out on the server by PDFKit, which decides every page break; the browser has no way to reproduce that layout from the HTML or EPUB output. The web CSP allows scripts from `'self'` only, frames, media and images from `'self'`, `blob:` and `data:`, and connections to `'self'`.

Options considered:

- **The browser's own PDF viewer in a `blob:` frame.** No code to add, but the app cannot drive it: no reliable page count, page changes or chapter jumps from our controls, a different viewer in each browser, and Chrome on Android and some mobile browsers download the file instead of showing it.
- **HTML or EPUB paginated with CSS columns or print styles.** Pages and page numbers would not match the PDF, since the browser breaks lines and pages differently from PDFKit.
- **Rasterizing pages on the server.** Needs a native PDF renderer in the API image and makes every page a request.
- **PDF.js in the browser.** Draws the PDF the server generated, so pages and numbers are exactly those of the download, and lets the app own the controls.

## Decision

- Render the generated PDF in the app with **PDF.js** (`pdfjs-dist`, Apache-2.0), pinned to an exact version in `package.json` (no range) and updated deliberately.
- **Self-host it.** The library and its worker are bundled by Vite and served from the app's origin (`assets/`); the worker is a same-origin ES module script, so `script-src 'self'` covers it and no `blob:` worker or CDN is needed. Use the legacy build, which carries its own polyfills for older phones and browsers.
- **Fetch nothing at run time.** The document is opened from memory with `useWasm: false` and `useWorkerFetch: false`, so no WebAssembly, CMaps or standard font files are requested; fonts PDFKit does not embed (Helvetica) fall back to the system's sans-serif, which changes glyph shapes slightly but never the page breaks.
- **Load on demand.** PDF.js and its worker are imported only when a preview opens, so they add nothing to the app's first load.
- The reader draws one page at a time on a canvas, reads chapter pages from the PDF outline the server already writes, and gives screen readers each page's text.
- The client keeps the last generated PDF with the settings and cover it was made from, so previewing and downloading the same book generate it once (and spend AI tokens once).

## Consequences

- One more runtime dependency (about 490 kB minified for the library and 1.2 MB for the worker, both loaded only for the preview), with its security updates to follow; `npm audit` in CI covers it. Its optional `@napi-rs/canvas` dependency (for Node.js only) is installed with the other packages but never bundled.
- The preview always shows the PDF edition; EPUB, HTML and Markdown are generated when downloaded.
- No CSP change was needed. A future PDF.js feature that needs WebAssembly or fetched resources would have to be weighed against `script-src 'self'` and `connect-src 'self'` before it is turned on.
