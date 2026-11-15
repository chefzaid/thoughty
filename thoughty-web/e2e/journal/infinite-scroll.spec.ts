import { expect, test, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import type { MockEntry } from '../support/mockApp.shared';

/** Fifty entries, one a day from 2026-10-31 back to 2026-09-12, the oldest ones tagged `autumn`. */
const ENTRIES: MockEntry[] = Array.from({ length: 50 }, (_, day) => {
  const date = new Date(Date.UTC(2026, 9, 31 - day)).toISOString().slice(0, 10);
  return {
    id: 1000 + day,
    date,
    index: 1,
    content: `Entry number ${day + 1}, written on ${date}.`,
    tags: day >= 25 ? ['autumn'] : [],
    visibility: 'private',
    diaryId: 1,
  };
});

const articles = (page: Page) => page.getByRole('feed', { name: 'Journal entries' }).getByRole('article');
const listRequests = (page: Page): URLSearchParams[] => {
  const requests: URLSearchParams[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/entries' && request.method() === 'GET') requests.push(url.searchParams);
  });
  return requests;
};
/** The journal without IntersectionObserver, so only the buttons and the keys load more. */
const withoutIntersectionObserver = (page: Page) =>
  page.addInitScript(() => { Reflect.deleteProperty(globalThis, 'IntersectionObserver'); });

test.describe('Journal infinite scroll', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('loads the next entries as the list nears its end, each batch after the last one, until every entry is shown', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
    const requests = listRequests(page);
    await page.goto('/journal?diary=all');
    await expect(articles(page)).toHaveCount(20);
    await expect(articles(page).first()).toHaveAttribute('aria-setsize', '50');
    await expect(articles(page).first()).toHaveAttribute('aria-posinset', '1');

    await articles(page).last().scrollIntoViewIfNeeded();
    await expect(articles(page)).toHaveCount(40);
    await expect(page.getByRole('status').filter({ hasText: '20 more entries loaded, 40 of 50 shown.' })).toBeAttached();
    await articles(page).last().scrollIntoViewIfNeeded();
    await expect(articles(page)).toHaveCount(50);
    await expect(page.getByText('No more entries to load.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Load more entries' })).toHaveCount(0);

    expect(requests.map((query) => query.get('after') ?? 'start')).toEqual(['start', '1_2026-10-12__1_1019', '1_2026-09-22__1_1039']);
    await expect(page.locator('#entry-1049')).toBeAttached();
  });

  test('keeps the filters in every batch', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
    const requests = listRequests(page);
    await page.goto('/journal?diary=all');
    await expect(articles(page)).toHaveCount(20);

    await page.getByPlaceholder('Filter by tags...').fill('autumn');
    await page.keyboard.press('Enter');
    await expect(articles(page)).toHaveCount(20);
    await expect(articles(page).first()).toHaveAttribute('aria-setsize', '25');
    await articles(page).last().scrollIntoViewIfNeeded();
    await expect(articles(page)).toHaveCount(25);

    const after = requests.filter((query) => query.has('after')).at(-1);
    expect(after?.get('tags')).toBe('autumn');
    expect(after?.get('archiveStatus')).toBe('active');
  });

  test('loads more with the button where IntersectionObserver is missing, keeping focus', async ({ page }) => {
    await withoutIntersectionObserver(page);
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
    await page.goto('/journal?diary=all');
    await expect(articles(page)).toHaveCount(20);

    const loadMore = page.getByRole('button', { name: 'Load more entries' });
    await loadMore.focus();
    await page.keyboard.press('Enter');
    await expect(articles(page)).toHaveCount(40);
    await expect(loadMore).toBeFocused();

    // The last batch takes the button away; focus moves to the first entry it brought
    await page.keyboard.press('Enter');
    await expect(articles(page)).toHaveCount(50);
    await expect(loadMore).toHaveCount(0);
    await expect(page.locator('article[data-entry-id="1040"]')).toBeFocused();
  });

  test('moves across entries with the arrow keys, loading the next batch at the end', async ({ page }) => {
    await withoutIntersectionObserver(page);
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
    await page.goto('/journal?diary=all');
    await expect(articles(page)).toHaveCount(20);

    await page.locator('article[data-entry-id="1018"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('article[data-entry-id="1019"]')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(articles(page)).toHaveCount(40);
    await expect(page.locator('article[data-entry-id="1020"]')).toBeFocused();
    await expect(page.locator('article[data-entry-id="1020"]')).toBeInViewport();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('article[data-entry-id="1019"]')).toBeFocused();

    // Typing is left alone
    await page.getByPlaceholder("What's on your mind?").focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByPlaceholder("What's on your mind?")).toBeFocused();
  });

  test('opens a permalink around an old entry and adds the newer ones above without moving the screen', async ({ page }) => {
    await withoutIntersectionObserver(page);
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
    const requests = listRequests(page);
    await page.goto('/journal?entry=1040');

    const target = page.locator('#entry-1040');
    await expect(target).toHaveClass(/highlight-entry/);
    await expect(target).toBeInViewport();
    await expect(page.locator('article[data-entry-id="1040"]')).toHaveAttribute('aria-posinset', '41');
    expect(requests.map((query) => query.get('around'))).toEqual(['1040']);
    await expect(page.locator('#entry-1000')).toHaveCount(0);

    // The entry at the top of the window stays where it is on screen while the newer ones come in above it
    const newer = page.getByRole('button', { name: 'Show newer entries' });
    await newer.scrollIntoViewIfNeeded();
    const top = page.locator('#entry-1030');
    const before = (await top.boundingBox())!.y;
    await newer.click();
    await expect(page.locator('#entry-1029')).toBeAttached();
    await expect.poll(async () => Math.round((await top.boundingBox())!.y)).toBe(Math.round(before));
    expect(requests.at(-1)?.has('before')).toBe(true);

    await page.getByRole('button', { name: 'Show newer entries' }).click();
    await expect(page.locator('#entry-1000')).toBeAttached();
    await expect(page.getByRole('button', { name: 'Show newer entries' })).toHaveCount(0);
  });

  test('jumps to the first entry of a month among the filters', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
    const requests = listRequests(page);
    await page.goto('/journal?diary=all');
    await expect(articles(page)).toHaveCount(20);

    await page.getByLabel('Year', { exact: true }).selectOption('2026');
    await page.getByLabel('Month', { exact: true }).selectOption('2026-09');
    await page.getByRole('button', { name: 'Go', exact: true }).click();

    // The first entry of September is the oldest one, at the end of the list
    const target = page.locator('#entry-1049');
    await expect(target).toHaveClass(/highlight-entry/);
    await expect(target).toBeInViewport();
    expect(requests.at(-1)?.get('around')).toBe('1049');
    await expect(page.getByRole('button', { name: 'Load more entries' })).toHaveCount(0);
  });

  test('selects the loaded entries and says how many match', async ({ page }) => {
    await withoutIntersectionObserver(page);
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
    await page.goto('/journal?diary=all');
    await expect(articles(page)).toHaveCount(20);

    await page.getByRole('button', { name: 'Select', exact: true }).click();
    const selectAll = page.getByRole('checkbox', { name: 'Select the 20 loaded entries (50 match)' });
    await selectAll.check();
    await expect(page.getByText('20 selected')).toBeVisible();

    await page.getByRole('button', { name: 'Load more entries' }).click();
    await expect(articles(page)).toHaveCount(40);
    const more = page.getByRole('checkbox', { name: 'Select the 40 loaded entries (50 match)' });
    await expect(more).not.toBeChecked();
    await more.check();
    await expect(page.getByText('40 selected')).toBeVisible();
  });
});
