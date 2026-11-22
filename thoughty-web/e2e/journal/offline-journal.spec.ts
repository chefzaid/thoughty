import { expect, test, type Page, type Route } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { mockComposerDraft } from '../support/mockApp.routes.composer-draft';

const API = 'http://localhost:5173/api/**';
const composer = (page: Page) => page.getByPlaceholder("What's on your mind?");
const draftStatus = (page: Page) => page.getByTestId('composer-draft-status');
const offlineNotice = (page: Page) => page.getByTestId('offline-notice');

/**
 * Thoughty out of reach: every API request fails as it does without a connection. The page itself still
 * loads from the dev server, as the service worker serves it from its cache in a production build.
 */
const cutApi = (route: Route) => route.abort('internetdisconnected');
const loseConnection = (page: Page) => page.route(API, cutApi);
async function getConnectionBack(page: Page) {
  await page.unroute(API, cutApi);
  await page.evaluate(() => globalThis.dispatchEvent(new Event('online')));
}

test.describe('Journal opened offline', () => {
  test('opens for the writer last signed in, keeps the draft on the device, and sends it once back', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [{ id: 1, date: '2026-03-04', index: 1, content: 'Written before the trip', tags: [], visibility: 'private' }],
    });
    await page.goto('/journal');
    await expect(page.getByText('Written before the trip')).toBeVisible();
    await expect(offlineNotice(page)).toHaveCount(0);

    await loseConnection(page);
    await page.reload();
    await expect(offlineNotice(page)).toContainText('You’re offline');
    await composer(page).fill('Written on the plane');
    await expect(draftStatus(page)).toHaveText('Offline — saved on this device');
    expect(mockComposerDraft(state)).toBeNull();

    // Still offline after another reload: the draft comes back from the device
    await page.reload();
    await expect(composer(page)).toHaveValue('Written on the plane');
    await expect(offlineNotice(page)).toBeVisible();

    await getConnectionBack(page);
    await expect(offlineNotice(page)).toHaveCount(0);
    await expect(draftStatus(page)).toHaveText('Draft saved');
    expect(mockComposerDraft(state)).toMatchObject({ text: 'Written on the plane' });
    // What could not be read offline is read again
    await expect(page.getByText('Written before the trip')).toBeVisible();
  });

  test('keeps the writer’s language and theme, and says so in French', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr', theme: 'light' } });
    await page.goto('/journal');
    await expect(page.getByPlaceholder("Qu'avez-vous à l'esprit ?")).toBeVisible();

    await loseConnection(page);
    await page.reload();

    await expect(offlineNotice(page)).toContainText('Vous êtes hors ligne');
    await expect(page.getByPlaceholder("Qu'avez-vous à l'esprit ?")).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/light-mode/);
  });

  test('ends there when the server refuses the session on the way back', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/journal');
    await expect(composer(page)).toBeVisible();

    await loseConnection(page);
    await page.reload();
    await expect(offlineNotice(page)).toBeVisible();

    // Signed out everywhere meanwhile: the refresh cookie no longer works
    state.authenticated = false;
    await getConnectionBack(page);

    await expect(page.getByRole('button', { name: 'Sign In' }).first()).toBeVisible();
    await expect(composer(page)).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('thoughty.offlineUser'))).toBeNull();
  });

  test('a sign-out chosen offline reaches the server on the next load', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/journal');
    await expect(composer(page)).toBeVisible();

    await loseConnection(page);
    await page.reload();
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByRole('button', { name: 'Sign In' }).first()).toBeVisible();
    expect(state.authenticated).toBe(true);

    await page.unroute(API, cutApi);
    await page.goto('/journal');

    await expect(page.getByRole('button', { name: 'Sign In' }).first()).toBeVisible();
    await expect.poll(() => state.authenticated).toBe(false);
    await expect(composer(page)).toHaveCount(0);
  });
});
