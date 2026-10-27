import { test as base, expect, type BrowserContext } from '@playwright/test';
import { takeContractViolations } from './mockApp.contract';

export * from '@playwright/test';

/** Any `/api` call, on any origin: the app only talks to its own, and nothing else should get one. */
function isApiUrl(url: URL): boolean {
  return url.pathname === '/api' || url.pathname.startsWith('/api/');
}

/**
 * Stops every page of the context before it closes. Chromium releases a request still waiting on a
 * route handler to the network when the context closes, and the Vite dev server would proxy it to
 * the API on port 3001. Leaving the app for `about:blank` cancels those requests and stops it
 * sending new ones.
 */
async function leaveApp(context: BrowserContext) {
  await Promise.all(
    context.pages().map((page) => page.goto('about:blank', { waitUntil: 'commit' }).catch(() => undefined)),
  );
}

/**
 * Every spec imports `test` from here, so no `/api` request leaves the browser: the mock app's
 * routes answer them, this context route answers whatever reaches it (a spec that unroutes the mock,
 * a page opened without it) with 503, and teardown cancels the requests still in flight. Teardown
 * then fails the test if any mock answer broke the API's OpenAPI contract (`mockApp.contract.ts`).
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route(isApiUrl, (route) =>
      route.fulfill({
        status: 503,
        json: { message: `No e2e mock answers ${route.request().method()} ${new URL(route.request().url()).pathname}` },
      }),
    );
    takeContractViolations();
    await use(context);
    await leaveApp(context);
    // A mock answer the real API would never send hides bugs like reading `is_default` for `isDefault`
    expect([...new Set(takeContractViolations())], 'mock API answers that break the OpenAPI contract').toEqual([]);
  },
});
