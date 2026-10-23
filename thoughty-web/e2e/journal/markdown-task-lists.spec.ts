import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import { setupMockApp } from '../support/mockApp';

const errands = {
  id: 701,
  date: '2024-03-02',
  index: 1,
  content: 'Saturday errands\n\n- [ ] Call the bank\n- [x] Post the letter\n- [ ] Water the plants',
  tags: ['errands'],
  visibility: 'private' as const,
  format: 'markdown' as const,
  diaryId: 1,
};

test.describe('Markdown task lists', () => {
  test('ticks tasks from the journal, saves them, and keeps one revision for the run of ticks', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: [errands] });
    await page.goto('/journal');

    const card = page.locator('#entry-701');
    const call = card.getByRole('checkbox', { name: 'Call the bank' });
    const post = card.getByRole('checkbox', { name: 'Post the letter' });
    await expect(post).toBeChecked();

    await call.click();
    await expect(call).toBeChecked();
    await post.focus();
    await page.keyboard.press('Space');
    await expect(post).not.toBeChecked();
    await expect(post).toBeFocused();
    await card.getByRole('checkbox', { name: 'Water the plants' }).click();

    await expect.poll(() => state.entries[0]?.content)
      .toBe('Saturday errands\n\n- [x] Call the bank\n- [ ] Post the letter\n- [x] Water the plants');
    expect(state.taskRequests).toEqual([
      { entryId: 701, line: 2, checked: true },
      { entryId: 701, line: 3, checked: false },
      { entryId: 701, line: 4, checked: true },
    ]);
    expect(state.revisions[701]?.map((revision) => revision.content)).toEqual([errands.content]);

    await page.reload();
    await expect(card.getByRole('checkbox', { name: 'Call the bank' })).toBeChecked();
    await card.getByLabel('More actions').click();
    await page.getByRole('menuitem', { name: 'View history' }).click();
    await expect(card.getByText('Revision #1')).toBeVisible();
    await expect(card.getByText('Revision #2')).toHaveCount(0);
  });

  test('passes an accessibility scan with task boxes in an entry', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: [errands] });
    await page.goto('/journal');
    await expect(page.locator('#entry-701').getByRole('checkbox', { name: 'Call the bank' })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
  });

  test('writes a task list with the toolbar button and explains it in the Markdown help', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/journal');

    const form = page.locator('form').first();
    await page.getByTitle('Plain text - click to enable Markdown formatting').click();
    const taskListButton = form.getByRole('button', { name: 'Add a task list (ctrl + shift + c)' });
    await expect(taskListButton).toBeVisible();
    const text = page.getByPlaceholder("What's on your mind?");
    await text.fill('Buy bread');
    await text.selectText();
    await taskListButton.click();
    await expect(text).toHaveValue('- [ ] Buy bread');
    await form.getByText('Markdown help').click();
    await expect(form.getByText('a task, ticked off later right from the journal')).toBeVisible();
    await form.locator('input[placeholder="tags..."]').fill('errands');
    await form.locator('input[placeholder="tags..."]').press('Enter');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect.poll(() => state.entries[0]?.content).toBe('- [ ] Buy bread');
    await expect(page.locator('[id^="entry-"]').first().getByRole('checkbox', { name: 'Buy bread' })).not.toBeChecked();
  });

  test('names the toolbar button and the help in French', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' } });
    await page.goto('/journal');

    const form = page.locator('form').first();
    await page.getByTitle('Texte brut - cliquez pour activer le formatage Markdown').click();
    await expect(form.getByRole('button', { name: 'Ajouter une liste de tâches (ctrl + maj + c)' })).toBeVisible();
    await form.getByText('Aide Markdown').click();
    await expect(form.getByText('une tâche, à cocher ensuite directement dans le journal')).toBeVisible();
  });

  test('shows task boxes that cannot be ticked in the public feed', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [{ ...errands, visibility: 'public', userId: 2, authorUsername: 'Maya' }],
    });
    await page.goto('/feed');

    const card = page.locator('.feed-entry', { hasText: 'Saturday errands' });
    await expect(card.getByRole('checkbox', { name: 'Post the letter' })).toBeChecked();
    await expect(card.getByRole('checkbox', { name: 'Call the bank' })).toBeDisabled();
  });

  test('leaves plain-text entries as text', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: [{ ...errands, format: 'plain' }] });
    await page.goto('/journal');

    const card = page.locator('#entry-701');
    await expect(card.getByText('- [ ] Call the bank')).toBeVisible();
    await expect(card.getByRole('checkbox')).toHaveCount(0);
  });
});
