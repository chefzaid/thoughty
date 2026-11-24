import AxeBuilder from '../support/axe';
import { test, expect, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { mockDiary } from '../support/mockApp.diaries';
import { HTTPS_MODEL_URL, LOCAL_MODEL_URL, routeLocalModelServer } from '../support/localModelServer';

const composer = (page: Page) => page.getByPlaceholder("What's on your mind?");
const LOCAL_NOTE = 'This diary uses only your own AI model, so Thoughty’s AI features that read many entries at once leave it out.';
const diaries = [
  mockDiary({ id: 1, name: 'Work', icon: '💼', isDefault: true }),
  mockDiary({ id: 2, name: 'Letters', icon: '✉️' }),
];
const localDiaries = diaries.map((diary) => (diary.id === 2 ? { ...diary, aiMode: 'local' as const } : diary));
const initialEntries = [
  { id: 101, date: '2024-04-18', index: 1, content: 'A plan for the launch', tags: ['work'], visibility: 'private' as const, diaryId: 1 },
  { id: 102, date: '2024-04-18', index: 2, content: 'A letter to my sister', tags: ['family'], visibility: 'private' as const, diaryId: 2 },
];

/** Sets up the writer's own model in Profile › AI Configuration, as this browser keeps it. */
async function setUpLocalModel(page: Page, model = 'llama3.2', address = LOCAL_MODEL_URL) {
  await page.goto('/profile');
  const panel = page.getByRole('region', { name: 'Your own model' });
  await panel.getByLabel('Server address').fill(address);
  await panel.getByLabel('Model', { exact: true }).fill(model);
  return panel;
}

/** Sets up and saves the writer's model server behind https, elsewhere on their network. */
async function saveHttpsModel(page: Page) {
  const panel = await setUpLocalModel(page, 'llama3.2', HTTPS_MODEL_URL);
  await panel.getByRole('button', { name: 'Save model server' }).click();
  await expect(panel.getByText('Saved in this browser.')).toBeVisible();
}

const chatKeys = (page: Page) => page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('thoughty.localModelChat.')));

test.describe('A diary on the writer’s own model', () => {
  test('is set in Manage Diaries, and its Rephrase and Auto Tag go from the browser to that model, never to Thoughty', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, diaries, initialEntries });
    const { chatRequests } = await routeLocalModelServer(page);

    await page.goto('/diaries?from=journal');
    await page.locator('.diary-card', { hasText: 'Letters' }).getByTitle('Edit').click();
    const editor = page.locator('.diary-card.editing');
    await editor.getByLabel('AI', { exact: true }).selectOption({ label: 'My own model only' });
    await editor.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('.diary-card', { hasText: 'Letters' }).getByText('Your own model only: Thoughty’s AI never reads this diary')).toBeVisible();
    expect(state.diaries.find((diary) => diary.id === 2)).toEqual(expect.objectContaining({ aiMode: 'local' }));

    // Not set up on this browser yet: nothing is sent anywhere, and the composer says where to set it up
    await page.goto('/journal?diary=2');
    await composer(page).fill('dear sis, i miss you');
    await page.getByRole('button', { name: 'Rephrase', exact: true }).click();
    await expect(page.getByText('This diary uses only your own model. Set up its address in Profile › AI Configuration first.')).toBeVisible();
    expect(chatRequests).toHaveLength(0);

    const panel = await setUpLocalModel(page);
    await panel.getByRole('button', { name: 'Test connection' }).click();
    await expect(panel.getByText('Connected: llama3.2 is ready on your server.')).toBeVisible();
    await panel.getByRole('button', { name: 'Save model server' }).click();
    await expect(panel.getByText('Saved in this browser.')).toBeVisible();

    await page.goto('/journal?diary=2');
    await expect(page.locator('#entry-102')).toContainText('A letter to my sister');
    // The journal-wide actions leave it out
    await expect(page.getByRole('button', { name: 'Discuss', exact: true })).toHaveCount(0);

    await composer(page).fill('dear sis, i miss you');
    await page.getByRole('button', { name: 'Rephrase', exact: true }).click();
    await expect(composer(page)).toHaveValue('Fixed locally: dear sis, i miss you');
    await page.getByRole('button', { name: 'Auto Tag' }).click();
    await expect(page.locator('.truncate').filter({ hasText: /^letters$/ })).toBeVisible();
    await expect(page.locator('.truncate').filter({ hasText: /^family$/ })).toBeVisible();

    expect(chatRequests.map((request) => request.model)).toEqual(['llama3.2', 'llama3.2']);
    expect(chatRequests[0]?.messages[1]?.content).toBe('<text>\ndear sis, i miss you\n</text>');
    expect(state.lastAiFixPayload).toBeNull();
    expect(state.lastAiSuggestionPayload).toBeNull();
  });

  test('summarizes an entry on that model, and says why the journal-wide readings leave it out', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, diaries: localDiaries, initialEntries });
    const { chatRequests } = await routeLocalModelServer(page);
    const panel = await setUpLocalModel(page);
    await panel.getByRole('button', { name: 'Save model server' }).click();

    await page.goto('/journal?diary=2');
    const entry = page.locator('#entry-102');
    await entry.getByLabel('More actions').click();
    await page.getByTitle('Summarize entry').click();
    const summary = page.getByRole('dialog', { name: 'Entry summary' });
    await summary.getByRole('button', { name: 'Generate summary' }).click();
    await expect(summary).toContainText('A letter to my sister, summarized on this device.');
    expect(JSON.parse(chatRequests[0]?.messages[1]?.content ?? '{}')).toEqual({ includeDetails: null, excludeDetails: null, entry: 'A letter to my sister' });
    expect(state.lastAiSummaryPayload).toBeNull();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Highlights' }).click();
    const week = page.getByRole('dialog', { name: 'Highlights' }).getByRole('region', { name: 'Your week' });
    await expect(week.getByRole('note')).toHaveText(LOCAL_NOTE);
  });

  test('Test connection says how to allow the app, and which models the server has', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, diaries: localDiaries, initialEntries });
    await routeLocalModelServer(page, { allowsApp: false });
    const panel = await setUpLocalModel(page);

    await panel.getByRole('button', { name: 'Test connection' }).click();
    await expect(panel.getByText(/answered but does not allow this site.*set OLLAMA_ORIGINS to it/)).toBeVisible();
    await expect(panel.getByText('This site’s address to allow: http://localhost:5173')).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).include('.local-model-panel').analyze();
    expect(results.violations.map(({ id }) => id)).toEqual([]);

    await page.unroute(`${LOCAL_MODEL_URL}/**`);
    await routeLocalModelServer(page, { models: ['mistral:latest', 'phi3:latest'] });
    await panel.getByRole('button', { name: 'Test connection' }).click();
    await expect(panel.getByText(/does not have this model/)).toBeVisible();
    await expect(panel.getByText('Models on your server: mistral:latest, phi3:latest')).toBeVisible();

    // Plain http to another device is refused; the same server behind https is reached
    await panel.getByLabel('Server address').fill('http://192.168.1.20:11434/v1');
    await panel.getByRole('button', { name: 'Test connection' }).click();
    await expect(panel.getByText(/Plain http only works for a server on this device/)).toBeVisible();
    await routeLocalModelServer(page, { baseUrl: HTTPS_MODEL_URL });
    await panel.getByLabel('Server address').fill(`${HTTPS_MODEL_URL}/`);
    await panel.getByLabel('Model', { exact: true }).fill('llama3.2');
    await panel.getByRole('button', { name: 'Test connection' }).click();
    await expect(panel.getByText('Connected: llama3.2 is ready on your server.')).toBeVisible();
  });

  test('chats about an entry on that model, keeping the chat in this browser only until sign-out', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, diaries: localDiaries, initialEntries });
    const { chatRequests } = await routeLocalModelServer(page, { baseUrl: HTTPS_MODEL_URL });
    await saveHttpsModel(page);

    await page.goto('/journal?diary=2');
    await page.locator('#entry-102').getByTitle('Discuss with AI').click();
    const chat = page.getByRole('dialog', { name: 'AI Chat' });
    await expect(chat.getByRole('note')).toHaveText(/This chat goes to your own model and is kept only in this browser/);
    await chat.getByPlaceholder('Ask something about this entry...').fill('Why do I write to her?');
    await chat.getByPlaceholder('Ask something about this entry...').press('Enter');
    await expect(chat.getByText('My model hears you: Why do I write to her?')).toBeVisible();
    expect(chatRequests[0]?.messages[0]?.content).toContain('<journal_entry>\nA letter to my sister\n</journal_entry>');
    expect(state.lastAiChatPayload).toBeNull();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).include('[role="dialog"]').analyze();
    expect(results.violations.map(({ id }) => id)).toEqual([]);

    // Opened again, the chat comes from this browser, never from Thoughty's server
    await page.keyboard.press('Escape');
    await page.locator('#entry-102').getByTitle('Discuss with AI').click();
    await expect(chat.getByText('My model hears you: Why do I write to her?')).toBeVisible();
    await expect(chat.getByText('Previously saved reflection prompt.')).toHaveCount(0);
    expect(await chatKeys(page)).toHaveLength(1);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(await chatKeys(page)).toEqual([]);
  });

  test('tags a saved entry with that model, and asks it for Get Inspired from the diary’s tags', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, diaries: localDiaries, initialEntries, config: { autoTagMaxTags: '2' } });
    const { chatRequests } = await routeLocalModelServer(page);
    const panel = await setUpLocalModel(page);
    await panel.getByRole('button', { name: 'Save model server' }).click();

    await page.goto('/journal?diary=2');
    await composer(page).fill('Another letter, about the summer we spent by the lake');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => state.entries.find((entry) => entry.content.startsWith('Another letter'))?.tags).toEqual(['family', 'letters']);
    expect(state.lastBulkPayload).toMatchObject({ action: 'tags', tags: ['family', 'letters'] });
    expect(state.lastAiSuggestionPayload).toBeNull();

    await page.getByRole('button', { name: 'Get Inspired' }).click();
    const inspiration = page.getByRole('dialog', { name: 'Get Inspired' });
    await expect(inspiration.getByText('What would you write to your sister today?')).toBeVisible();
    const request = chatRequests.at(-1);
    expect(JSON.parse(request?.messages[1]?.content ?? '{}')).toEqual({
      themes: [{ tag: 'family', count: 2 }, { tag: 'letters', count: 1 }],
      recentThemes: ['family', 'letters'],
    });
    expect(state.lastAiInspirationPayload).toBeNull();
    await inspiration.getByRole('button', { name: 'Write about this' }).click();
    await expect(composer(page)).toHaveValue('What would you write to your sister today?');
  });

  test('rephrases selected entries of that diary there, and asks the memoir’s follow-ups there', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, diaries: localDiaries, initialEntries, memoirProgram: { diaryId: 2 } });
    const { chatRequests } = await routeLocalModelServer(page);
    const panel = await setUpLocalModel(page);
    await panel.getByRole('button', { name: 'Save model server' }).click();

    await page.goto('/journal?diary=2');
    await page.getByRole('button', { name: 'Select' }).click();
    await page.locator('#entry-102 input[type="checkbox"]').check();
    await page.locator('button[aria-expanded]', { hasText: /^Rephrase$/ }).click();
    await page.getByRole('button', { name: 'Grammar/form only' }).click();
    await expect.poll(() => state.entries.find((entry) => entry.id === 102)?.content).toBe('Fixed locally: A letter to my sister');
    expect(state.lastAiFixPayload).toBeNull();

    await page.goto('/memoir');
    const week = page.getByRole('region', { name: 'This week’s question' });
    await week.getByRole('button', { name: 'Answer', exact: true }).click();
    const interview = week.getByRole('group', { name: 'Interview mode' });
    await week.getByLabel('Your answer').fill('My grandmother sang in the kitchen every morning.');
    await interview.getByRole('button', { name: 'Ask me follow-up questions' }).click();
    await expect(interview.getByRole('list', { name: 'To tell more' }).getByRole('listitem')).toHaveText([/What did the kitchen smell like\?/, /Who sang with her\?/]);
    expect(chatRequests.at(-1)?.messages[1]?.content).toContain('<memoir_answer>\nMy grandmother sang in the kitchen every morning.\n</memoir_answer>');
    expect(state.memoir.lastFollowUpsPayload).toBeNull();
  });
});
