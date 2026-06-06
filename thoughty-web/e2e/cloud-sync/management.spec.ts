import { expect, test } from '@playwright/test';

import { setupMockApp } from '../support/mockApp';

test.describe('Cloud sync management', () => {
  test('uploads exports, manages schedules, syncs on demand, and imports from cloud', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [
        {
          id: 401,
          date: '2024-04-18',
          index: 1,
          content: 'Entry ready for cloud sync',
          tags: ['cloud'],
          visibility: 'private',
          diaryId: 1,
        },
      ],
    });

    await page.goto('/import-export?diary=1&section=import');

    const cloudSyncSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Cloud Sync' }) });
    const googleDriveCard = cloudSyncSection.locator('.cloud-sync-card', { hasText: 'Google Drive' });
    await expect(googleDriveCard).toBeVisible();

    const [exportFormatSelect, frequencySelect, scheduleFormatSelect] = await googleDriveCard.getByRole('combobox').all();
    const [exportVisibilityCheckbox, scheduleVisibilityCheckbox] = await googleDriveCard.getByRole('checkbox').all();

    await exportFormatSelect.selectOption('json');
    await exportVisibilityCheckbox.check();
    await googleDriveCard.getByRole('button', { name: 'Upload Export' }).click();

    await expect.poll(() => state.lastCloudUploadPayload).toMatchObject({
      provider: 'google_drive',
      diaryId: 1,
      format: 'json',
      includeVisibility: true,
    });

    await frequencySelect.selectOption('weekly');
    await scheduleFormatSelect.selectOption('md');
    await scheduleVisibilityCheckbox.check();
    await googleDriveCard.getByRole('button', { name: 'Enable Schedule' }).click();

    await expect.poll(() => state.lastCloudSchedulePayload).toMatchObject({
      provider: 'google_drive',
      diaryId: 1,
      frequency: 'weekly',
      format: 'md',
      includeVisibility: true,
    });
    await expect.poll(() => state.cloudSchedules.google_drive?.frequency).toBe('weekly');

    await googleDriveCard.getByRole('button', { name: 'Sync Now' }).click();
    await expect.poll(() => state.lastCloudSyncPayload).toMatchObject({ provider: 'google_drive' });
    await expect(page.getByText('No changes detected since last sync')).toBeVisible();

    const cloudImportSection = page.locator('.cloud-import-section');
    await expect(cloudImportSection.getByRole('heading', { name: 'Import from Cloud' })).toBeVisible();
    await cloudImportSection.getByRole('button', { name: /Google Drive/i }).click();
    await expect(page.getByText('thoughty-cloud.json')).toBeVisible();
    await page.locator('.cloud-file-row', { hasText: 'thoughty-cloud.json' }).getByRole('button', { name: 'Import' }).click();

    await expect.poll(() => state.lastCloudDownloadPayload).toMatchObject({
      provider: 'google_drive',
      fileId: 'cloud-file-1',
    });
    await expect(page.getByText('Preview Summary')).toBeVisible();

    await page.getByRole('button', { name: 'Import Entries' }).click();
    await expect(page.getByText('Successfully imported 1 entries (0 duplicates skipped)')).toBeVisible();
    await expect.poll(() => state.entries.some((entry) => entry.content === 'Cloud restored entry')).toBe(true);

    await googleDriveCard.getByRole('button', { name: 'Disable Schedule' }).click();
    await expect.poll(() => state.lastCloudDeleteScheduleProvider).toBe('google_drive');
    await expect.poll(() => Boolean(state.cloudSchedules.google_drive?.enabled)).toBe(false);
  });
});