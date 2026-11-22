import { expect, test, type Page, type Route } from '../support/test';
import { setupMockApp } from '../support/mockApp';

const offlineNotice = (page: Page) => page.getByTestId('offline-notice');
const unreachablePage = (page: Page) => page.getByTestId('session-unreachable');

/**
 * `GET /api/auth/me` over its limit, as the API's throttler answers: `429 RATE_LIMITED` with the seconds to
 * wait. The refresh still works, and so does the token it gives: once the wait is over, `/me` answers again.
 */
async function throttleSessionReads(page: Page, retryAfterSeconds: number) {
  const reads: number[] = [];
  let throttled = true;
  await page.route('**/api/auth/me', async (route: Route) => {
    reads.push(Date.now());
    if (!throttled) return route.fallback();
    return route.fulfill({
      status: 429,
      headers: { 'Retry-After': String(retryAfterSeconds) },
      json: { statusCode: 429, message: 'ThrottlerException: Too Many Requests', error: 'Too Many Requests', code: 'RATE_LIMITED' },
    });
  });
  return { reads, lift: () => { throttled = false; } };
}

/** Records, from the page itself, whether a sign-in form was ever shown, however briefly. */
async function watchForSignIn(page: Page) {
  await page.addInitScript(() => {
    const seen = () => {
      if (document.querySelector('form.auth-form')) sessionStorage.setItem('e2e.sawSignIn', 'yes');
    };
    new MutationObserver(seen).observe(document, { childList: true, subtree: true });
  });
  return async () => page.evaluate(() => sessionStorage.getItem('e2e.sawSignIn'));
}

const WAIT_SECONDS = 3;

test.describe('A session `/me` cannot confirm yet', () => {
  test('keeps the writer remembered here in their journal through a 429, never asking them to sign in', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [{ id: 1, date: '2026-03-04', index: 1, content: 'Written before the rush', tags: [], visibility: 'private' }],
    });
    await page.goto('/journal');
    await expect(page.getByText('Written before the rush')).toBeVisible();
    const sawSignIn = await watchForSignIn(page);

    const { reads, lift } = await throttleSessionReads(page, WAIT_SECONDS);
    await page.reload();
    await expect(offlineNotice(page)).toBeVisible();
    await expect(page.getByPlaceholder("What's on your mind?")).toBeVisible();
    // The token the refresh gave works: the journal reads the writer's entries meanwhile
    await expect(page.getByText('Written before the rush')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('thoughty.offlineUser'))).not.toBeNull();

    lift();
    await expect(offlineNotice(page)).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText('Written before the rush')).toBeVisible();
    // One read asked to wait; the next went once the wait was over, on its own
    expect(reads).toHaveLength(2);
    expect(reads[1] - reads[0]).toBeGreaterThanOrEqual(WAIT_SECONDS * 1000);
    expect(await sawSignIn()).toBeNull();
  });

  test('says Thoughty cannot be reached to a writer no one remembers here, then opens their journal', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [{ id: 1, date: '2026-03-04', index: 1, content: 'Written on another device', tags: [], visibility: 'private' }],
    });
    await page.goto('/journal');
    await expect(page.getByText('Written on another device')).toBeVisible();
    const sawSignIn = await watchForSignIn(page);
    // An older version never remembered the writer, or the device's storage lost it
    await page.evaluate(() => localStorage.removeItem('thoughty.offlineUser'));

    const { lift } = await throttleSessionReads(page, WAIT_SECONDS);
    await page.reload();
    await expect(unreachablePage(page)).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Thoughty can’t be reached right now' })).toBeVisible();
    await expect(page).toHaveURL(/\/journal$/);

    lift();
    await expect(unreachablePage(page)).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText('Written on another device')).toBeVisible();
    expect(await sawSignIn()).toBeNull();
  });
});
