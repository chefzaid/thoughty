import { expect, test, type Page, type Route } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { mockComposerDraft } from '../support/mockApp.routes.composer-draft';

const composer = (page: Page) => page.getByPlaceholder("What's on your mind?");
const draftStatus = (page: Page) => page.getByTestId('composer-draft-status');
const offlineNotice = (page: Page) => page.getByTestId('offline-notice');
const signIn = (page: Page) => page.getByRole('button', { name: 'Sign In' });

/**
 * The API's refresh limit reached, as its throttler answers: `429 RATE_LIMITED` with the seconds to wait.
 * The cookie still works: once the wait is over, refreshes go through again.
 */
async function throttleRefreshes(page: Page, retryAfterSeconds: number) {
  const refreshes: number[] = [];
  let throttled = true;
  await page.route('**/api/auth/refresh', async (route: Route) => {
    refreshes.push(Date.now());
    if (!throttled) return route.fallback();
    return route.fulfill({
      status: 429,
      headers: { 'Retry-After': String(retryAfterSeconds) },
      json: { statusCode: 429, message: 'ThrottlerException: Too Many Requests', error: 'Too Many Requests', code: 'RATE_LIMITED' },
    });
  });
  return { refreshes, lift: () => { throttled = false; } };
}

/** Long enough for two reloads to happen within it. */
const WAIT_SECONDS = 8;

test.describe('A refresh the API asks to wait for', () => {
  test('keeps the writer signed in through reloads, sends no refresh while waiting, and comes back after', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [{ id: 1, date: '2026-03-04', index: 1, content: 'Written before the rush', tags: [], visibility: 'private' }],
    });
    await page.goto('/journal');
    await expect(page.getByText('Written before the rush')).toBeVisible();

    const { refreshes, lift } = await throttleRefreshes(page, WAIT_SECONDS);
    await page.reload();
    await expect(offlineNotice(page)).toBeVisible();
    await expect(composer(page)).toBeVisible();
    await expect(signIn(page)).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('thoughty.offlineUser'))).not.toBeNull();

    // Writers reloading during the wait send no refresh: the wait is shared by the browser's tabs
    await page.reload();
    await expect(offlineNotice(page)).toBeVisible();
    await expect(signIn(page)).toHaveCount(0);

    lift();
    await expect(offlineNotice(page)).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText('Written before the rush')).toBeVisible();
    // One refresh asked to wait; the next went once the wait was over, on its own
    expect(refreshes).toHaveLength(2);
    expect(refreshes[1] - refreshes[0]).toBeGreaterThanOrEqual(WAIT_SECONDS * 1000);
  });

  test('keeps the writer at work when their token expires during the wait', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/journal');
    await expect(composer(page)).toBeVisible();

    // The access token has expired: the draft save answers 401, and the refresh it asks for 429
    let expired = true;
    await page.route('**/api/composer-draft', (route) => (expired
      ? route.fulfill({ status: 401, json: { statusCode: 401, message: 'Unauthorized', error: 'Unauthorized', code: 'UNAUTHORIZED' } })
      : route.fallback()));
    const { refreshes, lift } = await throttleRefreshes(page, 2);

    await composer(page).fill('Written while Thoughty was busy');
    await expect(offlineNotice(page)).toBeVisible();
    await expect(draftStatus(page)).toHaveText('Saved on this device; it syncs when it can');
    await expect(signIn(page)).toHaveCount(0);
    await expect(composer(page)).toHaveValue('Written while Thoughty was busy');
    expect(refreshes).toHaveLength(1);

    expired = false;
    lift();
    await expect(offlineNotice(page)).toHaveCount(0, { timeout: 20_000 });
    await composer(page).fill('Written while Thoughty was busy, and after');
    await expect(draftStatus(page)).toHaveText('Draft saved');
    expect(mockComposerDraft(state)).toMatchObject({ text: 'Written while Thoughty was busy, and after' });
    expect(refreshes).toHaveLength(2);
  });
});
