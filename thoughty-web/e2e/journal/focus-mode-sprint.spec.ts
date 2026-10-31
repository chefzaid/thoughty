import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';

const MINUTE = 60_000;

async function openFocusMode(page: Page) {
  const form = page.locator('form').first();
  await form.getByRole('button', { name: 'Write in focus mode (Ctrl+Shift+F)' }).click();
  const dialog = page.getByRole('dialog', { name: 'Focus mode' });
  await expect(dialog.getByRole('textbox', { name: 'Entry text' })).toBeFocused();
  return { form, dialog };
}

/** The sprint's own live region; focus mode also has one for the word goal and one for the people list. */
const sprintStatus = (dialog: ReturnType<Page['getByRole']>) => dialog.locator('.focus-mode-sprint-status[role="status"]');

test.describe('Focus mode timed sprints', () => {
  test('counts down quietly, says halfway and the end once, and stops here with the draft kept', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.install();
    await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/journal');
    await page.locator('form').first().locator('textarea').fill('Before the sprint.');
    const { form, dialog } = await openFocusMode(page);

    await dialog.getByLabel('Timed sprint').selectOption({ label: '5 minutes' });
    const timer = dialog.getByRole('timer');
    await expect(timer).toHaveText('Time left in the sprint: 05:00');
    await expect(timer).toHaveAttribute('aria-live', 'off');
    // Reduced motion: the countdown alone, no ring
    await expect(dialog.locator('.focus-mode-sprint-ring')).toBeHidden();

    await dialog.getByRole('textbox', { name: 'Entry text' }).focus();
    await page.keyboard.press('End');
    await page.keyboard.type(' One two three four.');
    await page.clock.runFor(MINUTE);
    await expect(timer).toHaveText(/04:00$/);
    await expect(sprintStatus(dialog)).toBeEmpty();
    await page.clock.runFor(1.5 * MINUTE);
    await expect(sprintStatus(dialog)).toHaveText('Halfway through the sprint');

    await page.clock.runFor(2.5 * MINUTE);
    const notice = dialog.getByRole('region', { name: "Time's up — keep going or stop here" });
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('4 words written in this sprint');
    await expect(timer).toHaveText(/00:00$/);
    await expect(sprintStatus(dialog)).toHaveText("Time's up — keep going or stop here. 4 words written in this sprint");
    // The end never takes the caret away from the text
    await expect(dialog.getByRole('textbox', { name: 'Entry text' })).toBeFocused();

    await notice.getByRole('button', { name: 'Stop here' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(form.getByRole('button', { name: 'Write in focus mode (Ctrl+Shift+F)' })).toBeFocused();
    await expect(form.locator('textarea')).toHaveValue('Before the sprint. One two three four.');
  });

  test('remembers the length, keeps going without a sprint, and passes an accessibility scan at the end', async ({ page }) => {
    await page.clock.install();
    await setupMockApp(page, { startAuthenticated: true, config: { theme: 'light' } });
    await page.goto('/journal');

    let { dialog } = await openFocusMode(page);
    await dialog.getByLabel('Timed sprint').selectOption({ label: '10 minutes' });
    await expect(dialog.locator('.focus-mode-sprint-ring')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    // Opening focus mode again starts a sprint of the remembered length
    ({ dialog } = await openFocusMode(page));
    await expect(dialog.getByLabel('Timed sprint')).toHaveValue('10');
    await expect(dialog.getByRole('timer')).toHaveText(/10:00$/);
    await page.keyboard.type('Ten minutes of words');
    await page.clock.runFor(10 * MINUTE);

    const notice = dialog.getByRole('region', { name: "Time's up — keep going or stop here" });
    await expect(notice).toContainText('4 words written in this sprint');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .include('.focus-mode')
      .analyze();
    expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);

    await notice.getByRole('button', { name: 'Keep going' }).click();
    await expect(notice).toHaveCount(0);
    await expect(dialog.getByRole('timer')).toHaveCount(0);
    await expect(dialog.getByLabel('Timed sprint')).toHaveValue('');
    await expect(dialog.getByRole('textbox', { name: 'Entry text' })).toBeFocused();
    await page.keyboard.type(', and more.');
    await expect(dialog.getByRole('textbox', { name: 'Entry text' })).toHaveValue('Ten minutes of words, and more.');
    expect(await page.evaluate(() => localStorage.getItem('thoughty.focusModeSprint'))).toBe('10');
  });
});
