import { test, expect } from '@playwright/test';
import { setupMockApp } from '../support/mockApp';

test.describe('AI writing assistance and entry chat', () => {
  test('rephrases a draft and discusses an entry with AI chat history', async ({ page }) => {
    const { state } = await setupMockApp(page, {
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
      ],
    });

    await page.goto('/journal');
    await page.getByPlaceholder("What's on your mind?").fill('this draft need polish');
    await page.getByRole('button', { name: 'Rephrase', exact: true }).click();

    await expect(page.getByPlaceholder("What's on your mind?")).toHaveValue('Corrected: this draft need polish');
    await expect.poll(() => state.lastAiFixPayload).toMatchObject({
      content: 'this draft need polish',
      mode: 'grammar',
    });

    await page.locator('#entry-101').getByTitle('Discuss with AI').click();
    await expect(page.getByRole('heading', { name: 'AI Chat' })).toBeVisible();
    await expect(page.getByText('Previously saved reflection prompt.')).toBeVisible();

    await page.getByPlaceholder('Ask something about this entry...').fill('What theme stands out?');
    await page.getByPlaceholder('Ask something about this entry...').press('Enter');

    await expect(page.getByText('This entry reflects a thoughtful focus on the day.')).toBeVisible();
    await expect.poll(() => state.lastAiChatPayload).toMatchObject({
      entryId: 101,
      entryContent: 'Private focus reflection for filtering',
    });
  });
});