import { expect, test } from '@playwright/test';
import { setupMockApp } from '../support/mockApp';

test.describe('AI semantic search', () => {
  test('finds entries by meaning and composes with journal filters', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [{
        id: 401,
        date: '2026-04-20',
        index: 1,
        content: 'I chose to leave consulting and make room for a calmer chapter.',
        tags: ['career', 'semantic-match'],
        visibility: 'public',
        diaryId: 1,
      }, {
        id: 402,
        date: '2026-04-19',
        index: 1,
        content: 'The train arrived late after a rainy afternoon.',
        tags: ['travel'],
        visibility: 'private',
        diaryId: 1,
      }, {
        id: 403,
        date: '2026-04-18',
        index: 1,
        content: 'Protecting evenings with my family matters more than another promotion.',
        tags: ['family', 'semantic-match'],
        visibility: 'private',
        diaryId: 1,
      }, {
        id: 404,
        date: '2026-04-17',
        index: 1,
        content: 'A similar reflection in another journal.',
        tags: ['semantic-match'],
        visibility: 'public',
        diaryId: 2,
      }],
    });

    await page.goto('/journal?diary=1');
    await page.getByRole('button', { name: 'Meaning' }).click();
    await page.getByPlaceholder('Search by meaning or idea...').fill('a healthier relationship with work');
    await page.keyboard.press('Enter');

    await expect.poll(() => state.lastAiSemanticSearchPayload).toEqual({
      query: 'a healthier relationship with work',
      diaryId: 1,
    });
    await expect(page.getByText('Closest matches: 2. Entries analyzed: 3.')).toBeVisible();
    await expect(page.getByText('I chose to leave consulting and make room for a calmer chapter.')).toBeVisible();
    await expect(page.getByText('Protecting evenings with my family matters more than another promotion.')).toBeVisible();
    await expect(page.getByText('The train arrived late after a rainy afternoon.')).toHaveCount(0);
    await expect(page.getByText('A similar reflection in another journal.')).toHaveCount(0);

    await page.getByRole('button', { name: 'Visibility' }).click();
    await expect(page.getByText('I chose to leave consulting and make room for a calmer chapter.')).toBeVisible();
    await expect(page.getByText('Protecting evenings with my family matters more than another promotion.')).toHaveCount(0);
  });
});
