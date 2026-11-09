import { expect, test } from '../support/test';
import { setupMockApp } from '../support/mockApp';

test.describe('Contact and support page', () => {
  test('offers no form that would lose a message, and points to the community board instead', async ({ page }) => {
    await setupMockApp(page);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/contact')) apiRequests.push(request.url());
    });
    await page.goto('/contact');

    const panel = page.getByRole('region', { name: 'Messages cannot be sent from here yet' });
    await expect(panel).toContainText('No inbox receives messages from this page yet');
    await expect(page.locator('main').locator('form, input, textarea, select')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Which formats are available?' })).toBeVisible();

    await panel.getByRole('button', { name: 'Open the community board' }).click();
    await expect(page).toHaveURL(/\/feedback$/);
    await expect(page.getByRole('heading', { name: 'Offline writing mode' })).toBeVisible();
    expect(apiRequests).toEqual([]);
  });

  test('speaks French and fits a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' } });
    await page.goto('/contact');

    const panel = page.getByRole('region', { name: 'Les messages ne peuvent pas encore être envoyés d’ici' });
    await expect(panel).toContainText('Aucune boîte de réception ne reçoit encore les messages de cette page');
    await expect(panel.getByRole('button', { name: 'Ouvrir le tableau de la communauté' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});
