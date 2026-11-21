import { expect, test } from '../support/test';

import { setupMockApp } from '../support/mockApp';

test.describe('Memoir themes', () => {
  test('starts the memoir with a theme added to the year of questions', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/memoir');

    await expect(page.getByText('3 questions in 2 chapters')).toBeVisible();
    const themes = page.getByRole('group', { name: 'Themes to add' });
    await expect(themes).toHaveAccessibleDescription(/Each theme adds its questions to your weekly ones/);
    await themes.getByRole('checkbox', { name: 'Migration 1 question' }).check();
    await expect(page.getByText('4 questions in 3 chapters')).toBeVisible();
    await page.getByRole('button', { name: 'Start my memoir' }).click();

    await expect.poll(() => state.memoir.lastStartPayload).toEqual(expect.objectContaining({ themes: ['migration'] }));
    const list = page.getByRole('region', { name: 'All questions' });
    await expect(list.getByRole('heading', { name: 'Migration' })).toBeVisible();
    await expect(list.getByText('What do you remember of your first days in the new country?')).toBeVisible();
    await expect(page.getByText('0 of 4 questions answered').first()).toBeVisible();
    await expect(page.getByRole('region', { name: 'Memoir settings' }).getByRole('checkbox', { name: /^Migration/ })).toBeChecked();
  });

  test('leaving a theme out takes its question off the week and the list at once', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      memoirProgram: { diaryId: 1, themes: ['migration'], currentQuestionId: 'migration-first-days' },
    });
    await page.goto('/memoir');

    const week = page.getByRole('region', { name: 'This week’s question' });
    await expect(week.getByText('What do you remember of your first days in the new country?')).toBeVisible();
    const settings = page.getByRole('region', { name: 'Memoir settings' });
    await settings.getByRole('checkbox', { name: /^Migration/ }).uncheck();
    await settings.getByRole('button', { name: 'Save settings' }).click();

    await expect(settings.getByText('Settings saved.')).toBeVisible();
    expect(state.memoir.lastUpdatePayload).toEqual(expect.objectContaining({ themes: [] }));
    // The week goes on from the theme's place in life order, wrapping round to the start of the year
    await expect(week.getByText('What did the home you grew up in look, sound, and smell like?')).toBeVisible();
    await expect(page.getByRole('region', { name: 'All questions' }).getByRole('heading', { name: 'Migration' })).toHaveCount(0);
  });

  test('offers the themes in French', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' } });
    await page.goto('/memoir');

    const themes = page.getByRole('group', { name: 'Thèmes à ajouter' });
    await expect(themes.getByRole('checkbox', { name: 'Migration 1 question' })).not.toBeChecked();
    await expect(themes).toHaveAccessibleDescription(/Chaque thème ajoute ses questions/);
  });
});
