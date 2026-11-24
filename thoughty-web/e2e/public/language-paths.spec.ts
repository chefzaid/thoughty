import { expect, test, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';

const preferences = (page: Page) => page.getByRole('group', { name: /^(Language and theme|Langue et thème)$/ });

async function headLinks(page: Page) {
  return page.evaluate(() => [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"], link[rel="alternate"]')]
    .map((link) => `${link.rel} ${link.hreflang || '-'} ${new URL(link.href).pathname}`));
}

test.describe('Public pages in French under /fr/', () => {
  test('an English browser reads /fr/about in French, with its addresses in each language', async ({ page }) => {
    await setupMockApp(page);
    await page.goto('/fr/about');

    await expect(page.getByRole('heading', { name: 'Un lieu plus calme pour les pensées qui méritent de rester.' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(preferences(page).getByRole('button', { name: 'Français' })).toHaveAttribute('aria-pressed', 'true');
    expect(await headLinks(page)).toEqual([
      'canonical - /fr/about',
      'alternate en /about',
      'alternate fr /fr/about',
      'alternate x-default /about',
    ]);

    // The footer leads on in French, and a reload of a deep French address opens it again
    await page.getByRole('contentinfo').getByRole('link', { name: 'Modèles de journal' }).click();
    await expect(page).toHaveURL(/\/fr\/journal-templates$/);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: /^Des modèles de journal/ })).toBeVisible();
    await expect(page).toHaveTitle('Modèles et pistes d’écriture pour votre journal · Thoughty');
  });

  test('the switch opens the page at its address in the other language', async ({ page }) => {
    await setupMockApp(page);
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();

    await preferences(page).getByRole('button', { name: 'Français' }).click();
    await expect(page).toHaveURL(/\/fr\/privacy$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Politique de confidentialité' })).toBeVisible();
    expect(await headLinks(page)).toContain('canonical - /fr/privacy');

    await preferences(page).getByRole('button', { name: 'English' }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test.describe('in a French browser', () => {
    test.use({ locale: 'fr-FR' });

    test('the English address sends the visitor to the French one, unless they pick English', async ({ page }) => {
      await setupMockApp(page);
      await page.goto('/memoir-questions');
      await expect(page).toHaveURL(/\/fr\/memoir-questions$/);
      await expect(page.getByRole('region', { name: 'Une année de questions' })).toBeVisible();

      await preferences(page).getByRole('button', { name: 'English' }).click();
      await expect(page).toHaveURL(/\/memoir-questions$/);
      await page.goto('/memoir-questions');
      await expect(page.getByRole('region', { name: 'A year of questions' })).toBeVisible();
      await expect(page).toHaveURL(/\/memoir-questions$/);
    });
  });

  test('the sitemap lists both languages and robots.txt points crawlers to it', async ({ page, baseURL }) => {
    const sitemap = await page.request.get('/sitemap.xml');
    expect(sitemap.ok()).toBe(true);
    expect(sitemap.headers()['content-type']).toContain('application/xml');
    const xml = await sitemap.text();
    expect(xml).toContain(`<loc>${baseURL}/fr/about</loc>`);
    expect(xml).toContain(`<xhtml:link rel="alternate" hreflang="fr" href="${baseURL}/fr/memoir-questions"/>`);
    expect(xml).not.toContain('/login');

    const robots = await page.request.get('/robots.txt');
    expect(robots.ok()).toBe(true);
    const text = await robots.text();
    expect(text).toContain('Allow: /fr/about');
    expect(text).toContain('Disallow: /api/');
    expect(text).toContain('Disallow: /journal');
    expect(text).toContain(`Sitemap: ${baseURL}/sitemap.xml`);
  });
});
