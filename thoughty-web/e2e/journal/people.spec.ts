import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';

const ENTRIES = [
  { id: 401, date: '2026-10-20', index: 1, content: 'Coffee with @Marie at the market', tags: ['life'], visibility: 'private' as const },
  { id: 402, date: '2026-10-18', index: 1, content: 'Long call with @Paul about the move', tags: ['life'], visibility: 'private' as const },
  { id: 403, date: '2026-10-15', index: 1, content: 'Hiked with @MarieC and @Paul', tags: ['life'], visibility: 'public' as const },
  { id: 404, date: '2026-10-12', index: 1, content: 'A quiet day alone, mail marie@example.com', tags: ['life'], visibility: 'private' as const },
];

async function expectNoAxeViolations(page: Page, selector: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .include(selector)
    .analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
}

test.describe('People', () => {
  test('suggests people after @ while writing, links mentions and opens every entry about a person', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
    await page.goto('/journal?diary=all');

    const composer = page.getByPlaceholder("What's on your mind?");
    await composer.fill('Dinner with @mar');
    const suggestions = page.getByRole('listbox', { name: 'People to mention' });
    await expect(suggestions.getByRole('option')).toHaveText([/^Marie@marie1 entry$/, /^MarieC@mariec1 entry$/]);
    await expect(composer).toHaveAttribute('aria-activedescendant', await suggestions.getByRole('option').first().getAttribute('id') ?? '');
    await expectNoAxeViolations(page, 'form');
    await composer.press('ArrowDown');
    await composer.press('ArrowUp');
    await composer.press('Enter');
    await expect(composer).toHaveValue('Dinner with @Marie ');
    await expect(suggestions).toHaveCount(0);
    await composer.pressSequentially('and @newfriend');
    await composer.press('Escape');
    await expect(composer).toHaveValue('Dinner with @Marie and @newfriend');
    const tagField = page.locator('form').first().locator('input[placeholder="tags..."]');
    await tagField.fill('friends');
    await tagField.press('Enter');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('[id^="entry-"]').filter({ hasText: 'Dinner with' }).getByRole('link', { name: '@Marie' })).toBeVisible();
    await expect.poll(() => state.people.map((person) => person.name)).toEqual(['Marie', 'Paul', 'MarieC', 'newfriend']);

    // A mention is a link to the person's entries; an e-mail address stays text
    const firstEntry = page.locator('[id^="entry-"]').filter({ hasText: 'Coffee with' });
    await expect(page.locator('[id^="entry-"]').filter({ hasText: 'mail marie@example.com' }).getByRole('link')).toHaveCount(0);
    await firstEntry.getByRole('link', { name: '@Marie' }).click();
    await expect(page).toHaveURL(/\/journal\?diary=all&person=1$/);
    const banner = page.getByRole('region', { name: 'Entries that mention Marie' });
    await expect(banner).toContainText('2 entries · @marie');
    await expect(page.getByText('Coffee with')).toBeVisible();
    await expect(page.getByText('Dinner with')).toBeVisible();
    await expect(page.getByText('Long call with')).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Person' })).toHaveValue('1');
    await expectNoAxeViolations(page, 'main');

    // The filter bar's person choice writes the address, and the back button returns to the person before
    await page.getByRole('combobox', { name: 'Person' }).selectOption({ label: 'Paul' });
    await expect(page).toHaveURL(/person=2$/);
    await expect(page.getByText('Long call with')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/journal\?diary=all$/);

    await page.goto('/journal?diary=all&person=1');
    await banner.getByRole('button', { name: 'Show all entries' }).click();
    await expect(page).toHaveURL(/\/journal\?diary=all$/);
    await expect(page.getByText('Long call with')).toBeVisible();
  });

  test('suggests people in the Markdown editor and while editing, ahead of its own Enter and Tab keys', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
    await page.goto('/journal?diary=all');

    await page.getByTitle('Plain text - click to enable Markdown formatting').click();
    const editor = page.getByPlaceholder("What's on your mind?");
    await editor.fill('- call @pa');
    await expect(page.getByRole('listbox', { name: 'People to mention' }).getByRole('option', { name: /Paul/ })).toBeVisible();
    await editor.press('Enter');
    await expect(editor).toHaveValue('- call @Paul ');
    await editor.pressSequentially('and @mariec');
    await editor.press('Tab');
    await expect(editor).toHaveValue('- call @Paul and @MarieC ');

    const entry = page.locator('[id^="entry-"]').filter({ hasText: 'Long call with' });
    await entry.getByRole('button', { name: 'Edit' }).click();
    const text = entry.getByRole('textbox', { name: 'Text of the entry' });
    await text.press('End');
    await text.pressSequentially(' and @ma');
    await text.press('ArrowDown');
    await text.press('Enter');
    await expect(text).toHaveValue('Long call with @Paul about the move and @MarieC ');
    await entry.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => state.entries.find((candidate) => candidate.id === 402)?.content).toBe('Long call with @Paul about the move and @MarieC ');
  });

  test('renames, merges and deletes people on the People page, and saved searches follow', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: ENTRIES,
      savedSearches: [{
        id: 5, name: 'Hikes', diaryId: null,
        filters: { search: '', searchMode: 'keyword', sort: 'relevance', tags: [], date: null, visibility: 'all', archiveStatus: 'all', favorites: false, mood: '', eraId: null, personId: 3 },
        createdAt: '2026-10-27T09:00:00.000Z', updatedAt: '2026-10-27T09:00:00.000Z',
      }],
    });
    await page.goto('/journal?diary=all');
    await page.getByRole('navigation').getByRole('button', { name: 'People' }).click();
    await expect(page).toHaveURL(/\/people$/);
    await expect(page.getByRole('heading', { level: 1, name: 'People' })).toBeVisible();
    const list = page.getByRole('list', { name: '3 people' });
    await expect(list.getByRole('listitem')).toHaveCount(3);
    await expect(list.getByRole('listitem').filter({ hasText: '@paul' })).toContainText('2 entries · last mentioned Oct 18, 2026');
    await expectNoAxeViolations(page, 'main');

    await page.getByRole('button', { name: 'Rename Marie', exact: true }).click();
    const name = page.getByRole('textbox', { name: 'Name shown for @marie' });
    await name.fill('Marie Curie');
    await name.press('Enter');
    await expect(page.getByRole('status')).toHaveText('Renamed to Marie Curie.');
    await expect(page.getByRole('button', { name: 'Rename Marie Curie', exact: true })).toBeFocused();
    expect(state.people.find((person) => person.id === 1)?.name).toBe('Marie Curie');

    await page.getByRole('button', { name: 'Merge someone into Marie Curie', exact: true }).click();
    const merge = page.getByRole('dialog', { name: 'Merge into Marie Curie' });
    await expectNoAxeViolations(page, '[role="dialog"]');
    await merge.getByRole('combobox', { name: 'Person to merge' }).selectOption({ label: 'MarieC (@mariec)' });
    await merge.getByRole('button', { name: 'Merge' }).click();
    await expect(page.getByRole('status')).toHaveText('MarieC was merged into Marie Curie.');
    await expect(page.getByRole('list', { name: '2 people' }).getByRole('listitem').first()).toContainText('@marie, @mariec');
    expect(state.savedSearches[0]?.filters.personId).toBe(1);

    await page.getByRole('button', { name: 'Delete Paul' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Delete Paul?' });
    await expect(confirm).toContainText('Your entries keep the text @paul');
    await confirm.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('status')).toHaveText('Paul was deleted.');
    expect(state.people.map((person) => person.name)).toEqual(['Marie Curie']);

    await page.getByRole('link', { name: 'Marie Curie' }).click();
    await expect(page.getByRole('region', { name: 'Entries that mention Marie Curie' })).toContainText('2 entries · @marie, @mariec');
    await expect(page.getByText('Hiked with')).toBeVisible();
    await expect(page.locator('[id^="entry-"]').filter({ hasText: 'Long call with' })).toHaveCount(0);
    await page.goto('/journal?diary=all');
    await expect(page.locator('[id^="entry-"]').filter({ hasText: 'Long call with' }).getByRole('link')).toHaveCount(0);

    await page.getByRole('button', { name: /^Saved searches/ }).click();
    await expect(page.getByRole('dialog', { name: 'Saved searches' }).getByRole('button', { name: 'Hikes', exact: true }))
      .toHaveAccessibleDescription('All Diaries · Active and archived · with Marie Curie');
  });

  test('keeps mentions as plain text in the public feed', async ({ page }) => {
    const shared = { id: 501, userId: 77, authorUsername: 'camille', date: '2026-10-15', index: 1, content: 'Hiked with @MarieC and @Paul', tags: [], visibility: 'public' as const };
    await setupMockApp(page, { startAuthenticated: true, initialEntries: [...ENTRIES, shared] });
    await page.goto('/feed');

    const card = page.getByRole('article').filter({ hasText: 'Hiked with' });
    await expect(card).toContainText('Hiked with @MarieC and @Paul');
    await expect(card.getByRole('link', { name: /@/ })).toHaveCount(0);
  });

  test('speaks French and opens a person shared by link, or says they are gone', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES, config: { language: 'fr', theme: 'light' } });
    await page.goto('/people');
    await expect(page.getByRole('heading', { level: 1, name: 'Personnes' })).toBeVisible();
    await expect(page.getByText('Personnes : 3 sur 1000')).toBeVisible();
    await expectNoAxeViolations(page, 'main');

    await page.goto('/journal?diary=all&person=2');
    await expect(page.getByRole('region', { name: 'Entrées qui mentionnent Paul' })).toContainText('2 entrées · @paul');
    await expectNoAxeViolations(page, 'main');

    await page.goto('/journal?diary=all&person=99');
    await expect(page.getByText('Cette personne n’existe plus.')).toBeVisible();
    await expect(page).toHaveURL(/\/journal\?diary=all$/);
  });
});
