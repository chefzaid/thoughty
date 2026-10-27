import { test, expect } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { MOCK_ON_THIS_DAY_UNSUBSCRIBE_TOKEN } from '../support/mockApp.routes.opt-in-emails';

test.describe('On this day by email', () => {
  test.use({ timezoneId: 'Europe/Paris' });

  test('is off until the writer opts in, then saves the hour, zone and diary, and opts out again', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/profile');

    const section = page.getByRole('region', { name: 'On this day by email' });
    const toggle = section.getByRole('switch', { name: 'Email me “On this day”' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(section.getByLabel('Delivery time')).toHaveCount(0);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(section.getByLabel('Time zone')).toHaveValue('Europe/Paris');
    await expect(section.getByText(/^Next possible email: /)).toBeVisible();
    expect(state.onThisDayEmail).toMatchObject({ enabled: true, deliveryHour: 8, timeZone: 'Europe/Paris', diaryId: null });

    await section.getByLabel('Delivery time').selectOption({ label: '7:00 AM' });
    await expect.poll(() => state.onThisDayEmail.deliveryHour).toBe(7);
    await section.getByLabel('Time zone').selectOption('America/New_York');
    await expect.poll(() => state.onThisDayEmail.timeZone).toBe('America/New_York');
    const diary = state.diaries[0]!;
    await section.getByLabel('Diary').selectOption(String(diary.id));
    await expect.poll(() => state.onThisDayEmail.diaryId).toBe(diary.id);

    await page.reload();
    await expect(section.getByLabel('Delivery time')).toHaveValue('7');
    await expect(section.getByLabel('Time zone')).toHaveValue('America/New_York');
    await expect(section.getByLabel('Diary')).toHaveValue(String(diary.id));

    await section.getByRole('switch', { name: 'Email me “On this day”' }).click();
    await expect(section.getByRole('switch', { name: 'Email me “On this day”' })).toHaveAttribute('aria-checked', 'false');
    await expect(section.getByLabel('Delivery time')).toHaveCount(0);
    expect(state.onThisDayEmail).toMatchObject({ enabled: false, nextSendAt: null, deliveryHour: 7 });
  });

  test('opts in in French', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' } });
    await page.goto('/profile');

    const section = page.getByRole('region', { name: 'Ce jour-là par e-mail' });
    await section.getByRole('switch', { name: 'M’envoyer « Ce jour-là » par e-mail' }).click();
    await expect(section.getByLabel('Heure d’envoi')).toHaveValue('8');
    await expect(section.getByLabel('Journal')).toHaveValue('');
    await expect(section.getByText('Tous les journaux')).toBeAttached();
    expect(state.onThisDayEmail.enabled).toBe(true);
  });

  test('stops from the email’s unsubscribe link without signing in, and refuses a forged link', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: false,
      onThisDayEmail: { enabled: true, deliveryHour: 8, timeZone: 'Europe/Paris', nextSendAt: '2026-10-28T07:00:00.000Z' },
    });

    await page.goto('/unsubscribe?token=1.forged');
    await expect(page.getByRole('heading', { name: 'Unsubscribe' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveText('This unsubscribe link is not valid. Turn the emails off in your profile instead.');
    expect(state.onThisDayEmail.enabled).toBe(true);

    await page.goto(`/unsubscribe?token=${MOCK_ON_THIS_DAY_UNSUBSCRIBE_TOKEN}`);
    await expect(page.getByText(/You won’t receive “On this day” emails anymore/)).toBeVisible();
    expect(state.onThisDayEmail.enabled).toBe(false);

    await page.getByRole('button', { name: 'Continue to Thoughty' }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
