import AxeBuilder from '../support/axe';
import { expect, test } from '../support/test';

import { setupMockApp } from '../support/mockApp';
import type { MockEntry } from '../support/mockApp.shared';

const TODAY = '2026-11-01';

const publicEntry = (id: number, userId: number, authorUsername: string, content: string, format: MockEntry['format'] = 'plain'): MockEntry => ({
  id,
  userId,
  authorUsername,
  date: `2026-07-${String(10 + id).padStart(2, '0')}`,
  index: 1,
  content,
  format,
  tags: ['community'],
  visibility: 'public',
  likeCount: 2,
});

test.describe('saved feed entries', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date(`${TODAY}T12:00:00`));
  });

  test('saves entries to a private Saved list, the newest saved first, and takes one out', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [
        publicEntry(1, 2, 'Maya', 'Maya writes about mornings'),
        publicEntry(2, 3, 'Sam', 'Sam writes about running'),
        publicEntry(3, 1, 'TestUser', 'My own public thought'),
      ],
    });
    await page.goto('/feed');

    const saveMaya = page.getByRole('button', { name: 'Save the entry by Maya' });
    const saveSam = page.getByRole('button', { name: 'Save the entry by Sam' });
    await expect(saveMaya).toHaveAttribute('aria-pressed', 'false');
    await saveMaya.click();
    await expect(saveMaya).toHaveAttribute('aria-pressed', 'true');
    await expect(saveMaya).toHaveText('Saved');
    await saveSam.click();
    await expect.poll(() => state.savedEntryIds).toEqual([2, 1]);
    // Saving is private: no count changes anywhere
    await expect(page.getByRole('button', { name: 'Like the entry by Maya, Likes: 2' })).toBeVisible();

    await page.getByRole('button', { name: 'Saved', exact: true }).click();
    const cards = page.locator('.feed-entry');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText('Sam writes about running');
    await expect(cards.nth(1)).toContainText('Maya writes about mornings');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .include('.feed-page')
      .analyze();
    expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);

    await page.getByRole('button', { name: 'Save the entry by Sam' }).click();
    await expect(page.getByRole('button', { name: 'Save the entry by Sam' })).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => state.savedEntryIds).toEqual([1]);

    // Own entries are never offered for saving
    await page.getByRole('button', { name: 'My public entries' }).click();
    await expect(page.getByText('My own public thought')).toBeVisible();
    await expect(page.getByRole('button', { name: /Save the entry/ })).toHaveCount(0);

    // An entry that is no longer public leaves the list
    state.entries = state.entries.map((entry) => (entry.id === 1 ? { ...entry, visibility: 'private' } : entry));
    await page.getByRole('button', { name: 'Saved', exact: true }).click();
    await expect(page.getByText(/Nothing saved yet/)).toBeVisible();
  });

  test('writes about another writer’s entry in a private entry dated today', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      config: { defaultVisibility: 'public' },
      initialEntries: [publicEntry(1, 2, 'Maya', 'Coffee with @Lena by the **river**. Then rain.', 'markdown')],
    });
    await page.goto('/feed');

    await page.getByRole('button', { name: 'Write about the entry by Maya' }).click();

    await expect(page).toHaveURL(/\/journal/);
    const form = page.locator('form').first();
    const text = form.getByPlaceholder("What's on your mind?");
    const quote = '> Coffee with Lena by the river.\n\n— Maya\n\n';
    await expect(text).toHaveValue(quote);
    await expect(text).toBeFocused();
    await page.keyboard.type('It made me call my sister.');
    // Nothing is copied but the quote: tags are the writer's to pick
    await expect(form.getByRole('button', { name: 'Remove community tag' })).toHaveCount(0);
    await form.locator('input[placeholder="tags..."]').fill('family');
    await form.locator('input[placeholder="tags..."]').press('Enter');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => state.entries.find((entry) => entry.id > 1)).toMatchObject({
      date: TODAY,
      content: `${quote}It made me call my sister.`,
      format: 'markdown',
      visibility: 'private',
      tags: ['family'],
    });
  });

  test('saves and writes about entries in French', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      config: { language: 'fr' },
      initialEntries: [publicEntry(1, 2, 'Maya', 'Une matinée calme. Puis la pluie.')],
    });
    await page.goto('/feed');

    await page.getByRole('button', { name: "Enregistrer l'entrée de Maya" }).click();
    await expect.poll(() => state.savedEntryIds).toEqual([1]);
    await page.getByRole('button', { name: 'Enregistrées', exact: true }).click();
    await expect(page.getByText('Une matinée calme. Puis la pluie.')).toBeVisible();

    await page.getByRole('button', { name: "Écrire au sujet de l'entrée de Maya" }).click();
    await expect(page.locator('form').first().locator('textarea')).toHaveValue('« Une matinée calme. » — Maya\n\n');
  });
});
