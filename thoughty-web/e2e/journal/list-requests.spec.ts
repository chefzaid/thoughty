import { test, expect, type Page } from '@playwright/test';
import { setupMockApp } from '../support/mockApp';

const entries = [
  { id: 31, date: '2024-03-03', index: 1, content: 'Newest entry', tags: [], visibility: 'private' as const, diaryId: 1 },
  { id: 32, date: '2024-03-02', index: 1, content: 'Middle entry', tags: [], visibility: 'private' as const, diaryId: 1 },
  { id: 33, date: '2024-03-01', index: 1, content: 'Oldest permalink entry', tags: [], visibility: 'private' as const, diaryId: 1 },
];

/** Records the query string of every journal list request (not the lookups under /api/entries/...). */
function recordListRequests(page: Page): URLSearchParams[] {
  const requests: URLSearchParams[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/entries') {
      requests.push(url.searchParams);
    }
  });
  return requests;
}

test.describe('Journal list requests', () => {
  test('asks for the list once on first load, with the configured page size and default diary', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { entriesPerPage: 2 }, initialEntries: entries });
    const requests = recordListRequests(page);

    await page.goto('/journal');

    await expect(page.getByText('Newest entry')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(requests).toHaveLength(1);
    expect(requests[0]?.get('limit')).toBe('2');
    expect(requests[0]?.get('diaryId')).toBe('1');
    expect(requests[0]?.get('archiveStatus')).toBe('active');
  });

  test('asks for the list once on a permalink, on the page the entry is on', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { entriesPerPage: 2 }, initialEntries: entries });
    const requests = recordListRequests(page);

    await page.goto('/journal?entry=33');

    await expect(page.getByText('Oldest permalink entry')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(requests).toHaveLength(1);
    expect(requests[0]?.get('page')).toBe('2');
    expect(requests[0]?.get('limit')).toBe('2');
    // The permalink shows every diary and archived entries too
    expect(requests[0]?.has('diaryId')).toBe(false);
    expect(requests[0]?.has('archiveStatus')).toBe(false);
  });

  test('still shows the journal, at the default page size, when the config request fails', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { entriesPerPage: 2 }, initialEntries: entries });
    await page.route('**/api/config', (route) => route.fulfill({ status: 500, json: { error: 'Config unavailable' } }));
    const requests = recordListRequests(page);

    await page.goto('/journal');

    await expect(page.getByText('Oldest permalink entry')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(requests).toHaveLength(1);
    expect(requests[0]?.get('limit')).toBe('10');
  });
});
