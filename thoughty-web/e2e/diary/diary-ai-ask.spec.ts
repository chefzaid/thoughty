import AxeBuilder from '../support/axe';
import { test, expect, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { mockDiary } from '../support/mockApp.diaries';

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
    // The journal-wide actions leave it out, as for AI off, and Get Inspired is not offered in its composer
    await expect(page.getByRole('button', { name: 'Discuss', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Meaning', exact: true })).toHaveCount(0);
    await expect(page.locator('#entry-102').getByTitle('Discuss with AI')).toHaveCount(0);

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
    const askingDiaries = diaries.map((diary) => (diary.id === 2 ? { ...diary, aiMode: 'ask' as const } : diary));
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
});
