/**
 * The service worker's entry, bundled into `/sw.js` by `scripts/serviceWorkerPlugin.ts` once the app is
 * built, with that build's version and the files it keeps for offline use.
 */
import { startServiceWorker, type ServiceWorkerScopeLike } from './serviceWorkerCore';

declare const __THOUGHTY_SW_VERSION__: string;
declare const __THOUGHTY_SW_PRECACHE__: string[];

startServiceWorker(globalThis as unknown as ServiceWorkerScopeLike, {
  version: __THOUGHTY_SW_VERSION__,
  precache: __THOUGHTY_SW_PRECACHE__,
});
