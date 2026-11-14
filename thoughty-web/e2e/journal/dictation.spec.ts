import AxeBuilder from '../support/axe';
import { expect, test, type Locator, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { installFakeSpeech, removeSpeechRecognition, speech } from '../support/fakeSpeech';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const composer = (page: Page) => page.locator('form').first();
const composerText = (page: Page) => page.getByPlaceholder("What's on your mind?");

async function openJournal(page: Page, language: 'en' | 'fr' = 'en') {
  await installFakeSpeech(page);
  await setupMockApp(page, { startAuthenticated: true, config: { language } });
  await page.goto('/journal');
}

/** Puts the caret after the first `offset` characters of a single-line field, as the writer would. */
async function placeCaret(page: Page, field: Locator, offset: number) {
  await field.click();
  await field.press('Home');
  for (let step = 0; step < offset; step += 1) await page.keyboard.press('ArrowRight');
}

test.describe('Live dictation', () => {
  test('Chromium offers dictation, and a browser without speech recognition shows no button', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/journal');
    await expect(composer(page).getByRole('button', { name: 'Dictate' })).toBeVisible();

    await removeSpeechRecognition(page);
    await page.reload();
    await expect(composerText(page)).toBeVisible();
    await expect(composer(page).getByRole('button', { name: 'Dictate' })).toHaveCount(0);
  });

  test('says where speech goes before the first use, then writes at the cursor in the plain composer', async ({ page }) => {
    await openJournal(page);
    const field = composerText(page);
    await field.fill('Morning. Evening.');
    await placeCaret(page, field, 'Morning.'.length);

    const toggle = composer(page).getByRole('button', { name: 'Dictate' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    const note = page.getByRole('group', { name: /send the audio to their maker's speech service/ });
    await expect(note).toBeVisible();
    await expect(note.getByRole('button', { name: 'Start dictating' })).toBeFocused();
    expect(await speech(page).sessions()).toEqual([]);
    const withNote = await new AxeBuilder({ page }).withTags(WCAG).include('form').analyze();
    expect(withNote.violations.map(({ id }) => id)).toEqual([]);

    await note.getByRole('button', { name: 'Start dictating' }).click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(field).toBeFocused();
    expect(await speech(page).sessions()).toEqual([
      { lang: 'en-US', continuous: true, interimResults: true, started: true, stopped: false },
    ]);
    await speech(page).start();
    await expect(composer(page).getByRole('status').filter({ hasText: 'Dictation on' })).toHaveText('Dictation on. Speak to write; Escape stops.');

    await speech(page).interim('I walked');
    const interim = page.locator('[data-dictation-interim]');
    await expect(interim).toHaveText('I walked');
    await expect(field).toHaveValue('Morning. Evening.');
    const listening = await new AxeBuilder({ page }).withTags(WCAG).include('form').analyze();
    expect(listening.violations.map(({ id }) => id)).toEqual([]);

    await speech(page).final('I walked.');
    await expect(field).toHaveValue('Morning. I walked. Evening.');
    await expect(interim).toHaveCount(0);
    await speech(page).final('By the sea.');
    await expect(field).toHaveValue('Morning. I walked. By the sea. Evening.');

    // Typing goes on where the spoken words ended
    await page.keyboard.type(' Happy.');
    await expect(field).toHaveValue('Morning. I walked. By the sea. Happy. Evening.');

    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(composer(page).getByRole('status').filter({ hasText: 'Dictation off' })).toHaveText('Dictation off.');
    expect((await speech(page).sessions())[0]?.stopped).toBe(true);

    // The note is not shown again; the toggle also stops dictation
    await toggle.click();
    await expect(note).toHaveCount(0);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(await speech(page).sessions()).toHaveLength(2);
  });

  test('writes at the cursor in the Markdown editor, with the interim words blurred by the privacy blur', async ({ page }) => {
    await openJournal(page);
    await page.getByTitle('Plain text - click to enable Markdown formatting').click();
    const field = composer(page).locator('.w-md-editor-text-input');
    await field.fill('## Day');
    await field.press('End');

    await composer(page).getByRole('button', { name: 'Dictate' }).click();
    await page.getByRole('button', { name: 'Start dictating' }).click();
    await expect(field).toBeFocused();
    await speech(page).start();

    await page.keyboard.press('Control+Shift+E');
    await speech(page).interim('calm and');
    const interim = page.locator('[data-dictation-interim]');
    await expect.poll(() => interim.evaluate((element) => getComputedStyle(element).filter)).toMatch(/^blur\(/);
    await page.keyboard.press('Control+Shift+E');

    await speech(page).final('calm and bright');
    await expect(field).toHaveValue('## Day calm and bright');
  });

  test('writes in focus mode, where Escape stops dictation before it leaves focus mode', async ({ page }) => {
    await openJournal(page);
    await composerText(page).fill('Before.');
    await composer(page).getByRole('button', { name: 'Write in focus mode (Ctrl+Shift+F)' }).click();

    const dialog = page.getByRole('dialog', { name: 'Focus mode' });
    const text = dialog.getByRole('textbox', { name: 'Entry text' });
    const toggle = dialog.getByRole('button', { name: 'Dictate' });
    await toggle.click();
    await dialog.getByRole('button', { name: 'Start dictating' }).click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(text).toBeFocused();
    await speech(page).start();
    await speech(page).interim('the rain');
    await expect(dialog.locator('[data-dictation-interim]')).toHaveText('the rain');
    await speech(page).final('The rain stopped.');
    await expect(text).toHaveValue('Before. The rain stopped.');

    const results = await new AxeBuilder({ page }).withTags(WCAG).include('[role="dialog"]').analyze();
    expect(results.violations.map(({ id }) => id)).toEqual([]);

    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(composerText(page)).toHaveValue('Before. The rain stopped.');
  });

  test('says clearly when the microphone is refused', async ({ page }) => {
    await openJournal(page);
    const toggle = composer(page).getByRole('button', { name: 'Dictate' });
    await toggle.click();
    await page.getByRole('button', { name: 'Start dictating' }).click();
    await speech(page).error('not-allowed');
    await speech(page).end();

    await expect(composer(page).getByRole('alert')).toHaveText(
      "Microphone access was refused. Allow the microphone for this site in your browser's settings to dictate.",
    );
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(composerText(page)).toHaveValue('');
  });

  test('listens and speaks in French', async ({ page }) => {
    await openJournal(page, 'fr');
    const toggle = composer(page).getByRole('button', { name: 'Dicter' });
    await toggle.click();
    await expect(page.getByRole('group', { name: /service de reconnaissance vocale de leur éditeur/ })).toBeVisible();
    await page.getByRole('button', { name: 'Commencer la dictée' }).click();
    expect((await speech(page).sessions())[0]?.lang).toBe('fr-FR');
    await speech(page).start();
    await expect(composer(page).getByRole('status').filter({ hasText: 'Dictée' })).toHaveText('Dictée activée. Parlez pour écrire ; Échap l’arrête.');
    await expect(composer(page).getByText('À l’écoute…')).toBeVisible();
    await speech(page).final('une belle journée');
    await expect(composer(page).locator('textarea').first()).toHaveValue('une belle journée');

    await speech(page).error('not-allowed');
    await speech(page).end();
    await expect(composer(page).getByRole('alert')).toHaveText(
      'L’accès au micro a été refusé. Autorisez le micro pour ce site dans les réglages du navigateur pour dicter.',
    );
  });
});
