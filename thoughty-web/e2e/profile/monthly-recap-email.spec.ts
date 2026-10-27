import { test, expect } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { MOCK_UNSUBSCRIBE_TOKENS } from '../support/mockApp.routes.opt-in-emails';

test.describe('Monthly recap by email', () => {
  test.use({ timezoneId: 'Europe/Paris' });

  test('sits next to On this day, is off until the writer opts in, and saves the hour, zone and diary', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/profile');

    await expect(page.locator('#on-this-day-email + #monthly-recap-email')).toHaveCount(1);
    const section = page.getByRole('region', { name: 'Monthly recap by email' });
    const toggle = section.getByRole('switch', { name: 'Email me a monthly recap' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(section.getByLabel('Delivery time')).toHaveCount(0);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(section.getByLabel('Time zone')).toHaveValue('Europe/Paris');
    await expect(section.getByText(/^Next possible recap: .* 1, /)).toBeVisible();
    expect(state.monthlyRecapEmail).toMatchObject({ enabled: true, deliveryHour: 8, timeZone: 'Europe/Paris', diaryId: null });
    expect(state.onThisDayEmail.enabled).toBe(false);

    await section.getByLabel('Delivery time').selectOption({ label: '6:00 PM' });
    await expect.poll(() => state.monthlyRecapEmail.deliveryHour).toBe(18);
    await section.getByLabel('Time zone').selectOption('Asia/Tokyo');
    await expect.poll(() => state.monthlyRecapEmail.timeZone).toBe('Asia/Tokyo');
    const diary = state.diaries[0]!;
    await section.getByLabel('Diary').selectOption(String(diary.id));
    await expect.poll(() => state.monthlyRecapEmail.diaryId).toBe(diary.id);

    await page.reload();
    await expect(section.getByLabel('Delivery time')).toHaveValue('18');
    await expect(section.getByLabel('Time zone')).toHaveValue('Asia/Tokyo');
    await expect(section.getByLabel('Diary')).toHaveValue(String(diary.id));

    await section.getByRole('switch', { name: 'Email me a monthly recap' }).click();
    await expect(section.getByLabel('Delivery time')).toHaveCount(0);
    expect(state.monthlyRecapEmail).toMatchObject({ enabled: false, nextSendAt: null, deliveryHour: 18 });
  });

  test('opts in in French', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' } });
    await page.goto('/profile');

    const section = page.getByRole('region', { name: 'Bilan mensuel par e-mail' });
    await section.getByRole('switch', { name: 'M’envoyer un bilan mensuel par e-mail' }).click();
    await expect(section.getByLabel('Heure d’envoi')).toHaveValue('8');
    await expect(section.getByText(/^Prochain bilan possible : /)).toBeVisible();
    expect(state.monthlyRecapEmail.enabled).toBe(true);
  });

  test('stops from the recap’s unsubscribe link without signing in, leaving On this day on', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: false,
      onThisDayEmail: { enabled: true, deliveryHour: 8, timeZone: 'Europe/Paris', nextSendAt: '2026-10-28T07:00:00.000Z' },
      monthlyRecapEmail: { enabled: true, deliveryHour: 8, timeZone: 'Europe/Paris', nextSendAt: '2026-11-01T07:00:00.000Z' },
    });

    await page.goto('/unsubscribe?token=recap.1.forged');
    await expect(page.getByRole('alert')).toHaveText('This unsubscribe link is not valid. Turn the emails off in your profile instead.');
    expect(state.monthlyRecapEmail.enabled).toBe(true);

    await page.goto(`/unsubscribe?token=${MOCK_UNSUBSCRIBE_TOKENS['monthly-recap']}`);
    await expect(page.getByRole('heading', { name: 'Unsubscribe' })).toBeVisible();
    await expect(page.getByText(/You won’t receive monthly recap emails anymore/)).toBeVisible();
    expect(state.monthlyRecapEmail.enabled).toBe(false);
    expect(state.onThisDayEmail.enabled).toBe(true);
  });
});
