import { expect, test, type Browser, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { registerMockAppRoutes } from '../support/mockApp.routes';
import { mockComposerDraft, seedMockComposerDraft } from '../support/mockApp.routes.composer-draft';
import type { MockAppState } from '../support/mockApp.shared';

const composer = (page: Page) => page.getByPlaceholder("What's on your mind?");
const draftStatus = (page: Page) => page.getByTestId('composer-draft-status');
const offer = (page: Page) => page.getByTestId('composer-draft-offer');

/** A second device: its own browser context on the same mock API, as the writer signed in on a laptop. */
async function openOtherDevice(browser: Browser, state: MockAppState) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await registerMockAppRoutes(page, state);
  await page.goto('/journal');
  return {
    page,
    close: async () => {
      await page.goto('about:blank', { waitUntil: 'commit' }).catch(() => undefined);
      await context.close();
    },
  };
}

test.describe('Composer draft', () => {
  test('continues on another device, asks which text to keep after a clash, and goes once published', async ({ page, browser }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/journal');

    await composer(page).fill('Started on the phone');
    await expect(draftStatus(page)).toHaveText('Draft saved');
    expect(mockComposerDraft(state)).toMatchObject({ text: 'Started on the phone', revision: 1 });

    const laptop = await openOtherDevice(browser, state);
    try {
      // The other device offers the draft rather than putting it in
      await expect(offer(laptop.page)).toContainText(/Continue your draft from .+\?/);
      await expect(offer(laptop.page).locator('.privacy-text')).toHaveText('Started on the phone');
      await expect(composer(laptop.page)).toHaveValue('');
      await offer(laptop.page).getByRole('button', { name: 'Continue' }).click();
      await expect(composer(laptop.page)).toHaveValue('Started on the phone');
      await expect(offer(laptop.page)).toHaveCount(0);

      await composer(laptop.page).fill('Started on the phone, finished on the laptop');
      await expect.poll(() => mockComposerDraft(state)?.revision).toBe(2);
      await expect(draftStatus(laptop.page)).toHaveText('Draft saved');

      // The phone, still on the first revision, cannot overwrite the laptop's text: the writer chooses
      await composer(page).fill('Started on the phone, and more');
      await expect(offer(page)).toContainText('This draft was changed on another device');
      expect(mockComposerDraft(state)).toMatchObject({ text: 'Started on the phone, finished on the laptop' });
      await offer(page).getByRole('button', { name: 'Use that version' }).click();
      await expect(composer(page)).toHaveValue('Started on the phone, finished on the laptop');

      // Publishing on the laptop discards the draft everywhere
      const entryForm = laptop.page.locator('form').first();
      await entryForm.locator('input[placeholder="tags..."]').fill('walks');
      await entryForm.locator('input[placeholder="tags..."]').press('Enter');
      await laptop.page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect.poll(() => state.entries.map((entry) => entry.content)).toEqual(['Started on the phone, finished on the laptop']);
      await expect.poll(() => mockComposerDraft(state)).toBeNull();
      await expect(composer(laptop.page)).toHaveValue('');

      // The phone learns it was published, and can clear it
      await composer(page).fill('Started on the phone, finished on the laptop!');
      await expect(offer(page)).toContainText('This draft was published or discarded on another device.');
      await offer(page).getByRole('button', { name: 'Clear it' }).click();
      await expect(composer(page)).toHaveValue('');
    } finally {
      await laptop.close();
    }
  });

  test('discards a draft offered from another device', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    seedMockComposerDraft(state, { text: 'An old thought', revision: 3 });
    await page.goto('/journal');

    await offer(page).getByRole('button', { name: 'Discard' }).click();
    await expect(offer(page)).toHaveCount(0);
    await expect.poll(() => mockComposerDraft(state)).toBeNull();
    await expect(composer(page)).toHaveValue('');
  });

  test('keeps the draft on this device while offline, sends it when back, and brings it back after a reload', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/journal');
    await expect(composer(page)).toBeVisible();

    await page.route('**/api/composer-draft', (route) => route.abort('internetdisconnected'));
    await composer(page).fill('Written on the train');
    await expect(draftStatus(page)).toHaveText('Offline — saved on this device');
    expect(mockComposerDraft(state)).toBeNull();

    await page.unroute('**/api/composer-draft');
    await page.evaluate(() => globalThis.dispatchEvent(new Event('online')));
    await expect(draftStatus(page)).toHaveText('Draft saved');
    expect(mockComposerDraft(state)).toMatchObject({ text: 'Written on the train' });

    await page.reload();
    await expect(composer(page)).toHaveValue('Written on the train');
    await expect(offer(page)).toHaveCount(0);
  });

  test('asks before leaving the page on text not saved yet, in French too', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' } });
    await page.goto('/journal');
    // The save waits for the API, so the text is still unsaved when the writer leaves
    await page.route('**/api/composer-draft', (route) => (route.request().method() === 'PUT' ? new Promise(() => undefined) : route.fallback()));

    await page.getByPlaceholder("Qu'avez-vous à l'esprit ?").fill('Une pensée');
    const dialog = page.waitForEvent('dialog');
    const reload = page.reload();
    const asked = await dialog;
    expect(asked.type()).toBe('beforeunload');
    await asked.accept();
    await reload;
  });
});
