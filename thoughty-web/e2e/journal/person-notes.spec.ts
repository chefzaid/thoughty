import AxeBuilder from '../support/axe';
import { test, expect, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import type { MockPerson } from '../support/mockApp.routes.people';

const ENTRIES = [
  { id: 701, date: '2026-10-01', index: 1, content: 'Coffee with @Marie and @MarieC', tags: [], visibility: 'private' as const, diaryId: 1 },
];

const person = (id: number, name: string, extra: Partial<MockPerson> = {}): MockPerson => ({
  id, name, handles: [name.toLowerCase()], date: null, createdAt: '2026-01-01T09:00:00.000Z', updatedAt: '2026-01-01T09:00:00.000Z', ...extra,
});

async function expectNoAxeViolations(page: Page, selector: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .include(selector)
    .analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
}

test.describe('Notes on people', () => {
  for (const theme of ['dark', 'light'] as const) {
    test(`writes, shows and removes notes on a person on the People page in the ${theme} theme`, async ({ page }) => {
      const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES, config: { theme } });
      await page.goto('/people');

      await page.getByRole('button', { name: 'Edit Marie', exact: true }).click();
      const notes = page.getByRole('textbox', { name: 'Notes' });
      await expect(notes).toHaveAccessibleDescription(/how you met, what they like, a gift idea\. Only you see your notes\. 0 of 2,000 characters/);
      await notes.fill('  Met at the climbing gym.\nLoves Japanese novels.  ');
      await expect(page.getByText('47 of 2,000 characters')).toBeVisible();
      await expect(notes).toHaveClass(/privacy-text/);
      await expectNoAxeViolations(page, 'main');
      await page.getByRole('button', { name: 'Save' }).click();

      await expect(page.locator('#main-content').getByRole('status')).toHaveText('Saved for Marie.');
      const row = page.getByRole('listitem').filter({ hasText: '@marie' }).first();
      const shown = row.locator('p.privacy-text');
      await expect(shown).toHaveText('Notes: Met at the climbing gym. Loves Japanese novels.');
      expect(state.people.find((candidate) => candidate.name === 'Marie')?.notes).toBe('Met at the climbing gym.\nLoves Japanese novels.');
      await expectNoAxeViolations(page, 'main');

      await row.getByRole('button', { name: 'Edit Marie', exact: true }).click();
      await expect(page.getByRole('textbox', { name: 'Notes' })).toHaveValue('Met at the climbing gym.\nLoves Japanese novels.');
      await page.getByRole('textbox', { name: 'Notes' }).fill('   ');
      await page.getByRole('button', { name: 'Save' }).click();
      // The row hides its notes while it is edited, so wait for the editor to close
      await expect(page.getByRole('textbox', { name: 'Notes' })).toHaveCount(0);
      await expect(page.locator('#main-content').getByRole('status')).toHaveText('Saved for Marie.');
      await expect(row.locator('p.privacy-text')).toHaveCount(0);
      expect(state.people.find((candidate) => candidate.name === 'Marie')?.notes).toBeNull();
    });
  }

  test('joins both people’s notes when merging, and asks to shorten them once changed past the limit, in French', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: ENTRIES,
      config: { language: 'fr', theme: 'light' },
      people: [person(1, 'Marie', { notes: 'a'.repeat(1990) }), person(2, 'MarieC', { notes: 'Idée de cadeau : un stylo plume.' })],
    });
    await page.goto('/people');

    const max = (2000).toLocaleString('fr');
    await page.getByRole('button', { name: 'Fusionner quelqu’un avec Marie', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Fusionner avec Marie' });
    await expect(dialog).toContainText('ses notes s’ajoutent après celles de Marie');
    await dialog.getByRole('button', { name: 'Fusionner' }).click();
    await expect(dialog).toHaveCount(0);
    const merged = state.people.find((candidate) => candidate.id === 1)?.notes ?? '';
    expect(merged).toBe(`${'a'.repeat(1990)}\n\nIdée de cadeau : un stylo plume.`);

    await page.getByRole('button', { name: 'Modifier Marie', exact: true }).click();
    const notes = page.getByRole('textbox', { name: 'Notes' });
    await expect(page.getByText(`${merged.length.toLocaleString('fr')} sur ${max} caractères`)).toBeVisible();
    await notes.fill(merged.slice(5));
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('alert')).toHaveText(`Les notes ne peuvent pas dépasser ${max} caractères. Raccourcissez-les pour enregistrer.`);
    await expect(notes).toBeFocused();
    await expect(notes).toHaveAttribute('aria-invalid', 'true');
    await expectNoAxeViolations(page, 'main');

    await notes.fill('Idée de cadeau : un stylo plume.');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('#main-content').getByRole('status')).toHaveText('Enregistré pour Marie.');
    expect(state.people.find((candidate) => candidate.id === 1)?.notes).toBe('Idée de cadeau : un stylo plume.');
  });
});
