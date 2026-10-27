import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';

const entry = {
  id: 801,
  date: '2024-05-04',
  index: 1,
  content: 'A short note to finish later',
  tags: ['notes'],
  visibility: 'private' as const,
  diaryId: 1,
};

/** How far the caret line (the last line, with the caret at the end) is from the middle of the textarea. */
const caretDistanceFromMiddle = (page: Page) => page.getByRole('textbox', { name: 'Entry text' }).evaluate((area: HTMLTextAreaElement) => {
  const style = getComputedStyle(area);
  const lineHeight = Number.parseFloat(style.lineHeight);
  const lastLineMiddle = area.scrollHeight - Number.parseFloat(style.paddingBottom) - lineHeight / 2;
  return Math.abs(lastLineMiddle - area.scrollTop - area.clientHeight / 2) / lineHeight;
});

/** How far the top of the people list is below the bottom of the caret line (the last line), in pixels. */
const listGapBelowCaretLine = (page: Page) => page.getByRole('textbox', { name: 'Entry text' }).evaluate((area: HTMLTextAreaElement) => {
  const style = getComputedStyle(area);
  const lastLineBottom = area.scrollHeight - Number.parseFloat(style.paddingBottom) - area.scrollTop;
  const list = document.querySelector('[role="listbox"]');
  return list ? list.getBoundingClientRect().top - area.getBoundingClientRect().top - lastLineBottom : Number.NaN;
});

const mentioningEntries = [
  { id: 811, date: '2024-05-02', index: 1, content: 'Coffee with @Marie', tags: ['life'], visibility: 'private' as const, diaryId: 1 },
  { id: 812, date: '2024-05-01', index: 1, content: 'A walk with @MarieC and @Paul', tags: ['life'], visibility: 'private' as const, diaryId: 1 },
];

test.describe('Focus mode', () => {
  test('writes full screen with typewriter scrolling and a session goal, and keeps the draft on leaving', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/journal');

    const form = page.locator('form').first();
    await form.locator('textarea').fill('Before focus.');
    await form.getByRole('button', { name: 'Write in focus mode (Ctrl+Shift+F)' }).click();

    const dialog = page.getByRole('dialog', { name: 'Focus mode' });
    const text = dialog.getByRole('textbox', { name: 'Entry text' });
    await expect(text).toBeFocused();
    await expect(dialog.getByText('2 words')).toBeVisible();
    await dialog.getByLabel('Session goal in words').fill('5');
    await text.focus();
    await page.keyboard.press('End');
    for (let line = 1; line <= 30; line += 1) {
      await page.keyboard.type(` line ${line}`);
      await page.keyboard.press('Enter');
    }

    await expect(dialog.getByText('62 words')).toBeVisible();
    await expect(dialog.getByRole('progressbar', { name: 'Progress toward the session goal' })).toHaveAttribute('aria-valuenow', '5');
    await expect(dialog.locator('.focus-mode-reached')).toHaveText('Session goal reached');
    await expect.poll(() => text.evaluate((area) => area.scrollTop)).toBeGreaterThan(0);
    expect(await caretDistanceFromMiddle(page)).toBeLessThan(1.5);

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(form.getByRole('button', { name: 'Write in focus mode (Ctrl+Shift+F)' })).toBeFocused();
    await expect(form.locator('textarea')).toHaveValue(/^Before focus\. line 1\n line 2\n/);

    await form.locator('input[placeholder="tags..."]').fill('focus');
    await form.locator('input[placeholder="tags..."]').press('Enter');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => state.entries[0]?.content).toContain('line 30');
  });

  test('suggests people after @ under the caret line, with the composer keyboard, while typewriter scrolling', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: mentioningEntries });
    await page.goto('/journal');
    await expect(page.locator('#entry-811')).toBeVisible();

    const form = page.locator('form').first();
    await form.getByRole('button', { name: 'Write in focus mode (Ctrl+Shift+F)' }).click();
    const dialog = page.getByRole('dialog', { name: 'Focus mode' });
    const text = dialog.getByRole('textbox', { name: 'Entry text' });
    for (let line = 1; line <= 30; line += 1) {
      await page.keyboard.type(`line ${line}`);
      await page.keyboard.press('Enter');
    }
    await page.keyboard.type('Dinner with @mar');

    const suggestions = dialog.getByRole('listbox', { name: 'People to mention' });
    await expect(suggestions.getByRole('option')).toHaveText([/^Marie@marie1 entry$/, /^MarieC@mariec1 entry$/]);
    await expect(text).toHaveAttribute('aria-activedescendant', await suggestions.getByRole('option').first().getAttribute('id') ?? '');
    await expect(dialog.getByRole('status').filter({ hasText: '2 people to mention' })).toBeAttached();
    expect(await caretDistanceFromMiddle(page)).toBeLessThan(1.5);
    await expect.poll(() => listGapBelowCaretLine(page)).toBeGreaterThanOrEqual(0);
    expect(await listGapBelowCaretLine(page)).toBeLessThan(12);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .include('.focus-mode')
      .analyze();
    expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);

    await page.keyboard.press('ArrowDown');
    await expect(text).toHaveAttribute('aria-activedescendant', await suggestions.getByRole('option').nth(1).getAttribute('id') ?? '');
    await page.keyboard.press('Enter');
    await expect(text).toHaveValue(/line 30\nDinner with @MarieC $/);
    await expect(suggestions).toHaveCount(0);
    expect(await caretDistanceFromMiddle(page)).toBeLessThan(1.5);

    // Escape closes the list first and focus mode after; Tab writes the person and keeps the caret in the text
    await page.keyboard.type('and @pa');
    await expect(suggestions.getByRole('option')).toHaveText([/^Paul@paul1 entry$/]);
    await page.keyboard.press('Escape');
    await expect(suggestions).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await page.keyboard.type(' or @pau');
    await page.keyboard.press('Tab');
    await expect(text).toHaveValue(/Dinner with @MarieC and @pa or @Paul $/);
    await expect(text).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(form.locator('textarea')).toHaveValue(/Dinner with @MarieC and @pa or @Paul $/);

    await form.locator('input[placeholder="tags..."]').fill('people');
    await form.locator('input[placeholder="tags..."]').press('Enter');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => state.entries.find((saved) => saved.content.includes('Dinner with'))?.content).toMatch(/@MarieC and @pa or @Paul $/);
    await expect(page.locator('[id^="entry-"]').filter({ hasText: 'Dinner with' }).getByRole('link', { name: '@Paul' })).toBeVisible();
  });

  test('keeps the people list under the caret line as smooth typewriter scrolling settles, and picks with the pointer', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: mentioningEntries, config: { theme: 'light' } });
    await page.goto('/journal');
    await expect(page.locator('#entry-811')).toBeVisible();

    await page.locator('form').first().getByRole('button', { name: 'Write in focus mode (Ctrl+Shift+F)' }).click();
    const dialog = page.getByRole('dialog', { name: 'Focus mode' });
    const text = dialog.getByRole('textbox', { name: 'Entry text' });
    await text.fill(Array.from({ length: 40 }, (_, line) => `line ${line + 1}`).join('\n'));
    await page.keyboard.press('End');
    await page.keyboard.type(' with @Mar');

    const suggestions = dialog.getByRole('listbox', { name: 'People to mention' });
    await expect(suggestions.getByRole('option')).toHaveCount(2);
    await expect.poll(() => caretDistanceFromMiddle(page)).toBeLessThan(1.5);
    await expect.poll(() => listGapBelowCaretLine(page)).toBeGreaterThanOrEqual(0);
    expect(await listGapBelowCaretLine(page)).toBeLessThan(12);

    await suggestions.getByRole('option', { name: /^Marie@marie/ }).click();
    await expect(text).toHaveValue(/line 40 with @Marie $/);
    await expect(text).toBeFocused();
  });

  test('opens for the entry being edited with Ctrl+Shift+F and leaves with it again', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: [entry] });
    await page.goto('/journal');

    const card = page.locator('#entry-801');
    await card.getByRole('button', { name: 'Edit' }).click();
    await card.locator('textarea').focus();
    await page.keyboard.press('Control+Shift+F');

    const dialog = page.getByRole('dialog', { name: 'Focus mode' });
    const text = dialog.getByRole('textbox', { name: 'Entry text' });
    await expect(text).toHaveValue('A short note to finish later');
    await page.keyboard.type(', finished in focus mode.');
    await page.keyboard.press('Control+Shift+F');
    await expect(dialog).toHaveCount(0);

    await card.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => state.entries[0]?.content).toBe('A short note to finish later, finished in focus mode.');
  });

  test('opens the composer focus mode with the shortcut from anywhere in the journal', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: [entry] });
    await page.goto('/journal');
    await expect(page.locator('#entry-801')).toBeVisible();

    await page.keyboard.press('Control+Shift+F');
    await expect(page.getByRole('dialog', { name: 'Focus mode' }).getByRole('textbox', { name: 'Entry text' })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`passes an accessibility scan in the ${theme} theme with a goal set`, async ({ page }) => {
      await setupMockApp(page, { startAuthenticated: true, config: { theme } });
      await page.goto('/journal');
      await page.locator('form').first().getByRole('button', { name: 'Write in focus mode (Ctrl+Shift+F)' }).click();
      const dialog = page.getByRole('dialog', { name: 'Focus mode' });
      await dialog.getByLabel('Session goal in words').fill('300');
      await expect(dialog.getByRole('progressbar')).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .include('.focus-mode')
        .analyze();
      expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
    });
  }

  test('follows high contrast and speaks French', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr', highContrast: true } });
    await page.goto('/journal');

    await page.locator('form').first().getByRole('button', { name: 'Écrire en mode concentration (Ctrl+Maj+F)' }).click();
    const dialog = page.getByRole('dialog', { name: 'Mode concentration' });
    await expect(dialog).toHaveCSS('background-color', 'rgb(0, 0, 0)');
    await expect(dialog.getByText('0 mot', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Échap ou Ctrl+Maj+F pour quitter. Votre brouillon reste tel quel.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Terminé' }).click();
    await expect(dialog).toHaveCount(0);
  });
});
