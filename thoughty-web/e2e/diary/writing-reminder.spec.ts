import { test, expect } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { MOCK_UNSUBSCRIBE_TOKENS } from '../support/mockApp.routes.opt-in-emails';

test.describe('A diary’s own writing reminder', () => {
  test.use({ timezoneId: 'America/New_York' });

  test('gives a diary its own hour in the Profile reminder’s zone, shows it on the card, and removes it', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      writingReminderEmail: { enabled: true, deliveryHour: 20, timeZone: 'Europe/Paris', nextSendAt: '2026-11-22T19:00:00.000Z' },
    });
    await page.goto('/diaries?from=journal');

    const personal = page.locator('.diary-card', { hasText: 'Personal' });
    await expect(personal.getByText(/Writing reminder at/)).toHaveCount(0);
    await personal.getByTitle('Edit').click();
    const editor = page.locator('.diary-card.editing');
    const field = editor.getByLabel('Writing reminder');
    await expect(field).toHaveValue('');
    await expect(field.getByRole('option', { name: 'As in Profile' })).toHaveCount(1);
    await field.selectOption({ label: '7:00 AM' });
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect(personal.getByText('Writing reminder at 7:00 AM')).toBeVisible();
    // The Profile reminder's zone, not the browser's
    expect(state.diaryWritingReminders).toEqual([expect.objectContaining({ diaryId: 2, deliveryHour: 7, timeZone: 'Europe/Paris' })]);
    await expect(page.locator('.diary-card', { hasText: 'Work' }).getByText(/Writing reminder at/)).toHaveCount(0);

    await page.reload();
    await expect(personal.getByText('Writing reminder at 7:00 AM')).toBeVisible();
    await personal.getByTitle('Edit').click();
    await expect(editor.getByLabel('Writing reminder')).toHaveValue('7');
    await editor.getByLabel('Writing reminder').selectOption({ label: 'As in Profile' });
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect(personal.getByText(/Writing reminder at/)).toHaveCount(0);
    expect(state.diaryWritingReminders).toEqual([]);
  });

  test('says in French when no email can reach the writer yet, and follows the browser’s zone without a Profile reminder', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      config: { language: 'fr' },
      writingReminderEmail: { emailAvailable: false },
    });
    await page.goto('/diaries?from=journal');

    const work = page.locator('.diary-card', { hasText: 'Work' });
    await work.getByTitle('Modifier').click();
    const editor = page.locator('.diary-card.editing');
    await editor.getByLabel('Rappel d’écriture').selectOption({ label: '21:00' });
    await expect(editor.getByText(/Nous ne pouvons pas encore vous écrire/)).toBeVisible();
    await editor.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(work.getByText('Rappel d’écriture à 21:00')).toBeVisible();
    expect(state.diaryWritingReminders).toEqual([expect.objectContaining({ diaryId: 1, deliveryHour: 21, timeZone: 'America/New_York' })]);
  });

  test('stops with the writing reminder’s unsubscribe link, which says so', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: false,
      diaryWritingReminders: [{ diaryId: 2, deliveryHour: 7, timeZone: 'Europe/Paris', nextSendAt: '2026-11-23T06:00:00.000Z' }],
    });

    await page.goto(`/unsubscribe?token=${MOCK_UNSUBSCRIBE_TOKENS['writing-reminder']}`);
    await expect(page.getByText(/from your profile or your diaries/)).toBeVisible();
    expect(state.diaryWritingReminders).toEqual([]);
  });
});
