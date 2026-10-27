import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import type { MockLifeEra } from '../support/mockApp.routes.life-eras';

const ENTRIES = [
  { id: 301, date: '2011-03-02', index: 1, content: 'First exams in Lyon', tags: ['study'], visibility: 'private' as const },
  { id: 302, date: '2013-02-10', index: 1, content: 'Erasmus semester in Lisbon', tags: ['travel'], visibility: 'private' as const },
  { id: 303, date: '2016-05-21', index: 1, content: 'Sunday market in Montmartre', tags: ['travel'], visibility: 'private' as const },
  { id: 304, date: '2008-06-30', index: 1, content: 'Last day of high school', tags: [], visibility: 'private' as const },
];

const era = (id: number, name: string, startDate: string, endDate: string | null, emoji: string | null = null): MockLifeEra => ({
  id, name, startDate, endDate, emoji, color: null, note: null,
  createdAt: '2026-10-27T09:00:00.000Z', updatedAt: '2026-10-27T09:00:00.000Z',
});

const UNIVERSITY = era(1, 'University', '2010-09-01', '2014-06-30', '🎓');
const ERASMUS = era(2, 'Erasmus', '2012-09-01', '2013-06-30');
const PARIS = era(3, 'The Paris years', '2015-01-01', null);

async function expectNoAxeViolations(page: Page, selector: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .include(selector)
    .analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
}

test.describe('Life eras', () => {
  test('adds an era in the profile, filters the journal by it with other filters, and saves the search', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
    await page.goto('/journal?diary=all');
    // No era filter until the writer has eras
    await expect(page.getByRole('combobox', { name: 'Life era' })).toHaveCount(0);

    await page.goto('/profile#life-eras');
    const section = page.getByRole('region', { name: 'Life eras' });
    await expect(section.getByText('No life eras yet.', { exact: false })).toBeVisible();
    const form = section.getByRole('group', { name: 'Add a life era' });
    await form.getByLabel('Name').fill('University');
    await form.getByLabel('Start date').fill('2010-09-01');
    await form.getByLabel('End date').fill('2014-06-30');
    await form.getByLabel('Emoji').fill('🎓');
    await form.getByRole('button', { name: 'Add era' }).click();
    await expect(section.getByRole('status')).toHaveText('Added “University”.');
    await expect(section.getByRole('listitem')).toContainText(['🎓 University']);
    expect(state.lifeEras).toEqual([expect.objectContaining({ name: 'University', startDate: '2010-09-01', endDate: '2014-06-30', emoji: '🎓' })]);

    await page.goto('/journal?diary=all');
    const eraFilter = page.getByRole('combobox', { name: 'Life era' });
    await eraFilter.selectOption({ label: '🎓 University' });
    await expect(page.getByText('First exams in Lyon')).toBeVisible();
    await expect(page.getByText('Erasmus semester in Lisbon')).toBeVisible();
    await expect(page.getByText('Sunday market in Montmartre')).toHaveCount(0);

    await page.getByPlaceholder('Search content...').fill('Lisbon');
    await expect(page.getByText('First exams in Lyon')).toHaveCount(0);
    await expect(page.getByText('Erasmus semester in Lisbon')).toBeVisible();

    await page.getByRole('button', { name: /^Saved searches/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Saved searches' });
    await expect(dialog.getByText('Saves: All Diaries · “Lisbon” · 🎓 University')).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Lisbon at uni');
    await dialog.getByRole('button', { name: 'Save current filters' }).click();
    await expect(dialog.getByRole('status')).toHaveText('Saved “Lisbon at uni”.');
    expect(state.savedSearches[0]?.filters.eraId).toBe(1);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Reset Filters' }).click();
    await expect(eraFilter).toHaveValue('');
    await expect(page.getByText('Sunday market in Montmartre')).toBeVisible();

    await page.getByRole('button', { name: /^Saved searches/ }).click();
    await dialog.getByRole('button', { name: 'Lisbon at uni', exact: true }).click();
    await expect(eraFilter).toHaveValue('1');
    await expect(page.getByText('First exams in Lyon')).toHaveCount(0);

    await page.getByRole('button', { name: 'Manage life eras' }).click();
    await expect(page).toHaveURL(/\/profile#life-eras$/);
    await expect(page.getByRole('heading', { name: 'Life eras' })).toBeFocused();
  });

  test('shows the era in the calendar and goes to its first month', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES, lifeEras: [UNIVERSITY, ERASMUS] });
    await page.goto('/journal?diary=all&layout=calendar&month=2026-10');

    await page.getByRole('combobox', { name: 'Life era' }).selectOption({ label: 'Erasmus' });
    await expect(page.getByText(/^Life era: Erasmus \(.*2012 – .*2013\)$/)).toBeVisible();
    await page.getByRole('button', { name: 'Go to the start of Erasmus' }).click();
    await expect(page.getByRole('grid', { name: 'September 2012' })).toBeVisible();
    await expect(page).toHaveURL(/month=2012-09/);
    await expect(page.getByRole('button', { name: 'Go to the start of Erasmus' })).toHaveCount(0);
  });

  test('outlines a book with one chapter per era, overlaps in the shortest, and the rest in Other', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES, lifeEras: [PARIS, UNIVERSITY, ERASMUS] });
    await page.goto('/import-export?diary=1&section=book');
    const bookSection = page.locator('#book-section');

    await bookSection.getByLabel('Chapter type').selectOption('eras');
    await expect(bookSection.getByLabel('Chapter type')).toHaveAccessibleDescription(/One chapter per life era/);
    await bookSection.getByRole('button', { name: 'Preview Chapters' }).click();

    const chapters = bookSection.locator('.preview-box .book-chapter-list li');
    await expect(chapters).toHaveCount(4);
    await expect(chapters.nth(0)).toContainText('University');
    await expect(chapters.nth(1)).toContainText('Erasmus');
    await expect(chapters.nth(2)).toContainText('The Paris years');
    await expect(chapters.nth(3)).toContainText('Other');
    await expect.poll(() => state.lastBookPreviewRequestUrl?.searchParams.get('chapterMode')).toBe('eras');

    await bookSection.getByLabel('Add an “Other” chapter for entries outside every era').uncheck();
    await bookSection.getByRole('button', { name: 'Preview Chapters' }).click();
    await expect(chapters).toHaveCount(3);
  });

  test('places a memoir answer in a life era, shown by the day it is dated', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      memoirProgram: { diaryId: 1 },
      lifeEras: [era(4, 'Childhood', '1960-01-01', '1972-12-31'), era(5, 'Retirement', '2020-01-01', null)],
    });
    await page.goto('/memoir');
    const list = page.getByRole('region', { name: 'All questions' });
    await list.getByRole('button', { name: 'Answer: What games did you play as a child, and who did you play them with?' }).click();
    const form = list.getByRole('form', { name: 'What games did you play as a child, and who did you play them with?' });

    await expect(form.getByText('This answer is dated today, during Retirement.')).toBeVisible();
    await form.getByLabel('Your answer').fill('Marbles in the courtyard.');
    await form.getByRole('combobox', { name: 'Life era this memory belongs to' }).selectOption({ label: 'Childhood' });
    await form.getByRole('button', { name: 'Save answer' }).click();

    await expect(page.getByText('Answer saved to your memoir.')).toBeVisible();
    expect(state.memoir.lastAnswerPayload).toEqual({ questionId: 'childhood-play', text: 'Marbles in the courtyard.', eraId: 4 });
    expect(state.entries.at(-1)?.tags).toContain('Childhood');
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`has no accessibility violations in the profile section and the era filter (${theme})`, async ({ page }) => {
      await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES, lifeEras: [UNIVERSITY, PARIS], config: { theme } });

      await page.goto('/profile#life-eras');
      const section = page.getByRole('region', { name: 'Life eras' });
      await expect(section.getByRole('listitem')).toHaveCount(2);
      await section.getByRole('button', { name: 'Edit University' }).click();
      await section.getByRole('group', { name: 'Edit “University”' }).getByLabel('Give it a colour').check();
      await section.getByRole('group', { name: 'Edit “University”' }).getByRole('button', { name: 'Save changes' }).click();
      await expect(section.getByRole('status')).toHaveText('Saved “University”.');
      await section.getByRole('group', { name: 'Add a life era' }).getByRole('button', { name: 'Add era' }).click();
      await expect(section.getByRole('alert')).toHaveText('Enter a name for this era.');
      await expectNoAxeViolations(page, '#life-eras');

      await page.goto('/journal?diary=all&layout=calendar');
      await page.getByRole('combobox', { name: 'Life era' }).selectOption({ label: 'The Paris years' });
      await expect(page.getByText(/^Life era: The Paris years/)).toBeVisible();
      await expectNoAxeViolations(page, '.journal-filter-controls');
      await expectNoAxeViolations(page, '.journal-calendar');
    });
  }

  test('deletes an era after confirming, widening the saved searches filtered by it', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: ENTRIES,
      lifeEras: [UNIVERSITY],
      savedSearches: [{
        id: 1,
        name: 'Uni',
        diaryId: null,
        filters: { search: '', searchMode: 'keyword', sort: 'relevance', tags: [], date: null, visibility: 'all', archiveStatus: 'active', favorites: false, mood: '', eraId: 1 },
        createdAt: '2026-10-27T09:00:00.000Z',
        updatedAt: '2026-10-27T09:00:00.000Z',
      }],
      config: { language: 'fr' },
    });
    await page.goto('/profile#life-eras');
    const section = page.getByRole('region', { name: 'Périodes de vie' });
    await section.getByRole('button', { name: 'Supprimer University' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Supprimer la période de vie ?' });
    await expect(confirm).toContainText('les recherches enregistrées filtrées par cette période afficheront toutes les dates');
    await confirm.getByRole('button', { name: 'Supprimer' }).click();

    await expect(section.getByRole('status')).toHaveText('« University » supprimée.');
    await expect(section.getByText('Aucune période de vie pour l’instant.', { exact: false })).toBeVisible();
    expect(state.savedSearches[0]?.filters.eraId).toBeNull();
  });
});
