import AxeBuilder from '../support/axe';
import { test, expect, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import type { MockPerson } from '../support/mockApp.routes.people';

const ENTRIES = [
  { id: 601, date: '2026-10-01', index: 1, content: 'Coffee with @Marie', tags: [], visibility: 'private' as const, diaryId: 1 },
  { id: 602, date: '2026-11-15', index: 1, content: 'Long walk with @Paul', tags: [], visibility: 'private' as const, diaryId: 2 },
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

test.describe('Reach-out reminders', () => {
  for (const theme of ['dark', 'light'] as const) {
    test(`sets a reminder and the last contact on the People page in the ${theme} theme, refusing a contact after today`, async ({ page }) => {
      await page.clock.setFixedTime(new Date('2026-11-22T12:00:00'));
      const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES, config: { theme } });
      await page.goto('/people');

      await page.getByRole('button', { name: 'Edit Marie', exact: true }).click();
      const group = page.getByRole('group', { name: 'Reach out' });
      await group.getByRole('combobox', { name: 'Remind me after' }).selectOption({ label: '1 month' });
      const lastContact = group.getByLabel('Last contact (optional)');
      await lastContact.fill('2026-11-25');
      await expectNoAxeViolations(page, 'main');
      await page.getByRole('button', { name: 'Save' }).click();

      await expect(page.getByRole('alert')).toHaveText('The last contact cannot be after today.');
      await expect(lastContact).toBeFocused();
      await lastContact.fill('2026-11-03');
      await page.getByRole('button', { name: 'Save' }).click();

      await expect(page.locator('#main-content').getByRole('status')).toHaveText('Saved for Marie.');
      await expect(page.getByRole('listitem').filter({ hasText: '@marie' }))
        .toContainText('Reach out after 1 month without contact · Last contact: Nov 3, 2026');
      const marie = state.people.find((candidate) => candidate.name === 'Marie');
      expect({ reachOutDays: marie?.reachOutDays, lastContactOn: marie?.lastContactOn }).toEqual({ reachOutDays: 30, lastContactOn: '2026-11-03' });
      await expectNoAxeViolations(page, 'main');
    });
  }

  test('lists the people due in Highlights, longest out of touch first, and takes one off with Contacted today', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-22T09:00:00'));
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: ENTRIES,
      people: [
        person(1, 'Marie', { reachOutDays: 30, lastContactOn: '2026-09-01' }),
        // Mentioned a week ago: not due yet
        person(2, 'Paul', { reachOutDays: 14 }),
        person(3, 'Zoe', { reachOutDays: 90 }),
      ],
    });
    await page.goto('/journal?diary=2');
    await page.getByRole('button', { name: 'Highlights' }).click();

    const dialog = page.getByRole('dialog', { name: 'Highlights' });
    await expect(dialog.getByRole('heading', { level: 3 })).toHaveText(['Time to reach out', 'Your week', 'Random Thought']);
    const due = dialog.locator('.reach-out');
    await expect(due).toHaveCount(2);
    await expect(due.nth(0)).toContainText('Zoe · reminder after 3 months');
    await expect(due.nth(0)).toContainText('No contact with Zoe and no entry about them on record yet.');
    await expect(due.nth(1)).toContainText('Marie · reminder after 1 month');
    await expect(due.nth(1)).toContainText('Last in touch 52 days ago');
    await expect(due.nth(1)).toContainText('Last contact: Sep 1, 2026 · Last mentioned: Oct 1, 2026');
    await expectNoAxeViolations(page, '.thought-of-day-modal');

    await dialog.getByRole('button', { name: 'Contacted Marie today' }).click();
    await expect(dialog.getByRole('status').filter({ hasText: 'Last contact with Marie set to today.' })).toHaveCount(1);
    await expect(due).toHaveCount(1);
    expect(state.people.find((candidate) => candidate.name === 'Marie')?.lastContactOn).toBe('2026-11-22');

    await dialog.getByRole('link', { name: 'Entries that mention Zoe' }).click();
    await expect(page.getByRole('dialog', { name: 'Highlights' })).toHaveCount(0);
    await expect(page).toHaveURL(/\/journal\?diary=all&person=3$/);
  });

  test('shows a reminder in French in the light theme', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-22T09:00:00'));
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: ENTRIES,
      config: { language: 'fr', theme: 'light' },
      people: [person(1, 'Marie', { reachOutDays: 14 })],
    });
    await page.goto('/journal?diary=all');
    await page.getByRole('button', { name: 'Moments forts' }).click();

    const dialog = page.getByRole('dialog', { name: 'Moments forts' });
    await expect(dialog.getByRole('heading', { name: 'Prendre des nouvelles' })).toBeVisible();
    await expect(dialog.locator('.reach-out')).toContainText('Marie · rappel après 2 semaines');
    await expect(dialog.locator('.reach-out')).toContainText('Dernières nouvelles il y a 52 jours');
    await expectNoAxeViolations(page, '.thought-of-day-modal');
  });
});
