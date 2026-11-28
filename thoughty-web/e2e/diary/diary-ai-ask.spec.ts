import AxeBuilder from '../support/axe';
import { test, expect, type Page } from '../support/test';
import { discussEntry } from '../support/discuss';
import { setupMockApp } from '../support/mockApp';
import { mockDiary } from '../support/mockApp.diaries';
import { fulfillJson } from '../support/mockApp.route-utils';

const composer = (page: Page) => page.getByPlaceholder("What's on your mind?");
const consentDialog = (page: Page) => page.getByRole('dialog', { name: 'Send this to the AI?' });
const ASK_NOTE = 'This diary asks before each AI request, so the AI features that read many entries at once leave it out.';
const diaries = [
  mockDiary({ id: 1, name: 'Work', icon: '💼', isDefault: true }),
  mockDiary({ id: 2, name: 'Dreams', icon: '🌙' }),
];
const initialEntries = [
  { id: 101, date: '2024-04-18', index: 1, content: 'A plan for the launch', tags: ['work'], visibility: 'private' as const, diaryId: 1 },
  { id: 102, date: '2024-04-18', index: 2, content: 'A dream about the sea', tags: ['dreams'], visibility: 'private' as const, diaryId: 2 },
];
const askingDiaries = diaries.map((diary) => (diary.id === 2 ? { ...diary, aiMode: 'ask' as const } : diary));
const recording = { id: 9, original_filename: 'sea-dream.mp3', stored_filename: 'stored-sea-dream.mp3', mimetype: 'audio/mpeg', size: 8192 };
const axeViolations = async (page: Page, selector: string) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .include(selector)
    .analyze();
  return results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));
};

test.describe('A diary that asks before each AI request', () => {
  test('is set in Manage Diaries, and its composer shows exactly what Rephrase and Auto Tag send before sending it', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      config: { openRouterModel: 'openai/gpt-4o-mini' },
      diaries,
      initialEntries,
    });

    await page.goto('/diaries?from=journal');
    await page.locator('.diary-card', { hasText: 'Dreams' }).getByTitle('Edit').click();
    const editor = page.locator('.diary-card.editing');
    await editor.getByLabel('AI', { exact: true }).selectOption({ label: 'Ask each time' });
    await editor.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('.diary-card', { hasText: 'Dreams' }).getByText('AI asks first: each request shows what it sends')).toBeVisible();
    expect(state.diaries.find((diary) => diary.id === 2)).toEqual(expect.objectContaining({ aiMode: 'ask' }));

    await page.goto('/journal?diary=2');
    await expect(page.locator('#entry-102')).toContainText('A dream about the sea');
    // The journal-wide actions leave it out, as for AI off, and Get Inspired is not offered in its composer; an
    // entry's own chat stays, asking before each message
    await expect(page.getByRole('button', { name: 'Discuss', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Meaning', exact: true })).toHaveCount(0);
    await expect(page.locator('#entry-102').getByRole('button', { name: 'Discuss this entry' })).toBeVisible();

    // Cancelled: nothing is sent and the text stays
    await composer(page).fill('i dreamt of a boat');
    await page.getByRole('button', { name: 'Rephrase', exact: true }).click();
    const dialog = consentDialog(page);
    await expect(dialog.getByTestId('ai-consent-text')).toHaveText('i dreamt of a boat');
    await expect(dialog).toContainText('It goes to OpenRouter, for the model openai/gpt-4o-mini.');
    expect(await axeViolations(page, '[role="dialog"]')).toEqual([]);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(composer(page)).toHaveValue('i dreamt of a boat');
    expect(state.lastAiFixPayload).toBeNull();

    // Confirmed: sent once, with the consent
    await page.getByRole('button', { name: 'Rephrase', exact: true }).click();
    await consentDialog(page).getByRole('button', { name: 'Send' }).click();
    await expect(composer(page)).toHaveValue('Corrected: i dreamt of a boat');
    expect(state.lastAiFixPayload).toEqual({ content: 'i dreamt of a boat', mode: 'grammar', diaryId: 2, aiConsent: true });

    await page.getByRole('button', { name: 'Auto Tag' }).click();
    await expect(consentDialog(page).getByTestId('ai-consent-text')).toHaveText('Corrected: i dreamt of a boat');
    await expect(consentDialog(page)).toContainText('It goes to OpenRouter, for the model openai/gpt-4o-mini.');
    await page.keyboard.press('Escape');
    expect(state.lastAiSuggestionPayload).toBeNull();
    await page.getByRole('button', { name: 'Auto Tag' }).click();
    await consentDialog(page).getByRole('button', { name: 'Send' }).click();
    await expect.poll(() => state.lastAiSuggestionPayload).toEqual(expect.objectContaining({ diaryId: 2, aiConsent: true }));
  });

  test('shows what an entry’s summary sends, guidance included, and says why journal-wide readings leave it out', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, diaries: askingDiaries, initialEntries });
    await page.goto('/journal?diary=2');
    const entry = page.locator('#entry-102');
    await expect(entry).toContainText('A dream about the sea');

    await entry.getByLabel('More actions').click();
    await page.getByTitle('Summarize entry').click();
    const summary = page.getByRole('dialog', { name: 'Entry summary' });
    await summary.getByLabel('Emphasize').fill('the boat');
    await summary.getByRole('button', { name: 'Generate summary' }).click();
    const dialog = consentDialog(page);
    await expect(dialog.getByTestId('ai-consent-text')).toHaveText('A dream about the sea');
    await expect(dialog).toContainText('Emphasizethe boat');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    // Not sent, so nothing failed either
    await expect(summary.getByRole('alert')).toHaveCount(0);
    expect(state.lastAiSummaryPayload).toBeNull();

    await summary.getByRole('button', { name: 'Generate summary' }).click();
    await consentDialog(page).getByRole('button', { name: 'Send' }).click();
    await expect(summary).toContainText('A focused reflection led to a clear decision');
    expect(state.lastAiSummaryPayload).toEqual({ entryId: 102, includeDetails: 'the boat', aiConsent: true });
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Highlights' }).click();
    const week = page.getByRole('dialog', { name: 'Highlights' }).getByRole('region', { name: 'Your week' });
    await expect(week.getByRole('note')).toHaveText(ASK_NOTE);
  });

  test('asks before each message of an entry’s chat, showing the entry and the whole conversation', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      config: { theme: 'light', openRouterChatModel: 'anthropic/claude-haiku' },
      diaries: askingDiaries,
      initialEntries,
    });
    await page.goto('/journal?diary=2');
    await discussEntry(page.locator('#entry-102'), 'Discuss with AI');
    const chat = page.getByRole('dialog', { name: 'AI Chat' });
    await expect(chat.getByText('Previously saved reflection prompt.')).toBeVisible();
    const field = chat.getByLabel('Message to the AI');

    await field.fill('Why the sea?');
    await field.press('Enter');
    const dialog = consentDialog(page);
    await expect(dialog.getByTestId('ai-consent-text')).toHaveText('A dream about the sea');
    await expect(dialog.getByTestId('ai-consent-conversation').getByRole('listitem')).toHaveText([
      'AI: Previously saved reflection prompt.',
      'You: Why the sea?',
    ]);
    await expect(dialog).toContainText('It goes to OpenRouter, for the model anthropic/claude-haiku.');
    expect(await axeViolations(page, '[role="dialog"][aria-describedby]')).toEqual([]);

    // Cancelled: nothing is sent, and the message goes back to the field to change or send again
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(field).toHaveValue('Why the sea?');
    await expect(field).toBeFocused();
    expect(state.lastAiChatPayload).toBeNull();

    await field.press('Enter');
    await consentDialog(page).getByRole('button', { name: 'Send' }).click();
    await expect(chat.getByText('This entry reflects a thoughtful focus on the day.')).toBeVisible();
    expect(state.lastAiChatPayload).toEqual({
      entryId: 102,
      entryContent: 'A dream about the sea',
      messages: [
        { role: 'assistant', content: 'Previously saved reflection prompt.' },
        { role: 'user', content: 'Why the sea?' },
      ],
      aiConsent: true,
    });

    // The next message asks again, with the reply in the conversation
    await field.fill('What change?');
    await field.press('Enter');
    await expect(consentDialog(page).getByTestId('ai-consent-conversation').getByRole('listitem')).toHaveCount(4);
    await expect(consentDialog(page).getByRole('listitem').last()).toHaveText('You: What change?');
  });

  test('names the recording an entry’s transcription sends, and where it goes', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      diaries: askingDiaries,
      initialEntries: initialEntries.map((entry) => (entry.id === 102 ? { ...entry, attachments: [recording] } : entry)),
    });
    const transcribeBodies: unknown[] = [];
    await page.route('**/api/attachments/**', async (route) => {
      const request = route.request();
      if (request.url().endsWith('/9/transcribe') && request.method() === 'POST') {
        transcribeBodies.push(request.postDataJSON());
        await fulfillJson(route, { transcript: 'I was sailing at night.', transcribed_at: '2026-11-23T08:00:00.000Z', cached: false }, { status: 201 });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'audio/mpeg', body: 'mock audio' });
    });
    await page.goto('/journal?diary=2');
    const entry = page.locator('#entry-102');

    await entry.getByRole('button', { name: 'Transcribe audio' }).click();
    const dialog = consentDialog(page);
    await expect(dialog).toHaveAccessibleDescription('This diary asks before each AI request. This recording will be sent to be turned into text:');
    // The mock recording says no length, so only its name is shown
    await expect(dialog.getByTestId('ai-consent-recording')).toHaveText('sea-dream.mp3');
    await expect(dialog).toContainText('It goes to OpenRouter, for the speech-to-text model Thoughty uses.');
    expect(await axeViolations(page, '[role="dialog"]')).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(transcribeBodies).toEqual([]);

    await entry.getByRole('button', { name: 'Transcribe audio' }).click();
    await consentDialog(page).getByRole('button', { name: 'Send' }).click();
    await expect(entry.getByText('I was sailing at night.')).toBeVisible();
    expect(transcribeBodies).toEqual([{ aiConsent: true }]);
  });

  test('asks before the memoir’s follow-up questions and transcription in a memoir diary that asks each time', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      diaries: askingDiaries,
      memoirProgram: { diaryId: 2 },
      config: { openRouterPromptModel: 'openai/gpt-4o-mini' },
    });
    let uploads = 0;
    let transcribeBody: unknown = null;
    await page.route('**/api/attachments/**', async (route) => {
      const url = route.request().url();
      if (url.endsWith('/upload')) {
        uploads += 1;
        await fulfillJson(route, {
          id: 41, original_filename: 'story.mp3', stored_filename: 'story-41.mp3', mimetype: 'audio/mpeg', size: 9,
          entry_id: null, created_at: '2026-11-23T08:59:00.000Z', transcript: null, transcribed_at: null,
        }, { status: 201 });
        return;
      }
      if (url.endsWith('/41/transcribe')) {
        transcribeBody = route.request().postDataJSON();
        await fulfillJson(route, { transcript: 'We played marbles until dark.', transcribed_at: '2026-11-23T09:00:00.000Z', cached: false }, { status: 201 });
        return;
      }
      await route.fallback();
    });
    await page.goto('/memoir');
    const week = page.getByRole('region', { name: 'This week’s question' });
    await week.getByRole('button', { name: 'Answer', exact: true }).click();
    const form = week.getByRole('form', { name: 'What did the home you grew up in look, sound, and smell like?' });
    await form.getByLabel('Your answer').fill('A narrow stone house with a fig tree outside my window.');

    await form.getByRole('button', { name: 'Ask me follow-up questions' }).click();
    const dialog = consentDialog(page);
    await expect(dialog.getByTestId('ai-consent-text')).toHaveText('A narrow stone house with a fig tree outside my window.');
    await expect(dialog).toContainText('The questionWhat did the home you grew up in look, sound, and smell like?');
    await expect(dialog).toContainText('It goes to OpenRouter, for the model openai/gpt-4o-mini.');
    expect(await axeViolations(page, '[role="dialog"]')).toEqual([]);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    expect(state.memoir.lastFollowUpsPayload).toBeNull();

    await form.getByRole('button', { name: 'Ask me follow-up questions' }).click();
    await consentDialog(page).getByRole('button', { name: 'Send' }).click();
    await expect(form.getByRole('list', { name: 'To tell more' }).getByRole('listitem')).toHaveCount(2);
    expect(state.memoir.lastFollowUpsPayload).toEqual({
      questionId: 'childhood-home',
      text: 'A narrow stone house with a fig tree outside my window.',
      asked: [],
      aiConsent: true,
    });

    await form.locator('input[type="file"]').setInputFiles({ name: 'story.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('mock audio') });
    await form.getByRole('button', { name: 'Turn the recording into text' }).click();
    await expect(consentDialog(page).getByTestId('ai-consent-recording')).toHaveText('story.mp3');
    await consentDialog(page).getByRole('button', { name: 'Cancel' }).click();
    // Cancelled before the upload: the recording stays on this device
    expect(uploads).toBe(0);

    await form.getByRole('button', { name: 'Turn the recording into text' }).click();
    await consentDialog(page).getByRole('button', { name: 'Send' }).click();
    await expect(form.getByLabel('Your answer')).toHaveValue(/We played marbles until dark\.$/);
    expect(transcribeBody).toEqual({ diaryId: 2, aiConsent: true });
    expect(uploads).toBe(1);
  });
});
