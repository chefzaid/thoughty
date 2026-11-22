import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import type { BrowserContext, Page } from '@playwright/test';

const WORKER_ENTRY = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/serviceWorker/sw.ts');

let bundle: Promise<string> | null = null;

/**
 * The app's service worker (`src/serviceWorker/sw.ts`), bundled as `scripts/serviceWorkerPlugin.ts` bundles
 * it into a production build's `/sw.js`. The dev server the specs run on has no build files to keep, so it
 * keeps only `index.html`.
 */
function bundledWorker(): Promise<string> {
  bundle ??= build({
    entryPoints: [WORKER_ENTRY],
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2022',
    logLevel: 'warning',
    define: {
      __THOUGHTY_SW_VERSION__: JSON.stringify('e2e'),
      __THOUGHTY_SW_PRECACHE__: JSON.stringify([]),
    },
  }).then((result) => result.outputFiles[0].text);
  return bundle;
}

/**
 * Serves the app's service worker at `/sw.js`, which the dev server registers none of, then registers it
 * from the page already open and waits until it controls the page, as a production build's worker does
 * after the first visit.
 */
export async function installServiceWorker(page: Page, context: BrowserContext): Promise<void> {
  const script = await bundledWorker();
  await context.route('**/sw.js', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: script }));
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

/** Every request the worker's caches hold, as paths with their query. */
export function cachedRequests(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const paths: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const url = new URL(request.url);
        paths.push(`${url.pathname}${url.search}`);
      }
    }
    return paths;
  });
}
