import AxeBuilder from '../support/axe';
import { test, expect } from '../support/test';
import { setupMockApp } from '../support/mockApp';

const TODAY = '2026-11-21';
const entries = [
  { id: 301, date: '2026-11-17', index: 1, content: 'Planted tulips after work', tags: ['garden'], visibility: 'private' as const, diaryId: 1 },
  { id: 302, date: '2026-11-20', index: 1, content: 'A slow morning with coffee', tags: [], visibility: 'private' as const, diaryId: 1 },
  { id: 303, date: '2026-10-02', index: 1, content: 'Long before this week', tags: [], visibility: 'private' as const, diaryId: 1 },
];

test.describe('Weekly reflection in Highlights', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date(`${TODAY}T12:00:00`));
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`reflects on the past seven days on request and keeps the reflection, in the ${theme} theme`, async ({ page }) => {
      const { state } = await setupMockApp(page, { startAuthenticated: true, config: { theme }, initialEntries: entries });
      await page.goto('/journal?diary=all');
      await page.getByRole('button', { name: 'Highlights' }).click();

      const dialog = page.getByRole('dialog', { name: 'Highlights' });
      const week = dialog.getByRole('region', { name: 'Your week' });
      await expect(week.getByText('November 15, 2026 to November 21, 2026')).toBeVisible();
      await expect(week.getByText(/Look back on the past seven days with AI/)).toBeVisible();
      await expect(week.getByText(/locked entries are never sent/)).toBeVisible();

      await week.getByRole('button', { name: 'Reflect on my week' }).click();

      await expect(week.getByRole('listitem')).toHaveText(['garden', 'slow mornings']);
      await expect(week.getByText('You found calm in the garden between long days.')).toHaveClass(/privacy-text/);
      await expect(week.getByText('What would make one evening this week feel like your own?')).toBeVisible();
      await expect(week.getByRole('button', { name: 'Reflect again' })).toBeVisible();
      expect(state.review.reflectionRequests).toEqual([{ today: TODAY }]);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .include('.weekly-reflection')
        .analyze();
      expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);

      // Closing and opening Highlights again shows the saved reflection without asking the AI again
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Highlights' }).click();
      await expect(page.getByRole('region', { name: 'Your week' }).getByText('What would make one evening this week feel like your own?')).toBeVisible();
      expect(state.review.reflectionRequests).toHaveLength(1);
    });
  }

  test('says so when the week cannot be read, and offers nothing to send for an empty week', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    state.review.reflectionUnavailable = true;
    await page.goto('/journal?diary=all');
    await page.getByRole('button', { name: 'Highlights' }).click();

    const week = page.getByRole('region', { name: 'Your week' });
    await week.getByRole('button', { name: 'Reflect on my week' }).click();
    await expect(week.getByRole('alert')).toHaveText('Your week could not be read right now. Please try again in a moment.');

    await page.keyboard.press('Escape');
    state.entries = state.entries.filter((entry) => entry.date < '2026-11-15');
    await page.getByRole('button', { name: 'Highlights' }).click();
    const empty = page.getByRole('region', { name: 'Your week' });
    await expect(empty.getByText(/Nothing written in the past seven days yet/)).toBeVisible();
    await expect(empty.getByRole('button')).toHaveCount(0);
  });

  test('stays out of Highlights when AI is not available', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    state.review.aiAvailable = false;
    await page.goto('/journal?diary=all');
    await page.getByRole('button', { name: 'Highlights' }).click();
    await expect(page.getByRole('heading', { name: 'Random Thought' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Your week' })).toHaveCount(0);
  });

  test('speaks French', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' }, initialEntries: entries });
    await page.goto('/journal?diary=all');
    await page.getByRole('button', { name: 'Moments forts' }).click();

    const week = page.getByRole('region', { name: 'Votre semaine' });
    await expect(week.getByText('Du 15 novembre 2026 au 21 novembre 2026')).toBeVisible();
    await week.getByRole('button', { name: 'Faire le bilan de ma semaine' }).click();
    await expect(week.getByText('Une question pour la semaine qui vient')).toBeVisible();
    await expect(week.getByRole('button', { name: 'Refaire le bilan' })).toBeVisible();
  });
});
