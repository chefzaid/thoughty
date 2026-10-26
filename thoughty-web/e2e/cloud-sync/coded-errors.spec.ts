import { expect, test, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { fulfillApiError } from '../support/mockApp.route-utils';

const EXPIRED = 'La connexion à ce service cloud a expiré. Veuillez le reconnecter.';

/** Makes the API refuse one cloud request the way it does once a provider's refresh token stopped working. */
async function expireConnectionOn(page: Page, path: string) {
  await page.route(`http://localhost:5173${path}*`, (route) =>
    fulfillApiError(route, 400, 'CLOUD_CONNECTION_EXPIRED', 'google drive connection expired. Please reconnect.'));
}

test.describe('Cloud sync errors', () => {
  test('say why an upload, a schedule, a file list and a cloud import were refused, in French', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' } });
    await expireConnectionOn(page, '/api/cloud-sync/upload');
    await expireConnectionOn(page, '/api/cloud-sync/schedule');
    await page.goto('/import-export?diary=1&section=import');

    const card = page.locator('.cloud-sync-card', { hasText: 'Google Drive' });
    const message = page.locator('.import-export .message.error');
    await card.getByRole('button', { name: 'Exporter vers le cloud' }).click();
    await expect(message).toHaveText(EXPIRED);
    expect(state.lastCloudUploadPayload).toBeNull();

    await card.getByRole('button', { name: 'Activer la programmation' }).click();
    await expect(message).toHaveText(EXPIRED);
    expect(state.lastCloudSchedulePayload).toBeNull();

    const cloudImport = page.locator('.cloud-import-section');
    await expireConnectionOn(page, '/api/cloud-sync/files');
    await cloudImport.getByRole('button', { name: /Google Drive/i }).click();
    await expect(message).toHaveText(EXPIRED);
    await expect(page.getByText('thoughty-cloud.json')).toHaveCount(0);

    await page.unroute('http://localhost:5173/api/cloud-sync/files*');
    await expireConnectionOn(page, '/api/cloud-sync/download');
    await cloudImport.getByRole('button', { name: /Google Drive/i }).click();
    await cloudImport.getByRole('button', { name: /Google Drive/i }).click();
    await page.locator('.cloud-file-row', { hasText: 'thoughty-cloud.json' }).getByRole('button', { name: 'Importer' }).click();
    await expect(message).toHaveText(EXPIRED);
    await expect(page.getByText('Aperçu', { exact: true })).toHaveCount(0);
  });

  test('says why a connection was refused on the profile, in French', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' } });
    await page.route('http://localhost:5173/api/cloud-sync/connect', (route) =>
      fulfillApiError(route, 400, 'CLOUD_UNKNOWN_PROVIDER', 'Unknown provider: dropbox'));
    await page.goto('/profile');
    await expect(page.getByText('Dropbox')).toBeVisible();

    await page.evaluate(() => globalThis.postMessage({ type: 'cloud-oauth-callback', provider: 'dropbox', code: 'abc' }, '*'));

    await expect(page.getByText('Ce service cloud n’est pas pris en charge.')).toBeVisible();
    await expect(page.getByText('Échec de la connexion au fournisseur cloud')).toHaveCount(0);
  });
});
