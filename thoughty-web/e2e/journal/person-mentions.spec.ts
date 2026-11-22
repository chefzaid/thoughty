import AxeBuilder from '../support/axe';
import { test, expect, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import type { MockPerson } from '../support/mockApp.routes.people';

const entry = (id: number, date: string, content: string, mood?: number) => ({
  id, date, index: 1, content, tags: [], visibility: 'private' as const, diaryId: 1, ...(mood ? { mood } : {}),
});

const ENTRIES = [
  entry(801, '2025-06-14', 'Hike with @Marie.', 5),
  entry(802, '2026-03-02', 'Coffee with @Marie and @Paul.', 4),
  entry(803, '2026-03-20', 'Called @Marie.', 2),
  entry(804, '2026-11-02', 'Lunch with @Paul.'),
  entry(805, '2026-12-24', 'Christmas plans with @Marie.', 5),
];

const person = (id: number, name: string, extra: Partial<MockPerson> = {}): MockPerson => ({
  id, name, handles: [name.toLowerCase()], createdAt: '2026-01-01T09:00:00.000Z', updatedAt: '2026-01-01T09:00:00.000Z', ...extra,
});

async function expectNoAxeViolations(page: Page, selector: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .include(selector)
    .analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
}

test.describe('Mentions over time', () => {
  for (const theme of ['dark', 'light'] as const) {
    test(`shows a person’s mentions month by month and year by year with their mood in the ${theme} theme`, async ({ page }) => {
      await page.clock.setFixedTime(new Date('2026-11-22T12:00:00'));
      await setupMockApp(page, {
        startAuthenticated: true,
        initialEntries: ENTRIES,
        config: { theme },
        people: [person(1, 'Marie'), person(2, 'Paul')],
      });
      await page.goto('/people');

      const row = page.getByRole('listitem').filter({ hasText: '@marie' }).first();
      const toggle = row.getByRole('button', { name: 'Mentions of Marie over time' });
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');

      const panel = row.getByRole('region', { name: 'Mentions of Marie over time' });
      // The Christmas entry is after the writer's day, so it is left out
      await expect(panel.getByText('2 entries in the last 12 months')).toBeVisible();
      const months = panel.getByRole('list', { name: 'The last 12 months' }).getByRole('listitem');
      await expect(months).toHaveCount(12);
      await expect(months.first()).toContainText('December 2025: 0 entries');
      await expect(months.nth(3)).toContainText('March 2026: 2 entries, average mood 3.0 out of 5 (Okay)');
      await expect(panel.getByRole('table', { name: 'By year' }).getByRole('row')).toHaveText([
        'YearEntriesAverage mood',
        '202623.0 out of 5 (Okay)',
        '202515.0 out of 5 (Very good)',
      ]);
      await expectNoAxeViolations(page, 'main');

      await toggle.click();
      await expect(panel).toHaveCount(0);
    });
  }

  test('shows the mentions of anyone in the chosen group, each entry once, in French', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-22T12:00:00'));
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: ENTRIES,
      config: { language: 'fr', theme: 'light' },
      people: [person(1, 'Marie', { groups: ['Amis'] }), person(2, 'Paul', { groups: ['amis'] }), person(3, 'Lea', { groups: ['Travail'] })],
    });
    await page.goto('/people');

    await page.getByRole('combobox', { name: 'Groupe' }).selectOption({ label: 'Amis (2)' });
    const panel = page.getByRole('region', { name: 'Mentions de Amis au fil du temps' });
    await expect(panel.getByText('3 entrées sur les 12 derniers mois')).toBeVisible();
    await expect(panel.getByRole('list', { name: 'Les 12 derniers mois' }).getByRole('listitem').last())
      .toContainText('novembre 2026 : 1 entrée');
    await expect(panel.getByRole('table', { name: 'Par année' }).getByRole('row').nth(1)).toHaveText('202633,0 sur 5 (Moyenne)');

    await page.getByRole('combobox', { name: 'Groupe' }).selectOption({ label: 'Travail (1)' });
    await expect(page.getByRole('region', { name: 'Mentions de Travail au fil du temps' }))
      .toContainText('Aucune entrée ne mentionne encore quelqu’un de Travail.');
    await expectNoAxeViolations(page, 'main');
  });
});
