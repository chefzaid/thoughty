import { test, expect } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { mockDiary } from '../support/mockApp.diaries';
import type { MockTrashedEntry } from '../support/mockApp.shared';

// The default is the second diary, so picking the first one by accident cannot pass
const diaries = [
  mockDiary({ id: 1, name: 'Work', icon: '💼', color: '#3B82F6' }),
  mockDiary({ id: 2, name: 'Personal', icon: '🏠', color: '#A855F7', isDefault: true }),
];

test.describe('Default diary', () => {
  test('opens the journal on the default diary after signing in', async ({ page }) => {
    const { state } = await setupMockApp(page, { diaries });
    state.user.emailVerified = true;

    await page.goto('/login');
    await page.locator('#identifier').fill('TestUser');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    const activeTab = page.locator('.diary-tab.active');
    await expect(activeTab).toContainText('Personal');
    await expect(activeTab).toHaveClass(/\bdefault\b/);
    await expect(activeTab.locator('.default-badge')).toHaveText('★');
  });

  test('offers neither Set as Default nor Delete on the default diary', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, diaries });
    await page.goto('/diaries?from=journal&diary=all');

    const defaultCard = page.locator('.diary-card', { hasText: 'Personal' });
    await expect(defaultCard).toHaveClass(/\bdefault\b/);
    await expect(defaultCard.getByText('Default Diary')).toBeVisible();
    await expect(defaultCard.getByTitle('Set as Default')).toHaveCount(0);
    await expect(defaultCard.getByTitle('Delete')).toHaveCount(0);

    const otherCard = page.locator('.diary-card', { hasText: 'Work' });
    await expect(otherCard.getByTitle('Set as Default')).toBeVisible();
    await expect(otherCard.getByTitle('Delete')).toBeVisible();
  });

  test('names the default diary for entries whose diary was deleted', async ({ page }) => {
    const orphan: MockTrashedEntry = {
      id: 601,
      date: '2026-10-02',
      index: 1,
      content: 'Notes from a diary that was later deleted.',
      tags: [],
      visibility: 'private',
      diaryId: 99,
      deletedAt: new Date().toISOString(),
    };
    await setupMockApp(page, { startAuthenticated: true, diaries, initialTrash: [orphan] });
    await page.goto('/recycle-bin');

    const card = page.getByRole('article', { name: 'October 2, 2026' });
    await expect(card.getByText('Its diary was deleted, so it returns to Personal')).toBeVisible();
  });
});
