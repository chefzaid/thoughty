import AxeBuilder from '../support/axe';
import { expect, test, type Locator, type Page } from '../support/test';

import { buildZip } from '../../src/test/zipFixture';
import { setupMockApp } from '../support/mockApp';
import { goToView } from '../support/navigation';

type RouteContent = (page: Page) => Locator[];

/**
 * What each route shows once its content has loaded. The routes render after the session check and
 * fill in from the API, so a scan right after `goto` would see an empty page; each scan waits for these.
 */
const PUBLIC_ROUTES: Record<string, RouteContent> = {
  '/': (page) => [page.getByRole('heading', { level: 1, name: 'A private journal that becomes your life story.' })],
  '/login': (page) => [page.getByRole('textbox', { name: 'Email or Username' }), page.getByRole('button', { name: 'Sign In', exact: true })],
  '/register': (page) => [page.getByRole('textbox', { name: 'Confirm Password' })],
  '/verify-email?token=valid-token': (page) => [page.getByRole('status').filter({ hasText: 'Your email is verified.' })],
  '/about': (page) => [page.getByRole('heading', { name: 'Small, product-led, and close to the writing.' })],
  '/privacy': (page) => [page.getByRole('heading', { name: 'Security and providers' })],
  '/terms': (page) => [page.getByRole('heading', { name: 'Service changes' })],
  '/contact': (page) => [page.getByRole('button', { name: 'Open the community board' }), page.getByRole('heading', { name: 'Which formats are available?' })],
  '/feedback': (page) => [page.getByRole('button', { name: 'Sign in to vote for Mood calendar' })],
  '/blog': (page) => [page.getByRole('heading', { name: 'Prompts for writing when the day feels noisy' })],
};

const AUTHENTICATED_ROUTES: Record<string, RouteContent> = {
  '/journal': (page) => [
    page.getByRole('button', { name: 'Manage Diaries' }),
    page.getByRole('textbox', { name: 'Date of the entry' }),
    page.getByText('No entries found'),
  ],
  '/feed': (page) => [page.getByText('No public entries from the community yet.')],
  '/memoir': (page) => [page.getByRole('form', { name: 'Start your memoir' })],
  '/tags': (page) => [page.getByRole('textbox', { name: 'New tag' }), page.getByRole('heading', { name: 'Tag Organization' })],
  // Every section, including those that load their own data: achievements, two-factor, sessions,
  // life eras, the opt-in emails, the AI models and key, cloud storage and the plan
  '/profile': (page) => [
    page.getByRole('region', { name: 'Achievements' }).getByRole('progressbar', { name: 'Progress: 0 of 1', exact: true }),
    page.getByRole('combobox', { name: 'Gender' }),
    page.getByText('Verify your email before enabling two-factor authentication.'),
    page.getByRole('cell', { name: 'Current session' }),
    page.getByText('0 of 100 eras'),
    page.getByRole('switch', { name: 'Email me “On this day”' }),
    page.getByRole('switch', { name: 'Email me a monthly recap' }),
    page.getByRole('combobox', { name: 'Font style' }),
    page.getByText('Using the server key'),
    page.getByRole('button', { name: /^Model / }),
    page.getByText(/^Connected since/).first(),
    page.getByRole('combobox', { name: 'Plan' }),
  ],
  '/diaries': (page) => [page.getByRole('textbox', { name: 'Diary Name' }), page.getByText('Default Diary')],
  '/stats': (page) => [
    page.getByText('This diary has no writing goal yet.'),
    page.getByText('No journaling activity yet.'),
    page.getByText('The words you use at least twice this month will show here.'),
  ],
  '/review': (page) => [page.getByText('Write your first entry to start your year in review.')],
  '/import-export': (page) => [
    page.getByRole('region', { name: 'From another app' }),
    page.getByRole('heading', { name: 'Import from Cloud' }),
    page.getByRole('textbox', { name: 'Dedication' }),
  ],
  '/recycle-bin': (page) => [page.getByText('The recycle bin is empty. Entries you delete wait here for 30 days.')],
};

const THEMES = ['dark', 'light'] as const;

async function expectNoAccessibilityViolations(page: Page, include?: string) {
  await expect(page.locator('body')).toBeVisible();
  let axe = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
  if (include) axe = axe.include(include);
  const results = await axe.analyze();
  const violations = results.violations.map(({ help, id, impact, nodes }) => ({
    help,
    id,
    impact,
    targets: nodes.map((node) => node.target),
  }));

  expect(violations).toEqual([]);
}

test.describe('route accessibility', () => {
  test.setTimeout(60_000);

  for (const theme of THEMES) {
    for (const [path, content] of Object.entries(PUBLIC_ROUTES)) {
      test(`${theme} public route ${path}`, async ({ page }) => {
        await setupMockApp(page, { config: { theme } });
        await page.goto(path);
        for (const part of content(page)) await expect(part).toBeVisible();

        await expectNoAccessibilityViolations(page);
      });
    }

    for (const [path, content] of Object.entries(AUTHENTICATED_ROUTES)) {
      test(`${theme} authenticated route ${path}`, async ({ page }) => {
        await setupMockApp(page, { startAuthenticated: true, config: { theme } });
        await page.goto(path);
        for (const part of content(page)) await expect(part).toBeVisible();

        await expectNoAccessibilityViolations(page);
      });
    }
  }

  for (const theme of THEMES) {
    test(`${theme} recycle bin with entries waiting and a delete confirmation`, async ({ page }) => {
      await setupMockApp(page, {
        startAuthenticated: true,
        config: { theme },
        initialTrash: [
          { id: 41, date: '2026-10-20', index: 1, content: 'Rain on the tram window.', tags: ['commute'], visibility: 'private', diaryId: 2, deletedAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString() },
          { id: 42, date: '2026-10-18', index: 1, content: 'Bread from the corner bakery.', tags: [], visibility: 'private', diaryId: 1, deletedAt: new Date().toISOString() },
        ],
      });
      await page.goto('/recycle-bin');
      await expect(page.getByRole('article')).toHaveCount(2);
      await expectNoAccessibilityViolations(page);

      await page.getByRole('button', { name: 'Delete the entry of October 20, 2026 forever' }).click();
      await expect(page.getByRole('heading', { name: 'Delete forever?' })).toBeVisible();
      await expectNoAccessibilityViolations(page);
    });
  }

  for (const theme of THEMES) {
    test(`${theme} profile with two-factor on, its turn-off form, and the account deletion confirmation`, async ({ page }) => {
      const { state } = await setupMockApp(page, { startAuthenticated: true, config: { theme } });
      state.user.emailVerified = true;
      state.user.twoFactorEnabled = true;
      await page.goto('/profile');
      await expect(page.getByText('Enabled', { exact: true })).toBeVisible();
      await expectNoAccessibilityViolations(page, '.profile-two-column');

      await page.getByRole('button', { name: 'Disable two-factor authentication' }).click();
      await page.getByRole('button', { name: 'Delete Account' }).click();
      await expect(page.getByRole('textbox', { name: 'Type DELETE to confirm' })).toBeVisible();
      await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
      await expectNoAccessibilityViolations(page, '.profile-two-column');
    });
  }

  for (const theme of THEMES) {
    test(`${theme} journal search with its help, result order, and highlights`, async ({ page }) => {
      await setupMockApp(page, {
        startAuthenticated: true,
        config: { theme },
        initialEntries: [
          { id: 51, date: '2026-10-20', index: 1, content: 'A morning run by the harbor.', tags: ['running'], visibility: 'private', diaryId: 1 },
          { id: 52, date: '2026-10-19', index: 1, content: 'Morning run, then morning coffee.', tags: [], visibility: 'private', diaryId: 1 },
        ],
      });
      await page.goto('/journal');
      await page.getByRole('textbox', { name: 'Search entries' }).fill('morning');
      await expect(page.locator('#entry-52 mark').first()).toBeVisible();
      await expect(page.getByRole('group', { name: 'Order of search results' })).toBeVisible();

      await expectNoAccessibilityViolations(page);
    });
  }

  for (const theme of THEMES) {
    test(`${theme} guided memoir in progress with an open answer`, async ({ page }) => {
      await setupMockApp(page, { startAuthenticated: true, config: { theme }, memoirProgram: { diaryId: 1 } });
      await page.goto('/memoir');
      await page.getByRole('button', { name: 'Answer', exact: true }).click();

      await expectNoAccessibilityViolations(page);
    });
  }

  for (const theme of THEMES) {
    test(`${theme} year in review with its mood and share form`, async ({ page }) => {
      await setupMockApp(page, {
        startAuthenticated: true,
        config: { theme },
        initialEntries: [
          { id: 1, date: '2025-02-03', index: 1, content: 'Snow and soup.', tags: ['winter'], visibility: 'private', is_favorite: true },
          { id: 2, date: '2025-05-20', index: 1, content: 'Long walk by the sea.', tags: ['walks'], visibility: 'private' },
          { id: 3, date: '2025-11-02', index: 1, content: 'Leaves everywhere.', tags: ['walks'], visibility: 'private' },
        ],
      });
      await page.goto('/review?year=2025');
      const mood = page.getByRole('region', { name: 'The mood of your year' });
      await mood.getByRole('button', { name: 'Read the mood of my year' }).click();
      await expect(mood.getByRole('img')).toBeVisible();
      await page.getByRole('button', { name: 'Share a summary' }).click();

      await expectNoAccessibilityViolations(page);
    });
  }

  for (const theme of THEMES) {
    test(`${theme} Day One import preview and result`, async ({ page }) => {
      await setupMockApp(page, { startAuthenticated: true, config: { theme } });
      await page.goto('/import-export?section=import');
      const panel = page.getByRole('region', { name: 'From another app' });
      const archive = await buildZip([
        { name: 'Journal.json', data: JSON.stringify({ metadata: {}, entries: [{ uuid: 'A', creationDate: '2024-03-05T10:00:00Z', text: 'Hello' }] }) },
        { name: 'Travel.json', data: JSON.stringify({ metadata: {}, entries: [{ uuid: 'B', creationDate: '2024-03-06T10:00:00Z', text: 'Bye' }] }) },
      ]);
      await panel.getByLabel('Choose an export').setInputFiles({ name: 'export.zip', mimeType: 'application/zip', buffer: Buffer.from(archive) });
      await expect(panel.getByRole('button', { name: 'Start the import' })).toBeVisible();

      await expectNoAccessibilityViolations(page);
      await panel.getByRole('button', { name: 'Start the import' }).click();
      await expect(panel.getByText('Import finished')).toBeVisible();
      await expectNoAccessibilityViolations(page);
    });
  }

  test('public skip links and route changes move focus to page content', async ({ page }) => {
    await setupMockApp(page);
    await page.goto('/');
    // The page renders once the session check (a refresh call) has answered
    await expect(page.getByRole('button', { name: 'Sign In' }).first()).toBeVisible();

    await page.keyboard.press('Tab');
    const publicSkipLink = page.getByRole('link', { name: 'Skip to content' });
    await expect(publicSkipLink).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#public-page-content')).toBeFocused();

    await page.getByRole('button', { name: 'Sign In' }).first().click();
    await expect(page.locator('#public-page-content')).toBeFocused();
  });

  test('authenticated route changes move focus to main content', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/journal');

    await goToView(page, 'Tags');
    await expect(page.locator('#main-content')).toBeFocused();
  });

  for (const theme of THEMES) {
    test(`${theme} journal theme review dialog`, async ({ page }) => {
      await setupMockApp(page, {
        startAuthenticated: true,
        config: { theme },
        initialEntries: [{
          id: 300,
          date: '2026-05-03',
          index: 1,
          content: 'I am learning to make steady progress.',
          tags: ['reflection'],
          visibility: 'private',
          diaryId: 1,
        }],
      });
      await page.goto('/tags');
      await page.getByRole('button', { name: 'Organize journal tags' }).click();
      await expect(page.getByRole('dialog', { name: 'Review suggested tags' })).toBeVisible();

      await expectNoAccessibilityViolations(page, '.journal-retag-dialog');
    });

    test(`${theme} duplicate review dialog`, async ({ page }) => {
      await setupMockApp(page, {
        startAuthenticated: true,
        config: { theme },
        initialEntries: [{
          id: 301,
          date: '2026-05-02',
          index: 1,
          content: 'I chose to protect mornings for focused work.',
          tags: ['focus'],
          visibility: 'private',
          diaryId: 1,
        }, {
          id: 302,
          date: '2026-05-01',
          index: 1,
          content: 'Keeping mornings free for focus is the right decision.',
          tags: ['focus', 'decision'],
          visibility: 'private',
          diaryId: 1,
        }],
      });
      await page.goto('/journal?diary=1');
      await page.getByRole('button', { name: 'Find duplicates' }).click();
      await expect(page.getByRole('dialog', { name: 'Similar entries' })).toBeVisible();

      await expectNoAccessibilityViolations(page, '.duplicate-review-dialog');
    });

    test(`${theme} semantic search controls`, async ({ page }) => {
      await setupMockApp(page, {
        startAuthenticated: true,
        config: { theme },
        initialEntries: [{
          id: 303,
          date: '2026-05-03',
          index: 1,
          content: 'I made room for a calmer season of work.',
          tags: ['semantic-match'],
          visibility: 'private',
          diaryId: 1,
        }],
      });
      await page.goto('/journal?diary=1');
      await page.getByRole('button', { name: 'Meaning' }).click();
      await page.getByPlaceholder('Search by meaning or idea...').fill('healthier work choices');
      await page.keyboard.press('Enter');
      await expect(page.getByText('Closest matches: 1. Entries analyzed: 1.')).toBeVisible();

      await expectNoAccessibilityViolations(page, '.semantic-search-control');
    });
  }
});
