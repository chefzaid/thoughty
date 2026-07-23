import { expect, test } from '@playwright/test';
import { setupMockApp } from '../support/mockApp';

test.describe('Feature request board', () => {
  test('lets visitors browse ideas and routes voting through sign in', async ({ page }) => {
    await setupMockApp(page);
    await page.goto('/feedback');

    await expect(page.getByRole('heading', { name: 'Offline writing mode' })).toBeVisible();
    await page.getByRole('button', { name: 'Sign in to vote for Mood calendar' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('Welcome back')).toBeVisible();
  });

  test('persists authenticated submissions and votes on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/feedback');

    await page.getByLabel('Idea title').fill('Journal map');
    await page
      .getByLabel('What would this improve?')
      .fill('Connect related journal ideas and recurring themes.');
    await page.getByRole('button', { name: 'Post idea' }).click();

    await expect(page.getByRole('heading', { name: 'Journal map' })).toBeVisible();
    await expect.poll(() => state.lastFeatureRequestPayload).toEqual({
      title: 'Journal map',
      details: 'Connect related journal ideas and recurring themes.',
    });

    const moodIdea = page.getByRole('heading', { name: 'Mood calendar' }).locator('..').locator('..');
    await moodIdea.getByRole('button', { name: 'Vote for Mood calendar' }).click();
    await expect(moodIdea.getByRole('button')).toContainText('13');
    expect(state.featureRequestVotes).toContain(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });
});
