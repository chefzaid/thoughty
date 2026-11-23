import AxeBuilder from '../support/axe';
import { test, expect, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { mockDiary } from '../support/mockApp.diaries';

const composer = (page: Page) => page.getByPlaceholder("What's on your mind?");
const diaries = [
  mockDiary({ id: 1, name: 'Work', icon: '💼', isDefault: true }),
  mockDiary({ id: 2, name: 'Health', icon: '🩺' }),
];
const axeViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .include('.diary-manager')
    .analyze();
  return results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));
};
const initialEntries = [
  { id: 101, date: '2024-04-18', index: 1, content: 'A plan for the launch', tags: ['work'], visibility: 'private' as const, diaryId: 1 },
  { id: 102, date: '2024-04-18', index: 2, content: 'A visit to the clinic', tags: ['health'], visibility: 'private' as const, diaryId: 2 },
];

test.describe('Diary AI mode', () => {
  test('turns AI off for a diary in Manage Diaries, and the journal offers no AI action in it', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, diaries, initialEntries });

    await page.goto('/diaries?from=journal');
    await page.locator('.diary-card', { hasText: 'Health' }).getByTitle('Edit').click();
    const editor = page.locator('.diary-card.editing');
    await expect(editor.getByLabel('AI', { exact: true })).toHaveValue('on');
    await editor.getByLabel('AI', { exact: true }).selectOption({ label: 'Off' });
    // The edit form, its name field and AI field included
    await expect(editor.getByRole('textbox', { name: 'Diary Name' })).toHaveValue('Health');
    expect(await axeViolations(page)).toEqual([]);
    await editor.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('.diary-card', { hasText: 'Health' }).getByText('AI off: no AI feature reads this diary')).toBeVisible();
    // The new diary form's AI field and the cards' summaries
    expect(await axeViolations(page)).toEqual([]);
    await expect(page.locator('.diary-card', { hasText: 'Work' }).getByText('AI off: no AI feature reads this diary')).toHaveCount(0);
    expect(state.diaries.find((diary) => diary.id === 2)).toEqual(expect.objectContaining({ aiMode: 'off' }));

    // In the diary with AI off: no AI button in the composer, none on its entries
    await page.goto('/journal?diary=2');
    await expect(page.locator('#entry-102')).toContainText('A visit to the clinic');
    await composer(page).fill('A note for the doctor');
    await expect(page.getByRole('button', { name: 'Rephrase', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Auto Tag' })).toHaveCount(0);
    await expect(page.locator('#entry-102').getByTitle('Discuss with AI')).toHaveCount(0);

    // The other diary keeps them
    await page.getByTitle('Work', { exact: true }).click();
    await expect(page.locator('#entry-101')).toContainText('A plan for the launch');
    await expect(page.getByRole('button', { name: 'Rephrase', exact: true })).toBeVisible();
    await expect(page.locator('#entry-101').getByTitle('Discuss with AI')).toBeVisible();

    // Turned off elsewhere while this page still offers Rephrase: the text names its diary, and the API refuses it
    state.diaries.find((diary) => diary.id === 1)!.aiMode = 'off';
    await composer(page).fill('Launch notes to tidy');
    await page.getByRole('button', { name: 'Rephrase', exact: true }).click();
    await expect(page.getByText('Unable to fix writing. Check your OpenRouter API key and try again.')).toBeVisible();
    await expect(composer(page)).toHaveValue('Launch notes to tidy');
    expect(state.lastAiFixPayload).toEqual({ content: 'Launch notes to tidy', mode: 'grammar', diaryId: 1 });
  });
});
