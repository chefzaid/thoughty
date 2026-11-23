import AxeBuilder from '../support/axe';
import { setupMockApp } from '../support/mockApp';
import { expect, test } from '../support/test';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const QUESTION = 'What did the home you grew up in look, sound, and smell like?';

test.describe('Memoir interview mode', () => {
  for (const theme of ['dark', 'light'] as const) {
    test(`asks follow-up questions about the answer and answers one below it, in the ${theme} theme`, async ({ page }) => {
      const { state } = await setupMockApp(page, { startAuthenticated: true, config: { theme }, memoirProgram: { diaryId: 2 } });
      await page.goto('/memoir');

      const week = page.getByRole('region', { name: 'This week’s question' });
      await week.getByRole('button', { name: 'Answer', exact: true }).click();
      const form = week.getByRole('form', { name: QUESTION });
      const interview = form.getByRole('group', { name: 'Interview mode' });
      const ask = interview.getByRole('button', { name: 'Ask me follow-up questions' });
      await expect(ask).toHaveAttribute('aria-disabled', 'true');
      await expect(ask).toHaveAccessibleDescription('Write some of your answer first: the questions build only on what you wrote.');

      // An answer of a few words gives the questions nothing to build on yet
      const answer = form.getByLabel('Your answer');
      await answer.fill('A stone house.');
      await ask.click();
      await expect(interview.getByRole('status').filter({ hasText: 'Write a little more first' })).toBeVisible();

      await answer.fill('A narrow stone house with a fig tree outside my window.');
      await ask.click();
      const list = interview.getByRole('list', { name: 'To tell more' });
      await expect(list.getByRole('listitem')).toHaveText([/Who else was there with you\?/, /What did it sound and smell like\?/]);
      expect(state.memoir.lastFollowUpsPayload).toEqual({
        questionId: 'childhood-home',
        text: 'A narrow stone house with a fig tree outside my window.',
        asked: [],
      });

      const results = await new AxeBuilder({ page }).include('.memoir-follow-ups').withTags(WCAG).analyze();
      expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);

      await list.getByRole('button', { name: 'Answer this: What did it sound and smell like?' }).click();
      await expect(answer).toBeFocused();
      await expect(answer).toHaveValue('A narrow stone house with a fig tree outside my window.\n\n**What did it sound and smell like?**\n\n');
      await expect(list.getByRole('listitem')).toHaveCount(1);
      await page.keyboard.type('Bread baking and the sea.');

      // The next round asks other questions than those already offered
      await interview.getByRole('button', { name: 'Ask me other questions' }).click();
      await expect(list.getByRole('listitem')).toHaveText([/What happened next\?/, /What does it mean to you now\?/]);
      expect(state.memoir.lastFollowUpsPayload).toMatchObject({
        asked: ['Who else was there with you?', 'What did it sound and smell like?'],
      });

      await form.getByRole('button', { name: 'Save answer' }).click();
      await expect(page.getByText('Answer saved to your memoir.')).toBeVisible();
      expect(state.memoir.lastAnswerPayload).toEqual({
        questionId: 'childhood-home',
        text: 'A narrow stone house with a fig tree outside my window.\n\n**What did it sound and smell like?**\n\nBread baking and the sea.',
      });
    });
  }

  test('says why the questions cannot be asked without an AI key, in French', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' }, memoirProgram: { diaryId: 2 } });
    await page.route('**/api/memoir/follow-ups', (route) => route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: 400, code: 'AI_KEY_NOT_CONFIGURED', message: 'OpenRouter API key is not configured' }),
    }));
    await page.goto('/memoir');

    const week = page.getByRole('region', { name: 'La question de la semaine' });
    await week.getByRole('button', { name: 'Répondre', exact: true }).click();
    await week.getByLabel('Votre réponse').fill('Une maison étroite avec un figuier sous ma fenêtre.');
    const interview = week.getByRole('group', { name: 'Mode entretien' });
    await interview.getByRole('button', { name: 'Me poser des questions de relance' }).click();
    await expect(interview.getByRole('alert')).toHaveText('Aucune clé API OpenRouter n’est configurée. Ajoutez-en une dans votre profil pour utiliser l’IA.');
    await expect(week.getByLabel('Votre réponse')).toHaveValue('Une maison étroite avec un figuier sous ma fenêtre.');
  });

  test('is left out while AI is switched off', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, featureFlags: { ai: false }, memoirProgram: { diaryId: 2 } });
    await page.goto('/memoir');

    const week = page.getByRole('region', { name: 'This week’s question' });
    await week.getByRole('button', { name: 'Answer', exact: true }).click();
    await expect(week.getByLabel('Your answer')).toBeVisible();
    await expect(week.getByRole('group', { name: 'Interview mode' })).toHaveCount(0);
  });
});
