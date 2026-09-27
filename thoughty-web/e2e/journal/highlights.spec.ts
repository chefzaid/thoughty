import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import { setupMockApp } from '../support/mockApp';

test.describe('Journal highlights', () => {
  test('shows random and on-this-day highlights and navigates back to the highlighted journal entry', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [
        {
          id: 101,
          date: '2024-04-18',
          index: 1,
          content: 'Private focus reflection for filtering',
          tags: ['focus', 'reflection'],
          visibility: 'private',
          diaryId: 1,
        },
        {
          id: 102,
          date: '2024-04-17',
          index: 1,
          content: 'Earlier highlight memory',
          tags: ['memory'],
          visibility: 'private',
          diaryId: 2,
        },
      ],
    });

    await page.goto('/journal?diary=all');
    await page.getByRole('button', { name: 'Highlights' }).click();

    await expect(page.getByRole('heading', { name: 'Highlights' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Random Thought' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'On This Day' })).toBeVisible();

    await page.getByRole('button', { name: /Private focus reflection for filtering/ }).click();

    await expect(page).toHaveURL(/\/journal\?diary=all$/);
    await expect(page.locator('#entry-101')).toHaveClass(/highlight-entry/);
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`keeps keyboard focus inside the highlights dialog in the ${theme} theme`, async ({ page }) => {
      const today = new Date().toISOString().slice(0, 10);
      const lastYear = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
      await setupMockApp(page, {
        startAuthenticated: true,
        config: { theme },
        initialEntries: [
          { id: 201, date: today, index: 1, content: 'Written today', tags: [], visibility: 'private', diaryId: 1 },
          { id: 202, date: lastYear, index: 1, content: 'Written a year ago', tags: [], visibility: 'private', diaryId: 1 },
        ],
      });
      await page.goto('/journal?diary=all');

      const trigger = page.getByRole('button', { name: 'Highlights' });
      await trigger.focus();
      await page.keyboard.press('Enter');

      const dialog = page.getByRole('dialog', { name: 'Highlights' });
      await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
      await expect(dialog.getByRole('button', { name: /Written a year ago/ })).toBeVisible();

      for (let press = 0; press < 8; press += 1) {
        await page.keyboard.press('Tab');
        await expect(dialog.locator(':focus')).toHaveCount(1);
      }
      await page.keyboard.press('Shift+Tab');
      await expect(dialog.locator(':focus')).toHaveCount(1);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .include('.thought-of-day-modal')
        .analyze();
      expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);

      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });
  }
});
