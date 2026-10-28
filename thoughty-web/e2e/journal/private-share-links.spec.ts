import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Browser, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { registerMockAppRoutes } from '../support/mockApp.routes';
import type { MockAppState } from '../support/mockApp.shared';

const ENTRY = {
  id: 701,
  date: '2026-10-12',
  index: 1,
  title: 'A walk by the sea',
  content: 'We walked to the lighthouse with @marie.\n\n![The shell we found](attachment:71)',
  format: 'markdown' as const,
  mood: 4,
  feelings: ['calm'],
  tags: ['family'],
  visibility: 'private' as const,
  diaryId: 1,
  attachments: [
    { id: 71, original_filename: 'shell.png', stored_filename: 'stored-shell.png', mimetype: 'image/png', size: 2048 },
    { id: 72, original_filename: 'notes.pdf', stored_filename: 'stored-notes.pdf', mimetype: 'application/pdf', size: 4096 },
  ],
};

async function expectNoAxeViolations(page: Page, include?: string) {
  const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
  const results = await (include ? builder.include(include) : builder).analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
}

/**
 * A reader who was only sent the link: a browser context of their own, with no session and no cookie.
 * The mock API answers it from the writer's state, as the real API would from the database.
 */
async function openAsReader(browser: Browser, state: MockAppState, url: string, colorScheme: 'dark' | 'light' = 'dark') {
  const context = await browser.newContext({ colorScheme });
  const page = await context.newPage();
  const apiCalls: string[] = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith('/api/')) apiCalls.push(pathname);
  });
  await registerMockAppRoutes(page, state);
  await page.goto(url);
  return {
    page,
    apiCalls,
    close: async () => {
      await page.goto('about:blank');
      await context.close();
    },
  };
}

async function createLink(page: Page, options: { showTags?: boolean; maxViews?: string } = {}) {
  const dialog = page.getByRole('dialog', { name: 'Share privately' });
  await expect(dialog.getByLabel('Link expires')).toBeFocused();
  if (options.showTags) await dialog.getByLabel('Show the tags').check();
  if (options.maxViews) await dialog.getByLabel('View limit (optional)').fill(options.maxViews);
  await dialog.getByLabel('Note for yourself (optional)').fill('For Mum');
  await dialog.getByRole('button', { name: 'Create link' }).click();
  await expect(dialog.getByText('Copy the link now: it is shown only this once.')).toBeVisible();
  const url = await dialog.getByLabel('Private link').inputValue();
  expect(url).toMatch(/^http:\/\/localhost:5173\/s\/[A-Za-z0-9_-]{43}$/);
  return { dialog, url };
}

test.describe('Private share links', () => {
  test('shares an entry with a reader who is not signed in, then revokes it', async ({ page, browser }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: [ENTRY] });
    await page.goto('/journal');

    const entry = page.locator(`#entry-${ENTRY.id}`);
    await entry.getByLabel('More actions').click();
    await page.getByRole('menuitem', { name: 'Share privately…' }).click();
    const { dialog, url } = await createLink(page, { showTags: true });
    await expect(dialog.getByRole('button', { name: 'Copy link' })).toBeFocused();
    await expect(dialog.getByText('For Mum')).toBeVisible();
    await expectNoAxeViolations(page, '[role="dialog"]');

    const reader = await openAsReader(browser, state, url);
    await expect(reader.page.getByRole('heading', { level: 1, name: 'A walk by the sea' })).toBeVisible();
    await expect(reader.page.getByRole('img', { name: 'The shell we found' })).toHaveJSProperty('complete', true);
    await expect(reader.page.getByRole('img', { name: 'The shell we found' })).toHaveAttribute('src', /^\/api\/shared\/[\w-]{43}\/attachments\/71$/);
    await expect(reader.page.getByRole('link', { name: /Download notes\.pdf/ })).toBeVisible();
    await expect(reader.page.getByRole('list', { name: 'Tags' })).toHaveText('#family');
    // The mood was not chosen; people stay text; none of the app is around it
    await expect(reader.page.getByText('Good')).toHaveCount(0);
    await expect(reader.page.getByRole('link', { name: '@marie' })).toHaveCount(0);
    await expect(reader.page.getByRole('navigation')).toHaveCount(0);
    await expect(reader.page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(reader.page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
    expect(reader.apiCalls.every((path) => path.startsWith('/api/shared/'))).toBe(true);
    await expectNoAxeViolations(reader.page);

    // The writer sees the view, and revokes the link
    await dialog.getByRole('button', { name: 'Close' }).first().click();
    await entry.getByLabel('More actions').click();
    await page.getByRole('menuitem', { name: 'Share privately…' }).click();
    await expect(dialog.getByText(/1 view/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Revoke For Mum' }).click();
    await expect(dialog.getByText('No active links.')).toBeVisible();

    await reader.page.reload();
    await expect(reader.page.getByRole('heading', { name: 'This link is not available' })).toBeVisible();
    await expect(reader.page.getByText('A walk by the sea')).toHaveCount(0);
    await expectNoAxeViolations(reader.page);
    await reader.close();
  });

  test('reads in the reader’s light theme and stops when the entry goes to the recycle bin', async ({ page, browser }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: [ENTRY], config: { language: 'fr', theme: 'light' } });
    await page.goto('/journal');

    const entry = page.locator(`#entry-${ENTRY.id}`);
    await entry.getByLabel("Plus d'actions").click();
    await page.getByRole('menuitem', { name: 'Partager en privé…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Partager en privé' });
    await dialog.getByRole('button', { name: 'Créer le lien' }).click();
    const url = await dialog.getByLabel('Lien privé').inputValue();
    await expectNoAxeViolations(page, '[role="dialog"]');

    const reader = await openAsReader(browser, state, url, 'light');
    await expect(reader.page.getByRole('heading', { level: 1, name: 'A walk by the sea' })).toBeVisible();
    await expect(reader.page.getByRole('list', { name: 'Tags' })).toHaveCount(0);
    await expectNoAxeViolations(reader.page);

    // Binning the entry: the mock drops it from the journal as the API's trigger drops its links
    state.entries = state.entries.filter((candidate) => candidate.id !== ENTRY.id);
    await reader.page.reload();
    await expect(reader.page.getByRole('heading', { name: 'This link is not available' })).toBeVisible();
    await reader.close();
  });

  test('shares a book version as a download, up to its view limit', async ({ page, browser }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [{ id: 1, date: '2024-05-01', index: 1, content: 'An idea for the garden', tags: ['ideas'], visibility: 'private', diaryId: 1 }],
    });
    await page.goto('/import-export?diary=1&section=book');
    const bookSection = page.locator('#book-section');
    await bookSection.getByLabel('Title').fill('Summer Notes');
    await bookSection.getByRole('button', { name: 'Save First Version' }).click();
    await bookSection.getByRole('button', { name: 'Share version 1 privately' }).click();

    const dialog = page.getByRole('dialog', { name: 'Share privately' });
    await expect(dialog.getByText(/Anyone with the link can download this book version/)).toBeVisible();
    await expect(dialog.getByLabel('Show the mood')).toHaveCount(0);
    const { url } = await createLink(page, { maxViews: '1' });
    await expectNoAxeViolations(page, '[role="dialog"]');

    const reader = await openAsReader(browser, state, url);
    await expect(reader.page.getByRole('heading', { level: 1, name: 'Summer Notes' })).toBeVisible();
    await expectNoAxeViolations(reader.page);
    const download = reader.page.waitForEvent('download');
    await reader.page.getByRole('button', { name: 'Download the book' }).click();
    expect((await download).suggestedFilename()).toMatch(/\.pdf$/);

    // Its one view is used: downloading again says the link stopped, as does opening it again
    await reader.page.getByRole('button', { name: 'Download the book' }).click();
    await expect(reader.page.getByRole('heading', { name: 'This link is not available' })).toBeVisible();
    await reader.page.reload();
    await expect(reader.page.getByRole('heading', { name: 'This link is not available' })).toBeVisible();
    await reader.close();

    await dialog.getByRole('button', { name: 'Close' }).first().click();
    await bookSection.getByRole('button', { name: 'Share version 1 privately' }).click();
    await expect(dialog.getByText(/No views left/)).toBeVisible();
  });
});
