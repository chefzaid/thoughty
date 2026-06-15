import { test, expect } from '@playwright/test';
import { setupMockApp } from '../support/mockApp';

test.describe('Journal Markdown authoring', () => {
  test('creates a backdated Markdown entry with tags', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });

    await page.goto('/journal');

    const entryForm = page.locator('form').first();
    await page.getByTitle('Plain text - click to enable Markdown formatting').click();
    await page.getByPlaceholder("What's on your mind?").fill('## Markdown memory\n\nA **bold** backdated note.');
    await entryForm.locator('input').first().fill('2024-02-20');
    await entryForm.locator('input').first().press('Tab');
    await entryForm.locator('input[placeholder="tags..."]').fill('markdown');
    await entryForm.locator('input[placeholder="tags..."]').press('Enter');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Markdown memory' })).toBeVisible();
    await expect(page.locator('[id^="entry-"]').first().getByText('#markdown')).toBeVisible();
    expect(state.entries[0]).toMatchObject({
      date: '2024-02-20',
      content: '## Markdown memory\n\nA **bold** backdated note.',
      tags: ['markdown'],
      visibility: 'private',
      format: 'markdown',
    });
  });
});
