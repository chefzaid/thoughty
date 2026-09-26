import { expect, test } from '@playwright/test';
import { setupMockApp } from '../support/mockApp';

const OLD_ENTRY_ID = 250;

// Twelve dated entries fill more than one page; the oldest is linked from the newest.
const entries = Array.from({ length: 12 }, (_, i) => {
  const day = String(28 - i).padStart(2, '0');
  const id = 200 + i;
  return {
    id,
    date: `2024-04-${day}`,
    index: 1,
    content: i === 0
      ? 'Newest entry. Looking back at [[2024-03-02]] where it all started.'
      : `Journal entry number ${12 - i} with enough text to take up some room on the page.`,
    tags: ['journal'],
    visibility: 'private' as const,
    diaryId: 1,
  };
});
entries.push({
  id: OLD_ENTRY_ID,
  date: '2024-03-02',
  index: 1,
  content: 'The oldest entry, where it all started.',
  tags: ['journal'],
  visibility: 'private' as const,
  diaryId: 1,
});

test.describe('Navigating to an entry', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    await page.goto('/journal?diary=all');
  });

  test('scrolls to an On This Day entry opened from Highlights', async ({ page }) => {
    await page.getByRole('button', { name: 'Highlights' }).click();
    await page.getByRole('button', { name: /The oldest entry, where it all started/ }).last().click();

    const target = page.locator(`#entry-${OLD_ENTRY_ID}`);
    await expect(target).toHaveClass(/highlight-entry/);
    await expect(target).toBeInViewport();
  });

  test('scrolls to the target of a cross-reference', async ({ page }) => {
    await page.locator('#entry-200').getByRole('button', { name: '2024-03-02' }).click();

    const target = page.locator(`#entry-${OLD_ENTRY_ID}`);
    await expect(target).toHaveClass(/highlight-entry/);
    await expect(target).toBeInViewport();
  });
});
