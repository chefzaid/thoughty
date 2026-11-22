/**
 * Registers the service worker that keeps the app shell for offline use (`/sw.js`), once the page has
 * loaded so it never slows the first visit. Only a production build has one: the dev server registers
 * nothing, so it never stands between the code being written and the page. The browser looks for a new
 * worker on each visit, bypassing its HTTP cache (`updateViaCache: 'none'`).
 */
export function registerServiceWorker(isProduction: boolean = import.meta.env.PROD): void {
  const container = globalThis.navigator?.serviceWorker;
  if (!isProduction || !container) return;
  globalThis.addEventListener('load', () => {
    container.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch((error: unknown) => {
      // Without it the app works as before, online only
      console.error('Service worker registration failed:', error);
    });
  }, { once: true });
}
