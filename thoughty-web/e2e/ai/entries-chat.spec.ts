import AxeBuilder from '../support/axe';
import { expect, test, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import type { MockEntry } from '../support/mockApp.shared';

const entry = (id: number, date: string, content: string, fields: Partial<MockEntry> = {}): MockEntry => ({
  id, date, index: 1, content, tags: [], visibility: 'private', diaryId: 1, ...fields,
});

const ENTRIES: MockEntry[] = [
  entry(901, '2026-08-30', 'Late summer swim.', { is_favorite: true }),
  entry(902, '2026-09-14', 'First walk in the rain.', { is_favorite: true, title: 'Rain walk' }),
  entry(903, '2026-10-02', 'Errands in town.'),
  entry(904, '2026-10-20', 'Evening by the lake.', { is_favorite: true }),
];

const discussButton = (page: Page) => page.locator('.journal-filter-controls').getByRole('button', { name: 'Discuss' });

test.describe('Discuss these entries', () => {
  test('discusses the filtered entries within a date range and opens a cited entry in the reader', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
    await page.goto('/journal?diary=all');
    await expect(page.locator('#entry-904')).toBeVisible();
    await page.getByTitle('Show favorites only').click();
    await expect(page.locator('#entry-903')).toHaveCount(0);

    await discussButton(page).click();
    const dialog = page.getByRole('dialog', { name: 'Discuss these entries' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: 'Message to the AI' })).toBeFocused();
    await dialog.getByLabel('From').fill('2026-09-01');
    await dialog.getByRole('textbox', { name: 'Message to the AI' }).fill('What changed over these weeks?');
    await dialog.getByRole('textbox', { name: 'Message to the AI' }).press('Enter');

    await expect(dialog.getByText('It starts with [1] and ends with [2].')).toBeVisible();
    await expect(dialog.getByText('Read 2 entries')).toBeVisible();
    expect(state.lastEntryChatRequest?.query).toBe('favorites=true&archiveStatus=active&dateFrom=2026-09-01');
    expect(state.lastEntryChatRequest?.payload).toEqual({ messages: [{ role: 'user', content: 'What changed over these weeks?' }] });
    await expect(dialog.getByLabel('From')).toBeDisabled();

    const results = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);

    await dialog.getByRole('button', { name: '[1] September 14, 2026 · Rain walk' }).click();
    const reader = page.getByRole('dialog', { name: 'Reader' });
    await expect(reader.getByText('First walk in the rain.')).toBeVisible();
    await expect(reader.locator('[aria-live="polite"]')).toHaveText('Entry 1 of 2, September 14, 2026.');
    await page.keyboard.press('Escape');
    await expect(reader).toHaveCount(0);

    // The conversation waits for the same filters
    await discussButton(page).click();
    await expect(dialog.getByText('It starts with [1] and ends with [2].')).toBeVisible();
    await dialog.getByRole('button', { name: 'New conversation' }).click();
    await expect(dialog.getByText('It starts with [1] and ends with [2].')).toHaveCount(0);
    await expect(dialog.getByLabel('From')).toBeEnabled();
  });

  test('passes an accessibility scan in the light theme, and says when no entry falls within the dates', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES, config: { theme: 'light' } });
    await page.goto('/journal?diary=all');
    await expect(page.locator('#entry-904')).toBeVisible();

    await discussButton(page).click();
    const dialog = page.getByRole('dialog', { name: 'Discuss these entries' });
    const message = dialog.getByRole('textbox', { name: 'Message to the AI' });
    await message.fill('What comes back?');
    await dialog.getByRole('button', { name: 'Send message' }).click();
    await expect(dialog.getByText('Read 4 entries')).toBeVisible();
    await expect(dialog.getByRole('button', { name: '[4] October 20, 2026' })).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    const results = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);

    await dialog.getByRole('button', { name: 'New conversation' }).click();
    await dialog.getByLabel('From').fill('2027-01-01');
    await message.fill('Anything?');
    await message.press('Enter');
    await expect(dialog.getByRole('alert')).toHaveText('No entry matches these filters and dates, so there is nothing to discuss.');
  });
});
