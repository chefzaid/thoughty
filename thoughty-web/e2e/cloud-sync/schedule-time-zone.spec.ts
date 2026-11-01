import { expect, test, type Page } from '../support/test';

import { setupMockApp } from '../support/mockApp';

// 10:30 UTC on 31 October 2026: already 00:30 on 1 November in Kiritimati (UTC+14), still 23:30 on 30 October in Pago Pago (UTC-11)
const NOW = new Date('2026-10-31T10:30:00Z');

/** Saves Google Drive's daily schedule and returns the mock API's state once it has it. */
async function saveDailySchedule(page: Page) {
  await page.clock.setFixedTime(NOW);
  const { state } = await setupMockApp(page, { startAuthenticated: true });
  await page.goto('/import-export?diary=1&section=import');
  const googleDriveCard = page.locator('.cloud-sync-card', { hasText: 'Google Drive' });
  await googleDriveCard.getByRole('button', { name: 'Enable Schedule' }).click();
  await expect(page.getByText('Sync schedule saved')).toBeVisible();
  return state;
}

test.describe('A sync schedule saves the writer’s time zone, whose day names its files', () => {
  for (const timeZone of ['Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
    test.describe(`in ${timeZone}`, () => {
      test.use({ timezoneId: timeZone });

      test('sends the browser’s time zone with the schedule', async ({ page }) => {
        const state = await saveDailySchedule(page);

        expect(state.lastCloudSchedulePayload).toMatchObject({ provider: 'google_drive', frequency: 'daily', timeZone });
        expect(state.cloudSchedules.google_drive).toMatchObject({ enabled: true, timeZone });
      });
    });
  }
});
