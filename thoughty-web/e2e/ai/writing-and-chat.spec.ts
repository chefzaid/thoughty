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

  test('summarizes an entry with include and exclude guidance', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [
        {
          id: 102,
          date: '2024-04-19',
          index: 1,
          content: 'A long reflection about a project decision and the people involved.',
          tags: ['decision'],
          visibility: 'private',
          diaryId: 1,
        },
      ],
    });

    await page.goto('/journal');
    const entry = page.locator('#entry-102');
    await entry.getByLabel('More actions').click();
    await entry.getByRole('menuitem', { name: 'Summarize entry' }).click();

    const dialog = page.getByRole('dialog', { name: 'Entry summary' });
    await expect(dialog).toBeVisible();
    const dialogBounds = await dialog.boundingBox();
    expect(dialogBounds).not.toBeNull();
    expect(dialogBounds!.x).toBeGreaterThanOrEqual(0);
    expect(dialogBounds!.x + dialogBounds!.width).toBeLessThanOrEqual(390);
    expect(dialogBounds!.y + dialogBounds!.height).toBeLessThanOrEqual(844);
    await dialog.getByLabel('Emphasize').fill('the project decision');
    await dialog.getByLabel('Leave out').fill('names');
    await dialog.getByRole('button', { name: 'Generate summary' }).click();

    await expect(dialog.getByText('A focused reflection led to a clear decision while leaving names private.')).toBeVisible();
    await expect.poll(() => state.lastAiSummaryPayload).toEqual({
      entryId: 102,
      includeDetails: 'the project decision',
      excludeDetails: 'names',
    });
  });
});
