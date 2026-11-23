import { expect, test, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';

// Chromium's viewer cannot show it: its error dialog takes the focus as the preview loads
const unreadable = { name: 'scan.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 torn') };

const composerText = (page: Page) => page.locator('form').first().locator('textarea').first();

/** Counts the times the writing field lost focus to nothing on this page, as it does to a PDF viewer's frame. */
async function watchFocusLeavingTheComposer(page: Page): Promise<() => Promise<number>> {
  await composerText(page).evaluate((field) => {
    const counter = globalThis as unknown as { composerFocusLost: number };
    counter.composerFocusLost = 0;
    field.addEventListener('focusout', (event) => {
      if ((event as FocusEvent).relatedTarget === null) counter.composerFocusLost += 1;
    });
  });
  return () => page.evaluate(() => (globalThis as unknown as { composerFocusLost: number }).composerFocusLost);
}

test.describe('PDF previews and the writer\'s focus', () => {
  test('gives the focus back to the composer when the preview of a PDF the browser cannot show takes it', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/journal');
    await composerText(page).fill('Morning pages');
    await composerText(page).focus();
    const focusLost = await watchFocusLeavingTheComposer(page);

    await page.locator('input[type="file"]').first().setInputFiles([unreadable]);
    await expect(page.locator('iframe[title="scan.pdf"]')).toBeVisible();

    // The viewer took the focus, and the composer has it back, its text as it was
    await expect.poll(focusLost).toBeGreaterThan(0);
    await expect(composerText(page)).toBeFocused();
    await expect(composerText(page)).toHaveValue('Morning pages');
  });
});
