import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import type { MockEntry } from '../support/mockApp.shared';

const ENTRIES: MockEntry[] = [
  { id: 301, date: '2026-10-20', index: 1, title: 'Harbor run', time_of_day: '07:30', mood: 4, content: 'A morning run by the harbor.', tags: ['running'], visibility: 'public', diaryId: 1 },
  { id: 302, date: '2026-10-20', index: 2, content: 'Errands and a long call with the bank about the loan.', tags: [], visibility: 'private', diaryId: 2 },
  { id: 303, date: '2026-10-20', index: 3, content: 'Evening reading by the window.', tags: [], visibility: 'private', diaryId: 1 },
  { id: 304, date: '2026-10-20', index: 4, content: 'Late tea before bed.', tags: [], visibility: 'private', diaryId: 1 },
  { id: 305, date: '2026-10-05', index: 1, content: '## Quiet Monday\n\nAt home all day.', format: 'markdown', mood: 2, tags: [], visibility: 'private', diaryId: 1 },
  { id: 306, date: '2026-09-12', index: 1, content: 'September picnic in the park.', tags: ['family'], visibility: 'private', is_favorite: true, diaryId: 1 },
  { id: 307, date: '2025-11-18', index: 1, content: 'Notes from last November.', tags: [], visibility: 'private', diaryId: 1 },
  { id: 308, date: '2026-10-08', index: 1, content: 'Put away for later.', tags: [], visibility: 'private', is_archived: true, diaryId: 1 },
];

async function openCalendar(page: Page, path = '/journal?diary=all') {
  await page.clock.setFixedTime(new Date('2026-10-21T09:00:00'));
  await page.goto(path);
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  const grid = page.getByRole('grid', { name: 'October 2026' });
  await expect(grid).toBeVisible();
  return grid;
}

const day = (page: Page, date: RegExp | string) => page.getByRole('gridcell', { name: date });

async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map((node) => node.failureSummary) }))).toEqual([]);
}

test.describe('Journal calendar', () => {
  test('shows the month with each day’s entries, keeps the layout in the URL, and follows the diary and filters', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
    const grid = await openCalendar(page);
    await expect(page).toHaveURL(/\/journal\?diary=all&layout=calendar$/);

    const today = day(page, 'Wednesday, October 21, 2026: 0 entries, today');
    await expect(today).toHaveAttribute('aria-current', 'date');
    await expect(today).toHaveAttribute('tabindex', '0');
    const busyDay = day(page, 'Tuesday, October 20, 2026: 4 entries');
    await expect(busyDay.getByRole('button')).toHaveText(['Errands and a long call with the bank about the loan.', 'Evening reading by the window.', 'Late tea before bed.']);
    await expect(busyDay.getByText('+1')).toBeVisible();
    await expect(day(page, 'Monday, October 5, 2026: 1 entry').getByRole('button', { name: 'Open Quiet Monday At home all day., mood: Low' })).toBeVisible();
    // The archived entry stays out, as in the list
    await expect(day(page, 'Thursday, October 8, 2026: 0 entries')).toBeVisible();

    await page.getByTitle('Personal', { exact: true }).click();
    await expect(page).toHaveURL(/\/journal\?diary=2&layout=calendar$/);
    await expect(day(page, 'Tuesday, October 20, 2026: 1 entry')).toBeVisible();
    await page.getByTitle('All Diaries', { exact: true }).click();
    await expect(day(page, 'Tuesday, October 20, 2026: 4 entries')).toBeVisible();

    await page.getByTitle('Show favorites only').click();
    await expect(page.getByText('No entries this month match the filters.')).toBeVisible();
    await page.getByRole('button', { name: 'Previous month' }).click();
    await expect(page.getByRole('grid', { name: 'September 2026' })).toBeVisible();
    await expect(page).toHaveURL(/layout=calendar&month=2026-09$/);
    await expect(day(page, 'Saturday, September 12, 2026: 1 entry').getByRole('button', { name: 'Open September picnic in the park.' })).toBeVisible();

    await page.getByRole('button', { name: 'Previous year' }).click();
    await expect(page.getByRole('grid', { name: 'September 2025' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Go to year' }).selectOption('2026');
    await expect(page.getByRole('grid', { name: 'September 2026' })).toBeVisible();
    await page.getByRole('button', { name: 'Today' }).click();
    await expect(grid).toBeVisible();

    // The address opens the same month again
    await page.goto('/journal?diary=all&layout=calendar&month=2025-11');
    await expect(day(page, 'Tuesday, November 18, 2025: 1 entry')).toBeVisible();

    await page.getByRole('button', { name: 'List', exact: true }).click();
    await expect(page).toHaveURL(/\/journal\?diary=all$/);
    await expect(page.locator('#entry-301')).toBeVisible();
  });

  test('moves between days, weeks, months and years with the keyboard and opens a day in the list', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
    await openCalendar(page);

    await day(page, /October 21, 2026/).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(day(page, /October 20, 2026/)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(day(page, /October 13, 2026/)).toBeFocused();
    await page.keyboard.press('Home');
    await expect(day(page, /Monday, October 12, 2026/)).toBeFocused();
    await page.keyboard.press('End');
    await expect(day(page, /Sunday, October 18, 2026/)).toBeFocused();
    await expect(day(page, /October 18, 2026/)).toHaveAttribute('tabindex', '0');
    await page.keyboard.press('PageDown');
    await expect(page.getByRole('grid', { name: 'November 2026' })).toBeVisible();
    await expect(day(page, /November 18, 2026/)).toBeFocused();
    await page.keyboard.press('Shift+PageUp');
    await expect(day(page, 'Tuesday, November 18, 2025: 1 entry')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(day(page, /December 2, 2025/)).toBeFocused();
    await expect(page).toHaveURL(/month=2025-12$/);
    await page.keyboard.press('PageUp');
    await expect(day(page, /November 2, 2025/)).toBeFocused();
    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowRight']) {
      await page.keyboard.press(key);
    }
    await expect(day(page, /November 18, 2025/)).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/journal\?diary=all$/);
    await expect(page.getByPlaceholder('Filter by date')).toHaveValue('2025-11-18');
    await expect(page.locator('#entry-307')).toBeVisible();
    await expect(page.locator('#entry-301')).toHaveCount(0);

    // Back returns to the calendar, with the filtered day marked
    await page.goBack();
    await expect(day(page, /November 18, 2025/)).toHaveAttribute('aria-selected', 'true');
  });

  test('opens an entry in the list through its permalink', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
    await openCalendar(page, '/journal?diary=1');

    await day(page, /October 20, 2026/).getByRole('button', { name: /Evening reading/ }).click();
    await expect(page).toHaveURL(/\/journal\?diary=all&entry=303$/);
    await expect(page.locator('#entry-303')).toBeVisible();
    await expect(page.getByRole('button', { name: 'List', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });

  test('shows dots on a phone and the day’s entries in the list when a day is tapped', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
    await openCalendar(page);

    const busyDay = day(page, 'Tuesday, October 20, 2026: 4 entries');
    await expect(busyDay.getByRole('button', { name: /Evening reading/ })).toBeHidden();
    await busyDay.click();
    await expect(page.getByPlaceholder('Filter by date')).toHaveValue('2026-10-20');
    for (const id of [301, 302, 303, 304]) {
      await expect(page.locator(`#entry-${id}`)).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('speaks French', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' }, initialEntries: ENTRIES });
    await page.clock.setFixedTime(new Date('2026-10-21T09:00:00'));
    await page.goto('/journal?diary=all');
    await page.getByRole('button', { name: 'Calendrier' }).click();

    await expect(page.getByRole('grid', { name: 'Octobre 2026' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'lundi' })).toBeVisible();
    await expect(day(page, 'mardi 20 octobre 2026 : 4 entrées')).toBeVisible();
    await expect(day(page, 'mercredi 21 octobre 2026 : 0 entrée, aujourd’hui')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mois précédent' })).toBeVisible();
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`has no accessibility violations in the ${theme} theme`, async ({ page }) => {
      await setupMockApp(page, { startAuthenticated: true, config: { theme }, initialEntries: ENTRIES });
      await openCalendar(page);
      await expect(day(page, 'Tuesday, October 20, 2026: 4 entries')).toBeVisible();
      await day(page, /October 21, 2026/).focus();
      await page.keyboard.press('ArrowLeft');
      await expectNoAccessibilityViolations(page);

      await page.getByTitle('Show favorites only').click();
      await expect(page.getByText('No entries this month match the filters.')).toBeVisible();
      await expectNoAccessibilityViolations(page);
    });
  }
});
