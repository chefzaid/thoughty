import { expect, test } from '@playwright/test';

import { setupMockApp } from '../support/mockApp';
import type { MockEntry } from '../support/mockApp.shared';

const entries: MockEntry[] = [
  { id: 601, date: '2024-05-03', index: 1, content: 'Slow morning, heavy head.', mood: 2, feelings: ['tired'], tags: ['days'], visibility: 'private', diaryId: 1 },
  { id: 602, date: '2024-05-02', index: 1, content: 'Finished the shelf at last.', mood: 5, feelings: ['proud'], tags: ['home'], visibility: 'private', diaryId: 1 },
  { id: 603, date: '2024-05-01', index: 1, content: 'A list of errands.', tags: ['days'], visibility: 'private', diaryId: 1 },
];

const cardIds = (page: import('@playwright/test').Page) =>
  page.locator('[id^="entry-"]').evaluateAll((cards) => cards.map((card) => card.id));

test.describe('Mood check-in', () => {
  test('records a mood and feelings in the composer and shows them on the card', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    await page.goto('/journal');

    const form = page.locator('form').first();
    const mood = form.getByRole('group', { name: 'Mood (optional)' });
    await page.getByPlaceholder("What's on your mind?").fill('Lunch in the park with Sam.');
    await form.locator('input[placeholder="tags..."]').fill('friends');
    await form.locator('input[placeholder="tags..."]').press('Enter');
    await mood.getByText('Good', { exact: true }).click();
    await expect(mood.getByRole('radio', { name: 'Good', exact: true })).toBeChecked();
    await form.getByRole('button', { name: 'Feelings (optional)' }).click();
    await form.getByRole('button', { name: 'calm', exact: true }).click();
    await form.getByLabel('Add a feeling in your own words').fill('Nostalgic');
    await form.getByLabel('Add a feeling in your own words').press('Enter');
    await expect(form.getByRole('button', { name: 'Remove the feeling nostalgic' })).toBeVisible();
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect.poll(() => state.entries.find((entry) => entry.content === 'Lunch in the park with Sam.')).toMatchObject({
      mood: 4,
      feelings: ['calm', 'nostalgic'],
    });
    const created = page.locator('[id^="entry-"]', { hasText: 'Lunch in the park with Sam.' });
    await expect(created.locator('[data-mood="4"]')).toHaveText(/Good.*calm, nostalgic/);
    // The composer starts over without a mood
    await expect(mood.getByRole('radio', { checked: true })).toHaveCount(0);
    await expect(form.getByRole('button', { name: 'calm', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await expect(form.getByRole('button', { name: 'Remove the feeling nostalgic' })).toHaveCount(0);
  });

  test('changes the mood of an entry and keeps the earlier one in its history', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    await page.goto('/journal');

    const card = page.locator('#entry-601');
    await expect(card.locator('[data-mood="2"]')).toContainText('Low');
    await card.getByRole('button', { name: 'Edit' }).click();
    const mood = card.getByRole('group', { name: 'Mood (optional)' });
    await expect(mood.getByRole('radio', { name: 'Low', exact: true })).toBeChecked();
    await expect(card.getByRole('button', { name: 'tired', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await mood.getByText('Okay', { exact: true }).click();
    await card.getByRole('button', { name: 'tired', exact: true }).click();
    await card.getByRole('button', { name: 'Save' }).click();

    await expect.poll(() => state.entries.find((entry) => entry.id === 601)).toMatchObject({ mood: 3, feelings: [] });
    expect(state.revisions[601]?.at(-1)).toMatchObject({ mood: 2, feelings: ['tired'] });
    await expect(card.locator('[data-mood="3"]')).toHaveText(/Okay/);

    await card.getByRole('button', { name: 'Edit' }).click();
    await card.getByRole('button', { name: 'Remove the mood' }).click();
    await card.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => state.entries.find((entry) => entry.id === 601)?.mood).toBeNull();
    await expect(card.locator('[data-mood]')).toHaveCount(0);
  });

  test('filters the journal by mood', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    await page.goto('/journal');
    await expect.poll(() => cardIds(page)).toEqual(['entry-601', 'entry-602', 'entry-603']);

    const filter = page.getByRole('combobox', { name: 'Filter by mood' });
    await filter.selectOption({ label: 'Good or very good' });
    await expect.poll(() => cardIds(page)).toEqual(['entry-602']);
    await filter.selectOption({ label: 'Without a mood' });
    await expect.poll(() => cardIds(page)).toEqual(['entry-603']);
    await filter.selectOption({ label: 'Low' });
    await expect.poll(() => cardIds(page)).toEqual(['entry-601']);

    await page.getByRole('button', { name: 'Reset filters' }).click();
    await expect(filter).toHaveValue('');
    await expect.poll(() => cardIds(page)).toEqual(['entry-601', 'entry-602', 'entry-603']);
  });

  test('speaks French and stores curated feelings by their English key', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' }, initialEntries: entries });
    await page.goto('/journal');

    await expect(page.locator('#entry-602 [data-mood="5"]')).toHaveText(/Très bonne.*fierté/);
    const form = page.locator('form').first();
    const mood = form.getByRole('group', { name: 'Humeur (facultative)' });
    await page.locator('form').first().locator('textarea').fill('Une journée calme.');
    await form.locator('input[placeholder="Filtrer par tags..."]').fill('jours');
    await form.locator('input[placeholder="Filtrer par tags..."]').press('Enter');
    await mood.getByText('Moyenne', { exact: true }).click();
    await form.getByRole('button', { name: 'Ressentis (facultatifs)' }).click();
    await form.getByLabel('Ajouter un ressenti avec vos mots').fill('Calme');
    await form.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(form.getByRole('button', { name: 'calme', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();

    await expect.poll(() => state.entries.find((entry) => entry.content === 'Une journée calme.')).toMatchObject({ mood: 3, feelings: ['calm'] });
  });
});
