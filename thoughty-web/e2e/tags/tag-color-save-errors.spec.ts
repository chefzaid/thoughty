import { test, expect } from '@playwright/test';
import { setupMockApp } from '../support/mockApp';
import { failSettingsSaves } from '../support/settingsSaves';

const entry = {
  id: 10,
  date: '2024-04-18',
  index: 1,
  content: 'A quiet morning reflection about focus',
  tags: ['focus'],
  visibility: 'private' as const,
  diaryId: 1,
};

const tagColors = (config: Record<string, unknown>) =>
  JSON.parse(String(config.tagMetadata ?? '{}')) as Record<string, { color?: string }>;

test.describe('Tag colors while settings cannot be saved', () => {
  for (const failure of ['status', 'network'] as const) {
    test(`tries to save a new tag's color once when the save is refused (${failure})`, async ({ page }) => {
      const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: [entry] });
      const saves = await failSettingsSaves(page, failure);

      await page.goto('/journal');
      await expect(page.getByText(entry.content)).toBeVisible();
      await expect.poll(saves.refusedSaves).toBe(1);

      // Over a few seconds no further save follows the refused one
      await page.waitForTimeout(3000);
      expect(saves.refusedSaves()).toBe(1);
      expect(tagColors(state.config)).toEqual({});
    });
  }

  test('gives the tag its color once settings can be saved again', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: [entry] });
    const saves = await failSettingsSaves(page, 'status');
    await page.goto('/journal');
    await expect.poll(saves.refusedSaves).toBe(1);

    await page.unroute('http://localhost:5173/api/config');
    await page.reload();

    await expect.poll(() => tagColors(state.config).focus?.color).toMatch(/^#[0-9A-F]{6}$/);
    expect(saves.refusedSaves()).toBe(1);
  });
});
