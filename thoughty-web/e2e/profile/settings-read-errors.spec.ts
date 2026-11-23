import { test, expect } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { failSettingsReads } from '../support/settingsSaves';

const storedTagMetadata = JSON.stringify({ focus: { color: '#112233' } });

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

test.describe('Settings that could not be read', () => {
  test('gives the tags no new color over the stored ones, then keeps them once the settings are read', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [entry, { ...entry, id: 11, date: '2024-04-17', content: 'Packing for the trip', tags: ['travel'] }],
      config: { tagMetadata: storedTagMetadata },
    });
    const reads = await failSettingsReads(page);

    await page.goto('/journal?diary=1');
    await expect(page.getByLabel('Journal entries').getByText(entry.content)).toBeVisible();
    // Over a few seconds no tag color is saved over the stored ones
    await page.waitForTimeout(1500);
    expect(reads.saves()).toBe(0);
    expect(state.config.tagMetadata).toBe(storedTagMetadata);

    await page.unroute('http://localhost:5173/api/config');
    await page.reload();

    // Only the tag without a color gets one
    await expect.poll(() => tagColors(state.config).travel?.color).toMatch(/^#[0-9A-F]{6}$/);
    expect(tagColors(state.config).focus).toEqual({ color: '#112233' });
  });

  test('saves no tag created on the tags page over the stored tags, and says so', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [entry],
      config: { tagMetadata: storedTagMetadata },
    });
    const reads = await failSettingsReads(page);
    await page.goto('/tags');

    await page.getByPlaceholder('Tag name').fill('gratitude');
    await page.getByRole('button', { name: 'Add tag' }).click();

    await expect(page.getByRole('alert')).toHaveText('Your settings could not be read yet, so this change was not saved. Reload the page and try again.');
    await expect(page.getByLabel('Name gratitude')).toHaveCount(0);
    expect(reads.saves()).toBe(0);
    expect(state.config.tagMetadata).toBe(storedTagMetadata);
  });

  test('saves no profile built on the defaults over the stored settings, and says so', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      config: { name: 'Camille Martin', theme: 'light', fontSize: '20' },
    });
    const reads = await failSettingsReads(page);
    await page.goto('/profile');

    await page.getByRole('button', { name: 'Toggle theme' }).click();
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.getByRole('alert')).toHaveText('Your settings could not be read yet, so this change was not saved. Reload the page and try again.');
    await expect(page.getByText('Settings saved successfully')).toHaveCount(0);
    expect(reads.saves()).toBe(0);
    expect(state.config).toMatchObject({ name: 'Camille Martin', theme: 'light', fontSize: '20' });
  });
});
