import { test, expect } from '@playwright/test';
import { setupMockApp } from '../support/mockApp';

const filterEntries = [
  {
    id: 101,
    date: '2024-04-18',
    index: 1,
    content: 'Private focus reflection for filtering',
    tags: ['focus', 'reflection'],
    visibility: 'private' as const,
    is_favorite: true,
    diaryId: 1,
  },
  {
    id: 102,
    date: '2024-04-18',
    index: 2,
    content: 'Archived travel memory',
    tags: ['travel'],
    visibility: 'public' as const,
    is_archived: true,
    diaryId: 2,
  },
  {
    id: 103,
    date: '2024-04-17',
    index: 1,
    content: 'Public work planning note',
    tags: ['work'],
    visibility: 'public' as const,
    diaryId: 1,
  },
];

test.describe('Journal composable filtering', () => {
  test('filters by search, visibility, and archived state', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: filterEntries,
    });

    await page.goto('/journal?diary=all');

    await expect(page.getByText('Private focus reflection for filtering')).toBeVisible();
    await expect(page.getByText('Public work planning note')).toBeVisible();
    await expect(page.getByText('Archived travel memory')).toHaveCount(0);

    await page.getByPlaceholder('Search content...').fill('focus');
    await expect(page.getByText('Private focus reflection for filtering')).toBeVisible();
    await expect(page.getByText('Public work planning note')).toHaveCount(0);

    await page.getByRole('button', { name: 'Visibility' }).click();
    await expect(page.getByText('No entries found')).toBeVisible();

    await page.getByRole('button', { name: 'Reset Filters' }).click();
    await page.getByRole('button', { name: 'Filter archived entries' }).click();
    await expect(page.getByText('Archived travel memory')).toBeVisible();
    await expect(page.getByText('Private focus reflection for filtering')).toHaveCount(0);
  });
});