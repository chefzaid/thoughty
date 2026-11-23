import { test, expect } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { MOCK_UNSUBSCRIBE_TOKENS } from '../support/mockApp.routes.opt-in-emails';

test.describe('Year in review by email', () => {
  test.use({ timezoneId: 'Europe/Paris' });

  test('sits after the monthly recap, is off until the writer opts in, and saves the hour, zone and diary', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/profile');

    await expect(page.locator('#monthly-recap-email + #year-review-email')).toHaveCount(1);
    const section = page.getByRole('region', { name: 'Year in review by email' });
    const toggle = section.getByRole('switch', { name: 'Email me my year in review' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(section.getByLabel('Delivery time')).toHaveCount(0);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(section.getByLabel('Time zone')).toHaveValue('Europe/Paris');
    await expect(section.getByLabel('Delivery time')).toHaveValue('9');
    await expect(section.getByText(/holds no text from your entries/)).toBeVisible();
    await expect(section.getByText(/^Next possible email: \w+, January 1, \d{4} at 9:00 AM\.$/)).toBeVisible();
    expect(state.yearReviewEmail).toMatchObject({ enabled: true, deliveryHour: 9, timeZone: 'Europe/Paris', diaryId: null });
    expect(state.monthlyRecapEmail.enabled).toBe(false);

    await section.getByLabel('Delivery time').selectOption({ label: '6:00 PM' });
    await expect.poll(() => state.yearReviewEmail.deliveryHour).toBe(18);
    await section.getByLabel('Time zone').selectOption('Asia/Tokyo');
    await expect.poll(() => state.yearReviewEmail.timeZone).toBe('Asia/Tokyo');
    const diary = state.diaries[0]!;
    await section.getByLabel('Diary').selectOption(String(diary.id));
    await expect.poll(() => state.yearReviewEmail.diaryId).toBe(diary.id);

    await page.reload();
    await expect(section.getByLabel('Delivery time')).toHaveValue('18');
    await expect(section.getByLabel('Time zone')).toHaveValue('Asia/Tokyo');
    await expect(section.getByLabel('Diary')).toHaveValue(String(diary.id));

    await section.getByRole('switch', { name: 'Email me my year in review' }).click();
    await expect(section.getByLabel('Delivery time')).toHaveCount(0);
    expect(state.yearReviewEmail).toMatchObject({ enabled: false, nextSendAt: null, deliveryHour: 18 });
  });

  test('opts in in French', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' } });
    await page.goto('/profile');

    const section = page.getByRole('region', { name: 'Bilan de l’année par e-mail' });
    await section.getByRole('switch', { name: 'M’envoyer mon bilan de l’année par e-mail' }).click();
    await expect(section.getByLabel('Heure d’envoi')).toHaveValue('9');
    await expect(section.getByText(/^Prochain e-mail possible : \w+ 1 janvier \d{4}/)).toBeVisible();
    expect(state.yearReviewEmail.enabled).toBe(true);
  });

  test('stops from its unsubscribe link without signing in, leaving the monthly recap on', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: false,
      monthlyRecapEmail: { enabled: true, deliveryHour: 8, timeZone: 'Europe/Paris', nextSendAt: '2026-12-01T07:00:00.000Z' },
      yearReviewEmail: { enabled: true, deliveryHour: 9, timeZone: 'Europe/Paris', nextSendAt: '2027-01-01T08:00:00.000Z' },
    });

    await page.goto('/unsubscribe?token=year.1.forged');
    await expect(page.getByRole('alert')).toHaveText('This unsubscribe link is not valid. Turn the emails off in your profile instead.');
    expect(state.yearReviewEmail.enabled).toBe(true);

    await page.goto(`/unsubscribe?token=${MOCK_UNSUBSCRIBE_TOKENS['year-review']}`);
    await expect(page.getByRole('heading', { name: 'Unsubscribe' })).toBeVisible();
    await expect(page.getByText(/You won’t receive year in review emails anymore/)).toBeVisible();
    expect(state.yearReviewEmail.enabled).toBe(false);
    expect(state.monthlyRecapEmail.enabled).toBe(true);
  });
});
