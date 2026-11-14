import AxeBuilder from '../support/axe';
import { expect, test, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { mockDiary } from '../support/mockApp.diaries';
import { fulfillJson } from '../support/mockApp.route-utils';
import type { MockEntry } from '../support/mockApp.shared';

const TODAY = '2026-11-01';

const earlier: MockEntry = { id: 901, date: '2026-10-30', index: 1, content: 'Two days ago.', tags: ['notes'], visibility: 'public', diaryId: 1 };

// The writer made Personal their default diary, so the capture goes there rather than to the first diary
const diaries = [
  mockDiary({ id: 1, name: 'Work', icon: '💼', color: '#3B82F6' }),
  mockDiary({ id: 2, name: 'Personal', icon: '🏠', color: '#A855F7', isDefault: true }),
];

const captureButton = (page: Page, name = 'Quick capture') => page.getByRole('navigation').getByRole('button', { name });
const captureDialog = (page: Page, name = 'Quick capture') => page.getByRole('dialog', { name });

/** Answers the next entry saves as if the API were down. */
async function failEntrySaves(page: Page) {
  await page.route('http://localhost:5173/api/entries', (route) => (
    route.request().method() === 'POST' ? fulfillJson(route, {}, { status: 503 }) : route.fallback()
  ));
}

test.describe('Quick capture', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date(`${TODAY}T12:00:00`));
  });

  test('opens from the navigation on any page and saves a private entry for today in the default diary', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: [earlier], diaries });
    await page.goto('/stats');
    await expect(page.getByRole('heading', { level: 1, name: 'Stats', exact: true })).toBeVisible();

    const button = captureButton(page);
    await expect(button).toHaveAttribute('title', 'Quick capture (Ctrl+Shift+Space)');
    await expect(button).toHaveAttribute('aria-keyshortcuts', 'Control+Shift+Space Meta+Shift+Space');
    await button.click();

    const dialog = captureDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    const field = dialog.getByRole('textbox', { name: "What's on your mind?" });
    await expect(field).toBeFocused();

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).include('[role="dialog"]').analyze();
    expect(results.violations.map(({ id }) => id)).toEqual([]);

    const saved = page.waitForRequest((request) => request.url().endsWith('/api/entries') && request.method() === 'POST');
    await field.fill('Call the plumber about the tap');
    await field.press('Enter');
    expect((await saved).postDataJSON()).toEqual({
      text: 'Call the plumber about the tap',
      tags: [],
      date: TODAY,
      visibility: 'private',
      format: 'plain',
    });

    // The box closes, focus goes back to its button, the page stays, and a polite toast links to the entry
    await expect(dialog).toHaveCount(0);
    await expect(button).toBeFocused();
    await expect(page).toHaveURL(/\/stats/);
    await expect(page.getByRole('status').filter({ hasText: 'Saved as a private entry for today.' })).toHaveCount(1);
    await expect(page.getByRole('alert')).toHaveCount(0);
    const created = state.entries.find((entry) => entry.id !== earlier.id);
    expect(created).toMatchObject({ date: TODAY, visibility: 'private', format: 'plain', diaryId: 2, tags: [] });

    await page.getByRole('link', { name: 'View entry' }).click();
    await expect(page).toHaveURL(/\/journal/);
    const card = page.locator(`#entry-${created!.id}`);
    await expect(card).toContainText('Call the plumber about the tap');
    await expect(card.getByTitle('Private - only you can see')).toBeVisible();
  });

  test('opens with Ctrl+Shift+Space while typing, adds the entry to the journal for today, and Escape gives focus back', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: [earlier] });
    await page.goto('/journal?diary=all');
    await expect(page.locator(`#entry-${earlier.id}`)).toBeVisible();

    const composer = page.getByPlaceholder("What's on your mind?").first();
    await composer.fill('A longer draft');
    await composer.press('Control+Shift+Space');
    const dialog = captureDialog(page);
    const field = dialog.getByRole('textbox', { name: "What's on your mind?" });
    await expect(field).toBeFocused();

    // Escape closes it and focus goes back to the composer, whose draft is untouched
    await field.fill('Half a thought');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(composer).toBeFocused();
    await expect(composer).toHaveValue('A longer draft');

    // The unsaved text waits for the next time
    await page.keyboard.press('Control+Shift+Space');
    await expect(field).toHaveValue('Half a thought');
    await field.fill('Bread, milk, stamps');
    await field.press('Enter');
    await expect(dialog).toHaveCount(0);

    const created = state.entries.find((entry) => entry.content === 'Bread, milk, stamps');
    expect(created).toMatchObject({ date: TODAY, diaryId: 1 });
    await expect(page.locator(`#entry-${created!.id}`)).toContainText('Bread, milk, stamps');
    await expect(composer).toHaveValue('A longer draft');
  });

  test('keeps the text and says why when the save fails, then saves it on another try', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/journal');
    await failEntrySaves(page);

    await captureButton(page).click();
    const dialog = captureDialog(page);
    const field = dialog.getByRole('textbox', { name: "What's on your mind?" });
    await field.fill('Do not lose this');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(field).toHaveValue('Do not lose this');
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toBeFocused();
    expect(state.entries).toHaveLength(0);

    await page.unroute('http://localhost:5173/api/entries');
    await field.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => state.entries.map((entry) => entry.content)).toEqual(['Do not lose this']);
  });

  test('carries the text to the composer with Open in full', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/people');
    await expect(page.getByRole('heading', { level: 1, name: 'People' })).toBeVisible();

    await page.keyboard.press('Control+Shift+Space');
    const dialog = captureDialog(page);
    await dialog.getByRole('textbox', { name: "What's on your mind?" }).fill('This needs more room');
    await dialog.getByRole('button', { name: 'Open in full' }).click();

    await expect(page).toHaveURL(/\/journal/);
    const composer = page.getByPlaceholder("What's on your mind?").first();
    await expect(composer).toHaveValue('This needs more room');
    await expect(composer).toBeFocused();
    expect(state.entries).toHaveLength(0);
  });

  test('does not open over focus mode', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/journal');

    const composer = page.getByPlaceholder("What's on your mind?").first();
    await composer.fill('Deep in thought');
    await composer.press('Control+Shift+F');
    const focusMode = page.getByRole('dialog');
    await expect(focusMode).toHaveCount(1);

    await page.keyboard.press('Control+Shift+Space');
    await expect(captureDialog(page)).toHaveCount(0);
    await expect(focusMode).toHaveCount(1);
  });

  test('speaks French', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' } });
    await page.goto('/journal');
    await failEntrySaves(page);

    const button = captureButton(page, 'Capture rapide');
    await expect(button).toHaveAttribute('title', 'Capture rapide (Ctrl+Maj+Espace)');
    await button.click();
    const dialog = captureDialog(page, 'Capture rapide');
    await expect(dialog.getByText('La touche Entrée l’enregistre comme entrée privée du jour dans votre journal par défaut.')).toBeVisible();
    const field = dialog.getByRole('textbox', { name: "Qu'avez-vous à l'esprit ?" });
    await expect(dialog.getByRole('button', { name: 'Ouvrir dans l’éditeur' })).toBeVisible();

    await field.press('Enter');
    await expect(dialog.getByRole('alert')).toHaveText('Veuillez saisir du texte');

    await field.fill('Acheter du pain');
    await field.press('Enter');
    await expect(dialog.getByRole('alert')).toHaveText('Impossible d’enregistrer l’entrée. Veuillez réessayer.');
    await expect(field).toHaveValue('Acheter du pain');

    await page.unroute('http://localhost:5173/api/entries');
    await field.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'Enregistrée comme entrée privée du jour.' })).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Voir l’entrée' })).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).include('nav').analyze();
    expect(results.violations.map(({ id }) => id)).toEqual([]);
  });
});
