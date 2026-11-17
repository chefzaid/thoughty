import AxeBuilder from '../support/axe';
import { expect, test, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { goToView } from '../support/navigation';
import type { MockEntry } from '../support/mockApp.shared';

const TODAY = '2025-04-17';
const ENTRY_SECRET = 'Told nobody about the letter yet';
const DIARY_SECRET = 'The plan for the surprise';

const entries: MockEntry[] = [
  { id: 501, date: TODAY, index: 1, title: 'Harbour walk', content: `${ENTRY_SECRET}.`, tags: ['walks'], visibility: 'public', diaryId: 1 },
  { id: 502, date: TODAY, index: 1, title: null, content: `${DIARY_SECRET}.`, tags: ['plans'], visibility: 'private', diaryId: 2 },
  { id: 503, date: '2025-04-16', index: 1, content: 'Bread and coffee.', tags: [], visibility: 'private', diaryId: 1 },
];

const blurButton = (page: Page) => page.getByRole('navigation').getByRole('button', { name: 'Blur entry text' });
const pinDialog = (page: Page) => page.getByRole('dialog', { name: 'Unblur locked entries' });

/** Every JSON body the mock API answered with, to check what reached the page. */
function recordApiBodies(page: Page): string[] {
  const bodies: string[] = [];
  page.on('response', async (response) => {
    if (!response.url().includes('/api/')) return;
    try {
      bodies.push(await response.text());
    } catch {
      // A response that is gone by now holds nothing to check
    }
  });
  return bodies;
}

async function typePin(page: Page, pin: string) {
  const dialog = pinDialog(page);
  await dialog.getByLabel('PIN', { exact: true }).fill(pin);
  await dialog.getByRole('button', { name: 'Unblur' }).click();
}

test.describe('PIN lock', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date(`${TODAY}T12:00:00`));
  });

  test('sets a PIN, locks an entry and a diary, never sends their text, and unblurs with the PIN until blurred again', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    await page.goto('/profile');
    const section = page.locator('.pin-lock-section');
    await expect(section).toContainText('It is not encryption.');
    await section.getByLabel('New PIN').fill('2468');
    await section.getByLabel('Type the PIN again').fill('2468');
    await section.getByRole('button', { name: 'Save PIN' }).click();
    await expect(section.getByRole('status')).toHaveText('PIN saved.');
    expect(state.contentLock.pin).toBe('2468');

    await page.goto('/journal?diary=all');
    const card = page.locator('#entry-501');
    await card.getByRole('button', { name: 'More actions' }).click();
    await card.getByRole('menuitem', { name: 'Lock with PIN' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Lock this entry?' });
    await expect(confirm).toContainText('It is not encryption. A public entry becomes private');
    await confirm.getByRole('button', { name: 'Lock' }).click();
    await expect(card.getByRole('region', { name: 'Locked entry' })).toBeVisible();
    expect(state.entries.find((entry) => entry.id === 501)).toMatchObject({ isLocked: true, visibility: 'private' });

    await goToView(page, 'Manage Diaries');
    await page.getByRole('button', { name: 'Lock with PIN: Personal' }).click();
    await page.getByRole('alertdialog', { name: 'Lock this diary?' }).getByRole('button', { name: 'Lock' }).click();
    await expect(page.getByRole('button', { name: 'Lock with PIN: Personal' })).toHaveAttribute('aria-pressed', 'true');

    const bodies = recordApiBodies(page);
    await page.goto('/journal?diary=all');
    await expect(page.locator('#entry-503')).toContainText('Bread and coffee.');
    const locked = page.locator('#entry-501');
    await expect(locked.getByRole('region', { name: 'Locked entry' })).toContainText('Harbour walk');
    await expect(page.locator('#entry-502').getByRole('region', { name: 'Locked entry' })).toBeVisible();
    // The placeholder draws bars: the words never reach the page, nor any answer of the API
    await expect(page.locator('body')).not.toContainText(ENTRY_SECRET);
    await expect(page.locator('body')).not.toContainText(DIARY_SECRET);
    expect(bodies.some((body) => body.includes(ENTRY_SECRET) || body.includes(DIARY_SECRET))).toBe(false);

    await locked.getByRole('button', { name: 'Unblur with PIN' }).click();
    await typePin(page, '0000');
    await expect(pinDialog(page).getByRole('alert')).toHaveText('Wrong PIN. 4 more before a pause.');
    await typePin(page, '2468');
    await expect(pinDialog(page)).toBeHidden();
    await expect(page.locator('#entry-501')).toContainText(ENTRY_SECRET);
    await expect(page.locator('#entry-502')).toContainText(DIARY_SECRET);

    // Blurring again locks at once, on the server too
    await blurButton(page).click();
    await expect(page.locator('#entry-501').getByRole('region', { name: 'Locked entry' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(ENTRY_SECRET);
    expect(state.contentLock.token).toBeNull();

    // Lifting the blur asks for the PIN again
    await blurButton(page).click();
    await expect(pinDialog(page)).toBeVisible();
    await typePin(page, '2468');
    await expect(blurButton(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#entry-502')).toContainText(DIARY_SECRET);
  });

  test('blocks tries after five wrong PINs, and says until when', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: entries.map((entry) => ({ ...entry, isLocked: entry.id === 501 })) });
    state.contentLock.pin = '2468';
    await page.goto('/journal?diary=all');
    await page.locator('#entry-501').getByRole('button', { name: 'Unblur with PIN' }).click();

    for (const left of [4, 3, 2, 1]) {
      await typePin(page, '1111');
      await expect(pinDialog(page).getByRole('alert')).toHaveText(`Wrong PIN. ${left} more before a pause.`);
    }
    await typePin(page, '1111');
    await expect(pinDialog(page).getByRole('alert')).toContainText('Too many wrong PINs. Try again after');
    await typePin(page, '2468');
    await expect(pinDialog(page).getByRole('alert')).toContainText('Too many wrong PINs.');
    expect(state.contentLock.token).toBeNull();
    await page.keyboard.press('Escape');
    await expect(pinDialog(page)).toBeHidden();
    await expect(page.locator('body')).not.toContainText(ENTRY_SECRET);
  });

  test('locks again after 15 minutes without activity', async ({ page }) => {
    await page.clock.install({ time: new Date(`${TODAY}T12:00:00`) });
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: entries.map((entry) => ({ ...entry, isLocked: entry.id === 501 })) });
    state.contentLock.pin = '2468';
    await page.goto('/journal?diary=all');
    await page.locator('#entry-501').getByRole('button', { name: 'Unblur with PIN' }).click();
    await typePin(page, '2468');
    await expect(page.locator('#entry-501')).toContainText(ENTRY_SECRET);

    await page.clock.runFor(14 * 60_000);
    await expect(page.locator('#entry-501')).toContainText(ENTRY_SECRET);
    await page.clock.runFor(60_000 + 1000);
    await expect(page.locator('#entry-501').getByRole('region', { name: 'Locked entry' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(ENTRY_SECRET);
    expect(state.contentLock.token).toBeNull();
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`asks for the PIN in French, in an accessible dialog (${theme})`, async ({ page }) => {
      const { state } = await setupMockApp(page, {
        startAuthenticated: true,
        config: { language: 'fr', theme },
        initialEntries: entries.map((entry) => ({ ...entry, isLocked: entry.id === 501 })),
      });
      state.contentLock.pin = '2468';
      await page.goto('/journal?diary=all');
      const locked = page.locator('#entry-501').getByRole('region', { name: 'Entrée verrouillée' });
      await expect(locked).toContainText('Verrouillée par votre code');
      await locked.getByRole('button', { name: 'Déflouter avec le code' }).click();

      const dialog = page.getByRole('dialog', { name: 'Déflouter les entrées verrouillées' });
      await expect(dialog.getByLabel('Code', { exact: true })).toBeFocused();
      await dialog.getByLabel('Code', { exact: true }).fill('9999');
      await dialog.getByRole('button', { name: 'Déflouter' }).click();
      await expect(dialog.getByRole('alert')).toHaveText('Code incorrect. Encore 4 avant une pause.');

      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).include('[role="dialog"]').analyze();
      expect(results.violations.map(({ id }) => id)).toEqual([]);

      await dialog.getByLabel('Code', { exact: true }).fill('2468');
      await dialog.getByRole('button', { name: 'Déflouter' }).click();
      await expect(page.locator('#entry-501')).toContainText(ENTRY_SECRET);
    });
  }
});
