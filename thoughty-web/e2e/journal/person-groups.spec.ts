import AxeBuilder from '../support/axe';
import { test, expect, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import type { MockPerson } from '../support/mockApp.routes.people';

const ENTRIES = [
  { id: 701, date: '2026-10-01', index: 1, content: 'Coffee with @Marie, @MarieC, @Paul and @Ines', tags: [], visibility: 'private' as const, diaryId: 1 },
];

const person = (id: number, name: string, groups: string[] = []): MockPerson => ({
  id, name, handles: [name.toLowerCase()], date: null, groups, createdAt: '2026-01-01T09:00:00.000Z', updatedAt: '2026-01-01T09:00:00.000Z',
});

async function expectNoAxeViolations(page: Page, selector: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .include(selector)
    .analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
}

const shownNames = (page: Page) => page.locator('#main-content ul > li a.entry-mention-link');

test.describe('Groups of people', () => {
  for (const theme of ['dark', 'light'] as const) {
    test(`puts people in groups and narrows the People page to one in the ${theme} theme`, async ({ page }) => {
      const { state } = await setupMockApp(page, {
        startAuthenticated: true,
        initialEntries: ENTRIES,
        config: { theme },
        people: [person(1, 'Marie', ['Friends', 'Climbing']), person(3, 'Paul', ['Family']), person(4, 'Ines')],
      });
      await page.goto('/people');

      const group = page.getByRole('combobox', { name: 'Group' });
      await expect(group.getByRole('option')).toHaveText(['Everyone', 'Climbing (1)', 'Family (1)', 'Friends (1)']);
      await expectNoAxeViolations(page, 'main');

      await page.getByRole('button', { name: 'Edit Ines', exact: true }).click();
      await expect(page.getByText('Not in a group yet.')).toBeVisible();
      const field = page.getByRole('combobox', { name: 'Add to a group' });
      await field.fill('friends');
      await field.press('Enter');
      await field.fill('Neighbours');
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      await page.getByRole('button', { name: 'Remove Ines from Neighbours' }).click();
      await field.fill('Book club');
      await expectNoAxeViolations(page, 'main');
      await page.getByRole('button', { name: 'Save' }).click();

      await expect(page.locator('#main-content').getByRole('status')).toHaveText('Saved for Ines.');
      expect(state.people.find((candidate) => candidate.name === 'Ines')?.groups).toEqual(['Friends', 'Book club']);
      const ines = page.getByRole('listitem').filter({ hasText: '@ines' }).first();
      await expect(ines.getByRole('list', { name: 'Groups' }).getByRole('listitem')).toHaveText(['Friends', 'Book club']);
      await expectNoAxeViolations(page, 'main');

      await group.selectOption({ label: 'Friends (2)' });
      await expect(shownNames(page)).toHaveText(['Ines', 'Marie']);
      await group.selectOption({ label: 'Everyone' });
      await expect(shownNames(page)).toHaveText(['Ines', 'Marie', 'Paul']);
    });
  }

  test('joins both people’s groups when merging, in French', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: ENTRIES,
      config: { language: 'fr', theme: 'light' },
      people: [person(1, 'Marie', ['Amis']), person(2, 'MarieC', ['amis', 'Escalade'])],
    });
    await page.goto('/people');

    await page.getByRole('button', { name: 'Fusionner quelqu’un avec Marie', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Fusionner avec Marie' });
    await expect(dialog).toContainText('et Marie rejoint ses groupes');
    await dialog.getByRole('button', { name: 'Fusionner' }).click();
    await expect(dialog).toHaveCount(0);
    expect(state.people.find((candidate) => candidate.id === 1)?.groups).toEqual(['Amis', 'Escalade']);
    const marie = page.getByRole('listitem').filter({ hasText: '@marie' }).first();
    await expect(marie.getByRole('list', { name: 'Groupes' }).getByRole('listitem')).toHaveText(['Amis', 'Escalade']);
    await expect(page.getByRole('combobox', { name: 'Groupe' }).getByRole('option')).toHaveText(['Tout le monde', 'Amis (1)', 'Escalade (1)']);
  });
});
