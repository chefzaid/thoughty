import { expect, test, type Page } from '../support/test';

import AxeBuilder from '../support/axe';
import { setupMockApp } from '../support/mockApp';
import type { MockEntry } from '../support/mockApp.shared';

const imported: MockEntry = {
  id: 701,
  date: '2024-05-02',
  index: 1,
  content: 'Coffee and a notebook.',
  tags: ['paris'],
  visibility: 'private',
  diaryId: 1,
  location: { name: 'Café de Flore, Paris, France', latitude: 48.854, longitude: 2.3325 },
};

/** The composer's accessibility violations, by rule and element. */
async function composerViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .include('form')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));
}

test.describe('Places on entries', () => {
  test('stays out of the composer until turned on in Profile', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/journal');
    await expect(page.getByPlaceholder("What's on your mind?")).toBeVisible();
    await expect(page.getByLabel('Place', { exact: true })).toHaveCount(0);

    await page.goto('/profile');
    const toggle = page.getByRole('switch', { name: 'Places on entries' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect.poll(() => state.config.entryLocation).toBe(true);

    await page.goto('/journal');
    await expect(page.locator('form').first().getByLabel('Place', { exact: true })).toBeVisible();
  });

  test('saves a typed place with the device location and shows it on the entry', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 45.899_2, longitude: 6.129_4 });
    const { state } = await setupMockApp(page, { startAuthenticated: true, config: { entryLocation: true } });
    await page.goto('/journal');

    const form = page.locator('form').first();
    await page.getByPlaceholder("What's on your mind?").fill('Swam before breakfast.');
    await form.locator('input[placeholder="tags..."]').fill('trip');
    await form.locator('input[placeholder="tags..."]').press('Enter');
    await form.getByLabel('Place', { exact: true }).fill('Lake Annecy');
    await form.getByRole('button', { name: 'Use my location' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Your location was added' })).toBeVisible();
    await expect(form.getByText('Coordinates: 45.8992° N, 6.1294° E')).toBeVisible();
    expect(await composerViolations(page)).toEqual([]);
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect.poll(() => state.entries.find((entry) => entry.content === 'Swam before breakfast.')?.location).toEqual({
      name: 'Lake Annecy',
      latitude: 45.8992,
      longitude: 6.1294,
    });
    const card = page.locator('[id^="entry-"]', { hasText: 'Swam before breakfast.' });
    await expect(card.getByText('Lake Annecy', { exact: true })).toBeVisible();
    // The composer starts over without a place
    await expect(form.getByLabel('Place', { exact: true })).toHaveValue('');
    await expect(form.getByText(/^Coordinates:/)).toHaveCount(0);
  });

  test('edits or removes the place an import brought, with the setting off', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: [imported] });
    await page.goto('/journal');

    const card = page.locator('#entry-701');
    await expect(card.getByText('Café de Flore, Paris, France')).toBeVisible();
    await card.getByRole('button', { name: 'Edit' }).click();
    const place = card.getByLabel('Place', { exact: true });
    await expect(place).toHaveValue('Café de Flore, Paris, France');
    await expect(card.getByText('Coordinates: 48.854° N, 2.3325° E')).toBeVisible();
    await card.getByRole('button', { name: 'Remove coordinates' }).click();
    await place.fill('Café de Flore');
    await card.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => state.entries.find((entry) => entry.id === 701)?.location).toEqual({ name: 'Café de Flore', latitude: null, longitude: null });
    await expect(card.getByText('Café de Flore', { exact: true })).toBeVisible();

    await card.getByRole('button', { name: 'Edit' }).click();
    await card.getByLabel('Place', { exact: true }).fill('');
    await card.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => state.entries.find((entry) => entry.id === 701)?.location).toBeNull();
    await expect(card.getByText('Café de Flore', { exact: true })).toHaveCount(0);
  });

  test('puts places into a JSON export only when asked', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: [imported] });
    await page.goto('/import-export?section=export');

    const exportSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Export' }) });
    await expect(exportSection.getByRole('checkbox', { name: 'Include places' })).toHaveCount(0);
    await exportSection.locator('.format-select').selectOption('json');
    await exportSection.getByRole('checkbox', { name: 'Include places' }).check();
    await page.getByRole('button', { name: 'Download', exact: true }).click();
    await expect.poll(() => state.lastExportRequestUrl?.searchParams.get('includeLocation')).toBe('true');

    await exportSection.locator('.format-select').selectOption('md');
    await page.getByRole('button', { name: 'Download', exact: true }).click();
    await expect.poll(() => state.lastExportRequestUrl?.searchParams.get('format')).toBe('md');
    expect(state.lastExportRequestUrl?.searchParams.has('includeLocation')).toBe(false);
  });

  test('prints places in a book only when asked, under each entry', async ({ page }) => {
    const trail: MockEntry = { ...imported, id: 702, date: '2024-05-03', content: 'Lost on the trail.', location: { name: null, latitude: -33.8688, longitude: 151.2093 } };
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: [imported, trail] });
    await page.goto('/import-export?diary=1&section=book');
    const bookSection = page.locator('#book-section');
    await bookSection.getByLabel('Weave thoughts into flowing prose with AI').uncheck();
    const places = bookSection.getByRole('checkbox', { name: 'Show entry places' });
    await expect(places).not.toBeChecked();

    const chapterText = async () => {
      await bookSection.getByRole('button', { name: 'Preview Book' }).click();
      const dialog = page.getByRole('dialog', { name: 'Book preview' });
      await dialog.getByLabel('Go to').selectOption({ label: 'Chapter 1: paris (page 3)' });
      const text = dialog.getByTestId('book-preview-page-text');
      await expect(text).toContainText('Lost on the trail.');
      const content = await text.innerText();
      await dialog.getByRole('button', { name: 'Close' }).click();
      return content;
    };

    const without = await chapterText();
    expect(without).not.toContain('Café de Flore');
    expect(without).not.toContain('33.8688');
    expect(state.bookExportRequestUrls.at(-1)!.searchParams.has('includeLocation')).toBe(false);

    await places.check();
    const placed = await chapterText();
    expect(placed).toContain('Café de Flore, Paris, France');
    expect(placed).toContain('33.8688° S, 151.2093° E');
    expect(placed.indexOf('Café de Flore')).toBeLessThan(placed.indexOf('Coffee and a notebook.'));
    expect(state.bookExportRequestUrls.at(-1)!.searchParams.get('includeLocation')).toBe('true');
  });

  test('speaks French', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr', entryLocation: true }, initialEntries: [imported] });
    await page.goto('/journal');

    const form = page.locator('form').first();
    await expect(form.getByPlaceholder('Où êtes-vous ? (facultatif)')).toBeVisible();
    await expect(form.getByRole('button', { name: 'Utiliser ma position' })).toBeVisible();
    await page.locator('#entry-701').getByRole('button', { name: 'Modifier' }).click();
    await expect(page.locator('#entry-701').getByText('Coordonnées : 48,854° N, 2,3325° E')).toBeVisible();

    await page.goto('/import-export?diary=1&section=book');
    await expect(page.locator('#book-section').getByRole('checkbox', { name: 'Afficher les lieux des entrées' })).not.toBeChecked();
  });
});
