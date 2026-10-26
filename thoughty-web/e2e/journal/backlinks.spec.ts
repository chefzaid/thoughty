import { expect, test } from '../support/test';

import { setupMockApp } from '../support/mockApp';
import type { MockEntry, MockTrashedEntry } from '../support/mockApp.shared';

const firstOfDay: MockEntry = {
  id: 601,
  date: '2026-09-10',
  index: 1,
  content: 'Started the pottery class.',
  tags: ['craft'],
  visibility: 'private',
  diaryId: 1,
};

const secondOfDay: MockEntry = {
  id: 602,
  date: '2026-09-10',
  index: 2,
  content: 'Glazed the first bowl.',
  tags: [],
  visibility: 'private',
  diaryId: 1,
};

const plainReference: MockEntry = {
  id: 603,
  date: '2026-09-12',
  index: 1,
  title: 'Second lesson',
  content: 'The wheel felt easier than on [[2026-09-10]].',
  tags: ['craft'],
  visibility: 'private',
  diaryId: 2,
};

const numberedReference: MockEntry = {
  id: 604,
  date: '2026-09-14',
  index: 1,
  content: 'The bowl from [[2026-09-10#2]] came out of the kiln cracked.',
  tags: [],
  visibility: 'private',
  diaryId: 1,
};

const laterNumberedReference: MockEntry = {
  id: 606,
  date: '2026-09-16',
  index: 1,
  content: 'Glued the bowl from [[2026-09-10#2]] back together.',
  tags: [],
  visibility: 'private',
  diaryId: 1,
};

const trashedReference: MockTrashedEntry = {
  id: 605,
  date: '2026-09-15',
  index: 1,
  content: 'A draft about [[2026-09-10]] I threw away.',
  tags: [],
  visibility: 'private',
  diaryId: 1,
  deletedAt: new Date().toISOString(),
};

test.describe('Backlinks', () => {
  test('lists the live entries that reference an entry and opens them', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [firstOfDay, secondOfDay, plainReference, numberedReference, laterNumberedReference],
      initialTrash: [trashedReference],
    });
    await page.goto('/journal?diary=all');

    // `[[2026-09-10]]` points at the day's first entry only; the trashed draft is left out.
    const firstBacklinks = page.locator('#entry-601').getByRole('button', { name: /^2026-09-12/ });
    await expect(firstBacklinks).toHaveCount(1);
    await expect(firstBacklinks).toContainText('Second lesson');
    await expect(firstBacklinks).toContainText('Personal');
    await expect(page.locator('#entry-601').getByText('Backlinks')).toBeVisible();
    await expect(page.locator('#entry-601').getByText('1 link', { exact: true })).toBeVisible();
    await expect(page.locator('#entry-601').getByText('A draft about')).toHaveCount(0);

    // `[[2026-09-10#2]]` points at the second entry of the day.
    const secondBacklinks = page.locator('#entry-602').getByRole('button', { name: /^2026-09-14/ });
    await expect(secondBacklinks).toHaveCount(1);
    await expect(secondBacklinks).toContainText('came out of the kiln cracked');
    await expect(page.locator('#entry-602').getByRole('button', { name: /^2026-09-16/ })).toHaveCount(1);
    await expect(page.locator('#entry-602').getByText('2 links', { exact: true })).toBeVisible();

    // Entries nobody references have no backlinks panel.
    await expect(page.locator('#entry-603').getByText('Backlinks')).toHaveCount(0);
    await expect(page.locator('#entry-604').getByText('Backlinks')).toHaveCount(0);
    await expect(page.locator('#entry-606').getByText('Backlinks')).toHaveCount(0);

    await firstBacklinks.click();
    await expect(page.locator('#entry-603')).toHaveClass(/highlight-entry/);
  });
});
