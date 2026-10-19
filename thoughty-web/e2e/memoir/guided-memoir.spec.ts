import { expect, test } from '@playwright/test';

import { setupMockApp } from '../support/mockApp';

test.describe('Guided memoir', () => {
  test('starts the memoir in a new diary, answers this week’s question, and opens it in the journal', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/journal');
    await page.getByRole('button', { name: 'Memoir', exact: true }).click();

    await expect(page).toHaveURL(/\/memoir$/);
    await expect(page.getByRole('heading', { name: 'Your life story, written one week at a time' })).toBeVisible();
    await page.getByLabel('Diary name').fill('Grandpa’s story');
    await page.getByLabel('New question every').selectOption({ label: 'Sunday' });
    await page.getByRole('button', { name: 'Start my memoir' }).click();

    await expect.poll(() => state.memoir.lastStartPayload).toEqual(expect.objectContaining({
      diaryName: 'Grandpa’s story',
      emailEnabled: true,
      deliveryWeekday: 0,
    }));
    const week = page.getByRole('region', { name: 'This week’s question' });
    await expect(week.getByText('What did the home you grew up in look, sound, and smell like?')).toBeVisible();

    await week.getByRole('button', { name: 'Answer', exact: true }).click();
    await week.getByLabel('Your answer').fill('A narrow stone house with a fig tree outside my window.');
    await week.getByRole('button', { name: 'Save answer' }).click();

    await expect(page.getByText('Answer saved to your memoir.')).toBeVisible();
    await expect(page.getByText('1 of 3 questions answered').first()).toBeVisible();
    await expect(week.getByText(/You have answered this week’s question/)).toBeVisible();

    await week.getByRole('button', { name: 'Read in journal' }).click();
    await expect(page).toHaveURL(/\/journal\?entry=\d+/);
    await expect(page.getByText('A narrow stone house with a fig tree outside my window.')).toBeVisible();
  });

  test('answers by uploading a recording and turning it into text', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, memoirProgram: { diaryId: 2 } });
    let uploads = 0;
    await page.route('**/api/attachments/**', async (route) => {
      const url = route.request().url();
      if (url.endsWith('/upload')) {
        uploads += 1;
        await route.fulfill({ status: 201, json: { id: 41, original_filename: 'story.mp3', mimetype: 'audio/mpeg', size: 9 } });
        return;
      }
      if (url.endsWith('/41/transcribe')) {
        await route.fulfill({ status: 201, json: { transcript: 'We played marbles until dark.', transcribed_at: '2026-10-19T09:00:00.000Z', cached: false } });
        return;
      }
      await route.fallback();
    });

    await page.goto('/memoir');
    const list = page.getByRole('region', { name: 'All questions' });
    await list.getByRole('button', { name: 'Answer: What games did you play as a child, and who did you play them with?' }).click();
    const form = list.getByRole('form', { name: 'What games did you play as a child, and who did you play them with?' });
    await form.locator('input[type="file"]').setInputFiles({ name: 'story.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('mock audio') });
    await expect(form.getByText('Recording ready (story.mp3)')).toBeVisible();

    await form.getByRole('button', { name: 'Turn the recording into text' }).click();
    await expect(form.getByLabel('Your answer')).toHaveValue('We played marbles until dark.');
    await form.getByRole('button', { name: 'Save answer' }).click();

    await expect(page.getByText('Answer saved to your memoir.')).toBeVisible();
    expect(state.memoir.lastAnswerPayload).toEqual({
      questionId: 'childhood-play',
      text: 'We played marbles until dark.',
      attachmentIds: [41],
    });
    expect(uploads).toBe(1);
    await expect(list.getByRole('button', { name: 'Read in journal' })).toBeVisible();
  });

  test('swaps the question, pauses and resumes, and stops the memoir while keeping the answers', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, memoirProgram: { diaryId: 1 } });
    await page.goto('/memoir');

    const week = page.getByRole('region', { name: 'This week’s question' });
    await week.getByRole('button', { name: 'Another question' }).click();
    await expect(week.getByText('What games did you play as a child, and who did you play them with?')).toBeVisible();

    const settings = page.getByRole('region', { name: 'Memoir settings' });
    await settings.getByRole('button', { name: 'Pause weekly questions' }).click();
    await expect(page.getByText('Weekly questions are paused.')).toBeVisible();
    await settings.getByRole('button', { name: 'Resume weekly questions' }).click();
    await expect(page.getByText('Weekly questions are paused.')).toBeHidden();

    await settings.getByLabel('Email me each week’s question').uncheck();
    await settings.getByRole('button', { name: 'Save settings' }).click();
    await expect(settings.getByText('Settings saved.')).toBeVisible();
    expect(state.memoir.lastUpdatePayload).toEqual(expect.objectContaining({ emailEnabled: false, diaryId: 1 }));

    await settings.getByRole('button', { name: 'Stop the memoir' }).click();
    await expect(page.getByText(/Your answers stay in your journal/)).toBeVisible();
    await page.getByRole('button', { name: 'Stop the memoir' }).last().click();
    await expect(page.getByRole('heading', { name: 'Start your memoir' })).toBeVisible();
    expect(state.memoir.program).toBeNull();
  });

  test('opens the question from the weekly email link and leads to the book converter', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, memoirProgram: { diaryId: 1 } });
    await page.goto('/memoir?question=work-path');

    const form = page.getByRole('form', { name: 'How did you come to do the work you did for most of your life?' });
    await expect(form).toBeVisible();
    await form.getByLabel('Your answer').fill('By accident, through a summer job.');
    await form.getByRole('button', { name: 'Save answer' }).click();
    await expect(page.getByText('Answer saved to your memoir.')).toBeVisible();

    await page.getByRole('button', { name: 'Turn my memoir into a book' }).click();
    await expect(page).toHaveURL(/\/import-export\?diary=1&section=book/);
  });

  test('shows the memoir in French with weekday names and chapter titles', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' }, memoirProgram: { diaryId: 1 } });
    await page.goto('/memoir');

    const week = page.getByRole('region', { name: 'La question de la semaine' });
    await expect(week.getByText('Enfance', { exact: true })).toBeVisible();
    await expect(week.getByText('À quoi ressemblait la maison de votre enfance ?')).toBeVisible();
    await expect(week.getByText('Prochaine question : dimanche 25 octobre')).toBeVisible();
    await expect(page.getByLabel('Nouvelle question chaque').locator('option:checked')).toHaveText('dimanche');
  });

  test('fits a phone screen without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupMockApp(page, { startAuthenticated: true, memoirProgram: { diaryId: 1 } });
    await page.goto('/memoir');
    await page.getByRole('region', { name: 'This week’s question' }).getByRole('button', { name: 'Answer', exact: true }).click();

    await expect(page.getByRole('button', { name: 'Save answer' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
