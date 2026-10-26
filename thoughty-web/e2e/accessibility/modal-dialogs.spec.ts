import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';

// A 1x1 transparent PNG, served for the image attachment.
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

const ENTRY = {
  id: 301,
  date: '2026-09-12',
  index: 1,
  content: 'Sunrise walk by the lake',
  tags: ['walk'],
  visibility: 'private' as const,
  diaryId: 1,
  attachments: [
    {
      id: 31,
      original_filename: 'sunrise.png',
      stored_filename: 'stored-sunrise.png',
      mimetype: 'image/png',
      size: 2048,
    },
  ],
};

async function openJournal(page: Page, theme: 'dark' | 'light' = 'dark') {
  await setupMockApp(page, { startAuthenticated: true, initialEntries: [ENTRY], config: { theme } });
  await page.route('**/api/attachments/file/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL_PNG }),
  );
  await page.goto('/journal');
  return page.locator(`#entry-${ENTRY.id}`);
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .include('[role="dialog"]')
    .analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
}

test.describe('Modal dialogs', () => {
  test('AI chat keeps the keyboard inside and returns focus to its opener', async ({ page }) => {
    const entry = await openJournal(page);
    const opener = entry.getByTitle('Discuss with AI');
    await opener.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog', { name: 'AI Chat' });
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    const message = dialog.getByRole('textbox', { name: 'Message to the AI' });
    await expect(message).toBeFocused();

    // The saved history enables the export button, so the cycle is export, close, message.
    const exportButton = dialog.getByRole('button', { name: 'Export Chat' });
    await expect(exportButton).toBeEnabled();
    await page.keyboard.press('Tab');
    await expect(exportButton).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(message).toBeFocused();
    await message.fill('What stands out?');
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Send message' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(exportButton).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  test('attachment preview keeps the keyboard inside and returns focus to the image', async ({ page }) => {
    const entry = await openJournal(page);
    const opener = entry.getByRole('button', { name: /sunrise\.png/ });
    await expect(opener).toBeEnabled();
    await opener.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog', { name: 'Preview sunrise.png' });
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    const close = dialog.getByRole('button', { name: 'Close' });
    const download = dialog.getByRole('link', { name: 'Download' });
    await expect(close).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(download).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(close).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(download).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  test('a text preview keeps Tab inside the dialog when the frame has focus', async ({ page }) => {
    const textEntry = {
      ...ENTRY,
      attachments: [{
        id: 32,
        original_filename: 'notes.txt',
        stored_filename: 'stored-notes.txt',
        mimetype: 'text/plain',
        size: 64,
      }],
    };
    await setupMockApp(page, { startAuthenticated: true, initialEntries: [textEntry], config: { theme: 'dark' } });
    await page.route('**/api/attachments/file/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/plain', body: 'Notes from the lake walk.' }),
    );
    await page.goto('/journal');
    await page.locator(`#entry-${textEntry.id}`).getByRole('button', { name: /notes\.txt/ }).click();

    const dialog = page.getByRole('dialog', { name: 'Preview notes.txt' });
    const frame = dialog.getByTitle('notes.txt');
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
    await expect(frame).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(frame).toBeFocused();
    // Inside the frame the parent page never sees this key press; focus must still come back in.
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('link', { name: 'Download' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(frame).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  });

  test('entry summary returns focus to the more actions button', async ({ page }) => {
    const entry = await openJournal(page);
    const moreActions = entry.getByLabel('More actions');
    await moreActions.click();
    await entry.getByRole('menuitem', { name: 'Summarize entry' }).click();

    const dialog = page.getByRole('dialog', { name: 'Entry summary' });
    const closeIcon = dialog.getByRole('button', { name: 'Close' }).first();
    await expect(dialog.getByLabel('Emphasize')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(closeIcon).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: 'Generate summary' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(closeIcon).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(moreActions).toBeFocused();
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`AI chat and attachment preview pass an accessibility scan in the ${theme} theme`, async ({ page }) => {
      const entry = await openJournal(page, theme);

      await entry.getByTitle('Discuss with AI').click();
      const chat = page.getByRole('dialog', { name: 'AI Chat' });
      await expect(chat.getByRole('textbox', { name: 'Message to the AI' })).toBeEnabled();
      await expectNoAxeViolations(page);
      await page.keyboard.press('Escape');
      await expect(chat).toHaveCount(0);

      await entry.getByRole('button', { name: /sunrise\.png/ }).click();
      await expect(page.getByRole('dialog', { name: 'Preview sunrise.png' })).toBeVisible();
      await expectNoAxeViolations(page);
    });
  }
});
