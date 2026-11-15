import { expect, test } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { goToView, navGroupButton } from '../support/navigation';

/**
 * Each runtime feature flag switched off at the API (`GET /api/config/feature-flags`): the app hides the
 * feature, says so where a writer would look for it, and never sends a request the API would refuse
 * with 503 FEATURE_DISABLED.
 */
const PUBLIC_ENTRY = {
  id: 801,
  date: '2026-10-10',
  index: 1,
  content: 'Shared with everyone before sharing was paused.',
  tags: ['walks'],
  visibility: 'public' as const,
  diaryId: 1,
};
const PRIVATE_ENTRY = {
  id: 802,
  date: '2026-10-11',
  index: 1,
  content: 'Kept to myself.',
  tags: ['notes'],
  visibility: 'private' as const,
  diaryId: 1,
};

test.describe('Runtime feature flags', () => {
  test('with AI off, the composer, search and profile offer no AI', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [PRIVATE_ENTRY],
      featureFlags: { ai: false },
    });
    await page.goto('/journal');

    await expect(page.getByPlaceholder("What's on your mind?")).toBeVisible();
    await expect(page.getByText('Kept to myself.')).toBeVisible();
    for (const name of ['Auto Tag', 'Rephrase', 'Get Inspired']) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
    }
    await expect(page.getByRole('button', { name: 'Meaning', exact: true })).toHaveCount(0);

    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'AI Configuration' })).toBeVisible();
    await expect(page.getByRole('note').filter({ hasText: 'AI features are turned off for now.' })).toBeVisible();
    expect(state.featureDisabledRequests).toEqual([]);
  });

  test('with the book converter off, Import/Export says so and offers no book', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, featureFlags: { bookConverter: false } });
    await page.goto('/journal');
    await goToView(page, 'Import/Export');

    const routes = page.getByRole('navigation', { name: 'Import/Export' });
    await expect(routes.getByRole('button', { name: 'Export', exact: true })).toBeVisible();
    await expect(routes.getByRole('button', { name: 'Book', exact: true })).toHaveCount(0);
    await expect(page.getByRole('note').filter({ hasText: 'The book converter is turned off for now.' })).toBeVisible();
    expect(state.featureDisabledRequests).toEqual([]);
  });

  test('with cloud sync off, Import/Export and the profile say so and ask the cloud API nothing', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, featureFlags: { cloudSync: false } });
    const cloudRequests: string[] = [];
    page.on('request', (request) => {
      const { pathname } = new URL(request.url());
      if (pathname.startsWith('/api/cloud-sync')) cloudRequests.push(pathname);
    });
    await page.goto('/import-export');

    await expect(page.getByRole('heading', { name: 'Cloud Sync', level: 2 })).toBeVisible();
    await expect(page.getByRole('note').filter({ hasText: 'Cloud sync is turned off for now.' })).toBeVisible();

    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'Cloud Providers' })).toBeVisible();
    await expect(page.getByRole('note').filter({ hasText: 'Your connections and schedules are kept' })).toBeVisible();
    expect(cloudRequests).toEqual([]);
    expect(state.featureDisabledRequests).toEqual([]);
  });

  test('with public sharing off, nothing is shared and new entries are saved private', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [PUBLIC_ENTRY, PRIVATE_ENTRY],
      config: { defaultVisibility: 'public' },
      featureFlags: { publicSharing: false },
    });
    await page.goto('/journal');
    await expect(page.getByText('Kept to myself.')).toBeVisible();

    // The feed leaves the navigation, and its address says sharing is paused
    await navGroupButton(page, 'Social').click();
    await expect(page.getByRole('navigation').getByRole('button', { name: 'People', exact: true })).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('button', { name: 'Feed', exact: true })).toHaveCount(0);
    await navGroupButton(page, 'Social').click();

    // The composer is locked on private, whatever the default, and the entry is saved private
    const composerToggle = page.getByTitle('Sharing is turned off for now, so new entries are saved private.').first();
    await expect(composerToggle).toBeDisabled();
    await page.getByPlaceholder("What's on your mind?").fill('Written while sharing is paused.');
    await page.locator('input[placeholder="tags..."]').first().fill('paused');
    await page.locator('input[placeholder="tags..."]').first().press('Enter');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Written while sharing is paused.')).toBeVisible();
    expect(state.entries.find((entry) => entry.content === 'Written while sharing is paused.')?.visibility).toBe('private');

    // A private entry cannot be made public; the public one keeps its visibility and can be made private
    await expect(page.locator(`#entry-${PRIVATE_ENTRY.id}`).getByTitle('Sharing is turned off for now, so new entries are saved private.')).toBeDisabled();
    const publicEntry = page.locator(`#entry-${PUBLIC_ENTRY.id}`);
    await expect(publicEntry.getByRole('button', { name: 'Public - visible to everyone' })).toBeEnabled();
    expect(state.entries.find((entry) => entry.id === PUBLIC_ENTRY.id)?.visibility).toBe('public');

    // Private links: none is made, and the dialog says why
    await publicEntry.getByLabel('More actions').click();
    await page.getByRole('menuitem', { name: 'Share privately…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Share privately' });
    await expect(dialog.getByRole('note')).toContainText('the feed and private links are paused');
    await expect(dialog.getByLabel('Link expires')).toHaveCount(0);
    await page.keyboard.press('Escape');

    await page.goto('/feed');
    await expect(page.getByRole('heading', { name: 'Feed', level: 1 })).toBeVisible();
    await expect(page.getByRole('note').filter({ hasText: 'Nothing you shared was changed' })).toBeVisible();
    expect(state.featureDisabledRequests).toEqual([]);
  });

  test('says a switched-off feature is off in French too', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' }, featureFlags: { publicSharing: false } });
    await page.goto('/feed');

    await expect(page.getByRole('note').filter({ hasText: 'Le partage est désactivé pour le moment' })).toBeVisible();
  });
});
