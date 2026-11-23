import { test, expect } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { MOCK_UNSUBSCRIBE_TOKENS } from '../support/mockApp.routes.opt-in-emails';

test.describe('Writing reminder by email', () => {
  test.use({ timezoneId: 'Europe/Paris' });

  test('sits after the year in review email, is off until the writer opts in, and saves the hour, zone and diary', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/profile');

    await expect(page.locator('#year-review-email + #writing-reminder-email')).toHaveCount(1);
    const section = page.getByRole('region', { name: 'Writing reminder by email' });
    const toggle = section.getByRole('switch', { name: 'Remind me to write by email' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(section.getByText(/A day that already has an entry/)).toBeVisible();
    await expect(section.getByLabel('Delivery time')).toHaveCount(0);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(section.getByLabel('Delivery time')).toHaveValue('20');
    await expect(section.getByLabel('Time zone')).toHaveValue('Europe/Paris');
    await expect(section.getByText(/^Next possible reminder: .* 8:00 PM\.$/)).toBeVisible();
    await expect(section.getByText(/holds nothing from your journal/)).toBeVisible();
    expect(state.writingReminderEmail).toMatchObject({ enabled: true, deliveryHour: 20, timeZone: 'Europe/Paris', diaryId: null });
    expect(state.monthlyRecapEmail.enabled).toBe(false);

    await section.getByLabel('Delivery time').selectOption({ label: '9:00 PM' });
    await expect.poll(() => state.writingReminderEmail.deliveryHour).toBe(21);
    const diary = state.diaries[0]!;
    await section.getByLabel('Diary').selectOption(String(diary.id));
    await expect.poll(() => state.writingReminderEmail.diaryId).toBe(diary.id);

    await page.reload();
    await expect(section.getByLabel('Delivery time')).toHaveValue('21');
    await expect(section.getByLabel('Diary')).toHaveValue(String(diary.id));

    await section.getByRole('switch', { name: 'Remind me to write by email' }).click();
    await expect(section.getByLabel('Delivery time')).toHaveCount(0);
    expect(state.writingReminderEmail).toMatchObject({ enabled: false, nextSendAt: null, deliveryHour: 21 });
  });

  test('opts in in French', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' } });
    await page.goto('/profile');

    const section = page.getByRole('region', { name: 'Rappel d’écriture par e-mail' });
    await section.getByRole('switch', { name: 'Me rappeler d’écrire par e-mail' }).click();
    await expect(section.getByLabel('Heure d’envoi')).toHaveValue('20');
    await expect(section.getByText(/^Prochain rappel possible : /)).toBeVisible();
    expect(state.writingReminderEmail.enabled).toBe(true);
  });

  test('stops from the reminder’s unsubscribe link without signing in, leaving the other emails on', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: false,
      monthlyRecapEmail: { enabled: true, deliveryHour: 8, timeZone: 'Europe/Paris', nextSendAt: '2026-12-01T07:00:00.000Z' },
      writingReminderEmail: { enabled: true, deliveryHour: 20, timeZone: 'Europe/Paris', nextSendAt: '2026-11-22T19:00:00.000Z' },
    });

    await page.goto(`/unsubscribe?token=${MOCK_UNSUBSCRIBE_TOKENS['writing-reminder']}`);
    await expect(page.getByRole('heading', { name: 'Unsubscribe' })).toBeVisible();
    await expect(page.getByText(/You won’t receive writing reminder emails anymore/)).toBeVisible();
    expect(state.writingReminderEmail.enabled).toBe(false);
    expect(state.monthlyRecapEmail.enabled).toBe(true);
  });
});
