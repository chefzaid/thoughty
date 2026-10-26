import { expect, test, type Page } from '../support/test';

import { setupMockApp } from '../support/mockApp';
import type { MockEntry } from '../support/mockApp.shared';

const DAY = '2024-04-18';

const dayEntries: MockEntry[] = [
  { id: 301, date: DAY, index: 1, content: 'A note without a time', tags: ['notes'], visibility: 'private', diaryId: 1 },
  {
    id: 302,
    date: DAY,
    index: 2,
    title: 'Evening walk',
    time_of_day: '21:30',
    content: 'Down to the harbour and back.',
    tags: ['walks'],
    visibility: 'private',
    diaryId: 1,
  },
];

const cardIds = (page: Page) =>
  page.locator('[id^="entry-"]').evaluateAll((cards) => cards.map((card) => card.id));

test.describe('Entry titles and times of day', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date(`${DAY}T07:05:00`));
  });

  test('writes a titled entry at the current time and lists it by time without renumbering the day', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: dayEntries });
    await page.goto('/journal');
    await expect.poll(() => cardIds(page)).toEqual(['entry-301', 'entry-302']);

    const form = page.locator('form').first();
    const time = form.getByLabel('Time of day (optional)');
    await expect(time).toHaveValue('');
    await form.getByLabel('Title (optional)').fill('Morning pages');
    await page.getByPlaceholder("What's on your mind?").fill('Three pages before breakfast.');
    await form.locator('input[placeholder="tags..."]').fill('writing');
    await form.locator('input[placeholder="tags..."]').press('Enter');
    await form.getByRole('button', { name: 'Now' }).click();
    await expect(time).toHaveValue('07:05');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect.poll(() => state.entries.find((entry) => entry.content === 'Three pages before breakfast.')).toMatchObject({
      date: DAY,
      index: 3,
      title: 'Morning pages',
      time_of_day: '07:05',
    });
    const created = page.locator('#entry-303');
    await expect(created.getByRole('heading', { name: 'Morning pages' })).toBeVisible();
    await expect(created.locator('time')).toHaveText('7:05 AM');
    await expect(created.getByText('#3', { exact: true })).toHaveAttribute('title', /\[\[2024-04-18#3\]\]/);
    await expect(time).toHaveValue('');
    await expect(form.getByLabel('Title (optional)')).toHaveValue('');

    // Untimed entries come first, then timed ones by time; every entry keeps its link number.
    await expect.poll(() => cardIds(page)).toEqual(['entry-301', 'entry-303', 'entry-302']);
    await expect(page.locator('#entry-301')).toContainText('#1');
    await expect(page.locator('#entry-302')).toContainText('#2');
    // A single untimed entry leaves nothing to drag.
    await expect(page.getByRole('button', { name: 'Drag to reorder' })).toHaveCount(0);
  });

  test('edits the title and time, and an entry without a time joins the manual order', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: dayEntries });
    await page.goto('/journal');

    const evening = page.locator('#entry-302');
    await expect(evening.getByRole('heading', { name: 'Evening walk' })).toBeVisible();
    await evening.getByRole('button', { name: 'Edit' }).click();
    await expect(evening.getByLabel('Time of day (optional)')).toHaveValue('21:30');
    await evening.getByLabel('Title (optional)').fill('Harbour walk');
    await evening.getByRole('button', { name: 'Remove the time of day' }).click();
    await expect(evening.getByLabel('Time of day (optional)')).toHaveValue('');
    await evening.getByRole('button', { name: 'Save' }).click();

    await expect.poll(() => state.entries.find((entry) => entry.id === 302)).toMatchObject({ title: 'Harbour walk', time_of_day: null, index: 2 });
    expect(state.revisions[302]?.at(-1)).toMatchObject({ title: 'Evening walk', timeOfDay: '21:30' });
    await expect(evening.getByRole('heading', { name: 'Harbour walk' })).toBeVisible();
    await expect(evening.locator('time')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Drag to reorder' })).toHaveCount(2);

    await page.locator('#entry-301').getByRole('button', { name: 'Edit' }).click();
    await page.locator('#entry-301').getByLabel('Time of day (optional)').fill('18:20');
    await page.locator('#entry-301').getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => cardIds(page)).toEqual(['entry-302', 'entry-301']);
    await expect(page.locator('#entry-301')).toContainText('#1');
    await expect(page.locator('#entry-301 time')).toHaveText('6:20 PM');
  });

  test('drags only the entries without a time, which trade their numbers', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [
        { id: 401, date: DAY, index: 1, content: 'First untimed', tags: ['a'], visibility: 'private', diaryId: 1 },
        { id: 402, date: DAY, index: 2, time_of_day: '08:00', content: 'Timed at eight', tags: ['b'], visibility: 'private', diaryId: 1 },
        { id: 403, date: DAY, index: 3, content: 'Second untimed', tags: ['c'], visibility: 'private', diaryId: 1 },
      ],
    });
    await page.goto('/journal');
    await expect.poll(() => cardIds(page)).toEqual(['entry-401', 'entry-403', 'entry-402']);
    await expect(page.locator('#entry-402').getByRole('button', { name: 'Drag to reorder' })).toHaveCount(0);

    await page.locator('#entry-401').getByRole('button', { name: 'Drag to reorder' }).dispatchEvent('pointerdown');
    const dropTarget = page.locator('#entry-403 button[aria-label="Drag to reorder"]').first();
    await dropTarget.dispatchEvent('pointerenter');
    await dropTarget.dispatchEvent('pointerup');

    await expect.poll(() => state.lastReorderPayload).toMatchObject({ date: DAY, orderedIds: [403, 401] });
    await expect.poll(() => Object.fromEntries(state.entries.map((entry) => [entry.id, entry.index]))).toEqual({ 401: 3, 402: 2, 403: 1 });
    await expect.poll(() => cardIds(page)).toEqual(['entry-403', 'entry-401', 'entry-402']);
    await expect(page.locator('#entry-402')).toContainText('#2');
  });

  test('finds entries by title and marks the matching words', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: dayEntries });
    await page.goto('/journal?diary=all');

    await page.getByRole('textbox', { name: 'Search entries' }).fill('evening');

    await expect(page.locator('[id^="entry-"]')).toHaveCount(1);
    await expect(page.locator('#entry-302 h3 mark')).toHaveText(['Evening']);
  });

  test('speaks French in the composer', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' }, initialEntries: dayEntries });
    await page.goto('/journal');

    const form = page.locator('form').first();
    await expect(form.getByLabel('Titre (facultatif)')).toHaveAttribute('placeholder', 'Titre (facultatif)');
    await form.getByRole('button', { name: 'Maintenant' }).click();
    await expect(form.getByLabel('Heure (facultative)')).toHaveValue('07:05');
    await expect(form.getByRole('button', { name: 'Retirer l’heure' })).toBeVisible();
    await expect(page.locator('#entry-302 time')).toHaveText('21:30');
  });
});
