import { describe, expect, it } from 'vitest';
import { selectPrecachePaths } from './precacheManifest';

describe('selectPrecachePaths', () => {
  it('keeps the scripts, styles, fonts, icons and manifest the app opens with, sorted, leaving PDF.js and speech recognition out', () => {
    expect(selectPrecachePaths([
      'index.html',
      'sw.js',
      'site.webmanifest',
      'favicon.svg',
      'icon-192.png',
      'flags/fr.svg',
      'licenses/atkinson-hyperlegible-OFL.txt',
      'assets/index-CdSWfVJR.js',
      'assets/index-oFfei0Ng.css',
      'assets/index-CdSWfVJR.js.map',
      'assets/codicon-DjkITdqj.ttf',
      'assets/atkinson-hyperlegible-latin-400-normal-BrHNak5F.woff2',
      'assets/atkinson-hyperlegible-latin-400-normal-BbWidj28.woff',
      'assets/pdf-DgMHKLtX.js',
      'assets/pdf.worker.min-92oBEpcp.js',
      'assets/pdfViewer-Ab12.js',
      'assets/speechWorker-BPxKlecx.js',
      'assets/transformers.web-Di67_usp.js',
      'assets/ort-wasm-simd-threaded.asyncify-CxOG5pUO.wasm',
    ])).toEqual([
      '/assets/atkinson-hyperlegible-latin-400-normal-BrHNak5F.woff2',
      '/assets/codicon-DjkITdqj.ttf',
      '/assets/index-CdSWfVJR.js',
      '/assets/index-oFfei0Ng.css',
      '/assets/pdfViewer-Ab12.js',
      '/favicon.svg',
      '/flags/fr.svg',
      '/icon-192.png',
      '/site.webmanifest',
    ]);
  });

  it('reads Windows paths as web paths', () => {
    expect(selectPrecachePaths(['assets\\index-A1.js', 'flags\\gb.svg'])).toEqual(['/assets/index-A1.js', '/flags/gb.svg']);
  });
});
