import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import type { MockEntry } from '../support/mockApp.shared';

const TODAY = '2025-04-17';

const entries: MockEntry[] = [
  {
    id: 401,
    date: TODAY,
    index: 1,
    title: 'Harbour walk',
    content: 'Told nobody about the letter yet.',
    tags: ['walks'],
    visibility: 'private',
    diaryId: 1,
  },
  { id: 402, date: '2024-04-17', index: 1, content: 'A secret from a year ago.', tags: [], visibility: 'private', diaryId: 1 },
];

const filterOf = (locator: Locator) => locator.evaluate((element) => getComputedStyle(element).filter);
const fillOf = (locator: Locator) => locator.evaluate((element) => getComputedStyle(element).webkitTextFillColor);
const toggleButton = (page: Page, name = 'Blur entry text') => page.getByRole('navigation').getByRole('button', { name });

test.describe('Privacy blur', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date(`${TODAY}T12:00:00`));
  });

  test('blurs every entry text but not the titles, by button and by shortcut, and says so', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    await page.goto('/journal?diary=all');

    const card = page.locator('#entry-401');
    const text = card.locator('.privacy-text');
    const title = card.getByRole('heading', { name: 'Harbour walk' });
    const composer = page.getByPlaceholder("What's on your mind?");
    const button = toggleButton(page);
    const status = page.getByRole('navigation').getByRole('status');
    await expect(text).toHaveText('Told nobody about the letter yet.');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(button).toHaveAttribute('title', 'Blur entry text (Ctrl+Shift+E)');
    expect(await filterOf(text)).toBe('none');

    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(status).toHaveText('Entry text blurred');
    await expect.poll(() => filterOf(text)).toMatch(/^blur\(/);
    expect(await filterOf(title)).toBe('none');
    // The composer keeps its frame; only its letters blur
    expect(await fillOf(composer)).toBe('rgba(0, 0, 0, 0)');
    expect(await filterOf(composer)).toBe('none');

    // The shortcut works while typing, and the text stays what was typed
    await composer.fill('Draft');
    await composer.press('Control+Shift+E');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(status).toHaveText('Entry text shown');
    await expect.poll(() => filterOf(text)).toBe('none');
    await expect(composer).toHaveValue('Draft');

    // Search results are the same cards
    await page.keyboard.press('Control+Shift+E');
    await page.getByRole('textbox', { name: 'Search entries' }).fill('letter');
    await expect(page.locator('[id^="entry-"]')).toHaveCount(1);
    await expect(card.locator('mark')).toHaveText('letter');
    await expect.poll(() => filterOf(text)).toMatch(/^blur\(/);

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).include('nav').analyze();
    expect(results.violations.map(({ id }) => id)).toEqual([]);
  });

  test('blurs Highlights in their dialog and stays on across views', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    await page.goto('/journal?diary=all');
    await expect(page.locator('#entry-401')).toBeVisible();

    await page.keyboard.press('Control+Shift+E');
    await expect(toggleButton(page)).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Highlights' }).click();
    const dialog = page.getByRole('dialog', { name: 'Highlights' });
    const secret = dialog.locator('.privacy-text', { hasText: 'A secret from a year ago.' }).first();
    await expect(secret).toBeVisible();
    await expect.poll(() => filterOf(secret)).toMatch(/^blur\(/);
    await page.keyboard.press('Escape');

    await page.getByRole('navigation').getByRole('button', { name: 'Stats' }).click();
    await expect(toggleButton(page)).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('navigation').getByRole('button', { name: 'Journal' }).click();
    await expect.poll(() => filterOf(page.locator('#entry-401 .privacy-text'))).toMatch(/^blur\(/);
  });

  test('never blurs a print and does not animate when motion is reduced', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    await page.goto('/journal?diary=all');
    const text = page.locator('#entry-401 .privacy-text');

    await toggleButton(page).click();
    expect(await filterOf(text)).toMatch(/^blur\(/);
    expect(await text.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s');

    await page.emulateMedia({ media: 'print', reducedMotion: 'reduce' });
    expect(await filterOf(text)).toBe('none');
  });

  test('speaks French', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: entries, config: { language: 'fr' } });
    await page.goto('/journal?diary=all');

    const button = toggleButton(page, 'Flouter le texte des entrées');
    await expect(button).toHaveAttribute('title', 'Flouter le texte des entrées (Ctrl+Maj+E)');
    await button.click();
    await expect(page.getByRole('navigation').getByRole('status')).toHaveText('Texte des entrées flouté');
    await page.keyboard.press('Control+Shift+E');
    await expect(page.getByRole('navigation').getByRole('status')).toHaveText('Texte des entrées affiché');
  });
});
