import AxeBuilder from '../support/axe';
import { test, expect, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import type { MockPerson } from '../support/mockApp.routes.people';

const ENTRIES = [
  { id: 501, date: '2025-06-01', index: 1, content: 'Picnic with @Marie by the lake', tags: [], visibility: 'private' as const, diaryId: 1 },
  { id: 502, date: '2026-01-10', index: 1, content: 'Long call with @Marie about her new job', tags: [], visibility: 'private' as const, diaryId: 2 },
  { id: 503, date: '2025-03-01', index: 1, content: 'Dinner with @Paul', tags: [], visibility: 'private' as const, diaryId: 1 },
];

const person = (id: number, name: string, date: MockPerson['date']): MockPerson => ({
  id, name, handles: [name.toLowerCase()], date, createdAt: '2026-01-01T09:00:00.000Z', updatedAt: '2026-01-01T09:00:00.000Z',
});

async function expectNoAxeViolations(page: Page, selector: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .include(selector)
    .analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
}

test.describe('Birthdays and anniversaries', () => {
  for (const theme of ['dark', 'light'] as const) {
    test(`gives a person a birthday on the People page in the ${theme} theme, refusing a leap day the year never had`, async ({ page }) => {
      await page.clock.setFixedTime(new Date('2026-11-01T12:00:00'));
      const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES, config: { theme } });
      await page.goto('/people');

      await page.getByRole('button', { name: 'Edit Marie', exact: true }).click();
      const group = page.getByRole('group', { name: 'Birthday or anniversary' });
      await group.getByRole('combobox', { name: 'Date' }).selectOption({ label: 'Birthday' });
      await group.getByRole('combobox', { name: 'Month' }).selectOption({ label: 'February' });
      await group.getByRole('combobox', { name: 'Day' }).selectOption('29');
      await group.getByRole('textbox', { name: 'Year (optional)' }).fill('2001');
      await expectNoAxeViolations(page, 'main');
      await page.getByRole('button', { name: 'Save' }).click();

      await expect(page.getByRole('alert')).toHaveText('This day does not exist in that month (29 February only in a leap year).');
      await expect(group.getByRole('combobox', { name: 'Date' })).toBeFocused();
      await group.getByRole('textbox', { name: 'Year (optional)' }).fill('2000');
      await page.getByRole('button', { name: 'Save' }).click();

      await expect(page.locator('#main-content').getByRole('status')).toHaveText('Saved for Marie.');
      await expect(page.getByRole('button', { name: 'Edit Marie', exact: true })).toBeFocused();
      await expect(page.getByRole('listitem').filter({ hasText: '@marie' })).toContainText('Birthday: February 29, 2000');
      expect(state.people.find((candidate) => candidate.name === 'Marie')?.date).toEqual({ kind: 'birthday', month: 2, day: 29, year: 2000 });
      await expectNoAxeViolations(page, 'main');
    });
  }

  test('shows the day’s people in Highlights with their entries, the newest opening the entry and the name their view', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-03-14T09:00:00'));
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: ENTRIES,
      people: [
        person(1, 'Marie', { kind: 'birthday', month: 3, day: 14, year: 1992 }),
        person(2, 'Paul', { kind: 'anniversary', month: 3, day: 14, year: null }),
        person(3, 'Zoe', { kind: 'birthday', month: 3, day: 15, year: null }),
      ],
    });
    await page.goto('/journal?diary=2');
    await page.getByRole('button', { name: 'Highlights' }).click();

    const dialog = page.getByRole('dialog', { name: 'Highlights' });
    await expect(dialog.getByRole('heading', { level: 3 })).toHaveText(['Birthdays and anniversaries', 'Random Thought']);
    const people = dialog.locator('.person-date');
    await expect(people).toHaveCount(2);
    await expect(people.nth(0)).toContainText('Marie · Birthday · Turns 34 today');
    await expect(people.nth(0)).toContainText('2 entries mention Marie');
    await expect(people.nth(0)).toContainText('Long call with @Marie about her new job');
    await expect(people.nth(1)).toContainText('Paul · Anniversary');
    await expect(people.nth(1)).toContainText('1 entry mentions Paul');
    await expectNoAxeViolations(page, '.thought-of-day-modal');

    // The newest entry about Marie is in another diary: it opens among all entries
    await people.nth(0).getByRole('button', { name: /Long call with @Marie/ }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('#entry-502')).toHaveClass(/highlight-entry/);

    await page.getByRole('button', { name: 'Highlights' }).click();
    await page.getByRole('dialog', { name: 'Highlights' }).getByRole('link', { name: 'Entries that mention Paul' }).click();
    await expect(page.getByRole('dialog', { name: 'Highlights' })).toHaveCount(0);
    await expect(page).toHaveURL(/\/journal\?diary=all&person=2$/);
    await expect(page.getByText('Dinner with @Paul')).toBeVisible();
  });

  test('shows a 29 February birthday on 28 February in a common year, without the age in quiet mode, in French', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2027-02-28T09:00:00'));
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: ENTRIES,
      config: { language: 'fr', quietMode: true },
      people: [person(1, 'Marie', { kind: 'birthday', month: 2, day: 29, year: 2000 })],
    });
    await page.goto('/journal?diary=all');
    await page.getByRole('button', { name: 'Moments forts' }).click();

    const birthday = page.getByRole('dialog', { name: 'Moments forts' }).locator('.person-date');
    await expect(page.getByRole('heading', { name: 'Anniversaires du jour' })).toBeVisible();
    await expect(birthday).toContainText('Marie · Anniversaire');
    await expect(birthday).toContainText('2 entrées mentionnent Marie');
    await expect(birthday).not.toContainText('ans aujourd’hui');
  });
});
