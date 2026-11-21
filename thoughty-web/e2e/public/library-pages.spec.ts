import { expect, test } from '../support/test';
import { setupMockApp } from '../support/mockApp';

test.describe('Public memoir questions and journal templates', () => {
  test('a visitor reads the memoir questions and the templates, then signs up from them', async ({ page }) => {
    await setupMockApp(page);
    await page.goto('/');
    await page.getByRole('contentinfo').getByRole('link', { name: 'Memoir questions' }).click();

    await expect(page).toHaveURL(/\/memoir-questions$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Questions to ask your parents, and yourself.' })).toBeVisible();
    const year = page.getByRole('region', { name: 'A year of questions' });
    await expect(year).toContainText('3 questions, one a week, in the order of a life.');
    await expect(year.getByRole('region', { name: 'Childhood' }).getByRole('listitem')).toHaveText([
      'What did the home you grew up in look, sound, and smell like?',
      'What games did you play as a child, and who did you play them with?',
    ]);
    await expect(page.getByRole('region', { name: 'Themes to add' }).getByRole('region', { name: 'Migration' }))
      .toContainText('What do you remember of your first days in the new country?');
    await expect(page).toHaveTitle('Memoir questions to ask your parents, and yourself · Thoughty');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Every question of the Thoughty guided memoir/);

    await page.getByRole('link', { name: 'Keeping a daily journal instead? See the journal templates' }).click();
    await expect(page).toHaveURL(/\/journal-templates$/);
    const templates = page.getByRole('region', { name: 'Templates' });
    await expect(templates.getByRole('article', { name: 'Gratitude journal' })).toContainText('Today I am grateful for:');
    await expect(templates.getByRole('article', { name: 'Weekly review' }).getByRole('heading', { name: 'Wins' })).toBeVisible();
    await expect(page).toHaveTitle('Journal templates and prompts · Thoughty');

    await page.getByRole('button', { name: 'Start your journal' }).first().click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByText('Create your account')).toBeVisible();
    await expect(page).toHaveTitle('Thoughty');
  });

  test('a signed-in writer reads them in French and goes on to the memoir, on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' } });
    await page.goto('/memoir-questions');

    const year = page.getByRole('region', { name: 'Une année de questions' });
    await expect(year.getByRole('region', { name: 'Enfance' })).toContainText('À quels jeux jouiez-vous enfant, et avec qui ?');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Commencer vos mémoires' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Ouvrir vos mémoires' }).first().click();
    await expect(page).toHaveURL(/\/memoir$/);
    await expect(page.getByRole('form', { name: 'Commencer vos mémoires' })).toBeVisible();
  });
});
