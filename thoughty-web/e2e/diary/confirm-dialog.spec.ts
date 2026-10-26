import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import { setupMockApp } from '../support/mockApp';

const DELETE_MESSAGE = '“Personal” will be deleted. Its entries will be moved to your default diary.';

test.describe('Confirm dialog', () => {
  test('cancels and confirms with the keyboard alone, keeping focus inside', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/diaries?from=journal&diary=all');

    const deleteButton = page.locator('.diary-card', { hasText: 'Personal' }).getByTitle('Delete');
    await deleteButton.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('alertdialog', { name: 'Delete Diary' });
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveAccessibleDescription(DELETE_MESSAGE);
    const cancel = dialog.getByRole('button', { name: 'Cancel' });
    const confirm = dialog.getByRole('button', { name: 'Delete', exact: true });
    await expect(cancel).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(confirm).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(cancel).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(confirm).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(deleteButton).toBeFocused();
    expect(state.diaries.some((diary) => diary.name === 'Personal')).toBe(true);

    await page.keyboard.press('Enter');
    await expect(cancel).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(deleteButton).toBeFocused();

    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => state.diaries.some((diary) => diary.name === 'Personal')).toBe(false);
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`passes an accessibility scan while open in the ${theme} theme`, async ({ page }) => {
      await setupMockApp(page, { startAuthenticated: true, config: { theme } });
      await page.goto('/diaries?from=journal&diary=all');
      await page.locator('.diary-card', { hasText: 'Personal' }).getByTitle('Delete').click();
      await expect(page.getByRole('alertdialog', { name: 'Delete Diary' })).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .include('[role="alertdialog"]')
        .analyze();
      expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
    });
  }
});
