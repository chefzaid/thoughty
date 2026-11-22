import { expect, test } from '../support/test';
import type { MockEntry } from '../support/mockApp.shared';
import { setupMockApp } from '../support/mockApp';

const ENTRIES: MockEntry[] = [
  { id: 71, date: '2026-10-20', index: 1, content: 'A morning run by the harbor.', tags: ['running'], visibility: 'private', diaryId: 1 },
  { id: 72, date: '2026-10-19', index: 1, content: 'Bread, bank, post office.', tags: ['errands'], visibility: 'private', diaryId: 1 },
  { id: 73, date: '2026-10-18', index: 1, content: 'Two chapters before bed.', tags: ['reading'], visibility: 'private', diaryId: 1 },
];

test.describe('Tag picker suggestions and the keyboard', () => {
  test('in the bulk Add tags popover: a pick closes the list, the first Escape closes the list and the second the popover', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
    await page.goto('/journal?diary=all');
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await page.locator('#entry-71 input[type="checkbox"]').check();
    const bar = page.getByText('1 selected').locator('..');
    const addTags = bar.getByRole('button', { name: 'Add tags', exact: true });
    const apply = bar.getByRole('button', { name: 'Apply', exact: true });
    const suggestions = bar.getByRole('listbox', { name: 'Tag suggestions' });

    await addTags.click();
    await expect(addTags).toHaveAttribute('aria-expanded', 'true');
    const field = bar.getByRole('combobox', { name: 'Select tags...' });
    await field.fill('r');
    await expect(suggestions).toBeVisible();
    await expect(field).toHaveAttribute('aria-expanded', 'true');
    await expect(field).toHaveAttribute('aria-controls', (await suggestions.getAttribute('id')) ?? '');

    // Escape closes only the list; the popover, the typed text and the focus stay
    await field.press('Escape');
    await expect(suggestions).toHaveCount(0);
    await expect(field).toHaveAttribute('aria-expanded', 'false');
    await expect(field).toBeFocused();
    await expect(field).toHaveValue('r');
    await expect(apply).toBeVisible();

    // Down opens the list on its first row, Enter picks it and the list closes
    await field.press('ArrowDown');
    const first = suggestions.getByRole('option').first();
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await expect(field).toHaveAttribute('aria-activedescendant', (await first.getAttribute('id')) ?? '');
    await field.press('Enter');
    await expect(bar.getByRole('button', { name: 'Remove errands tag' })).toBeVisible();
    await expect(suggestions).toHaveCount(0);

    // A second tag the same way, by typing it
    await field.pressSequentially('reading');
    await field.press('Enter');
    await expect(bar.getByRole('button', { name: 'Remove reading tag' })).toBeVisible();
    await expect(suggestions).toHaveCount(0);

    // With the list closed, Escape closes the popover as Cancel would and focus goes back to its button
    await field.press('Escape');
    await expect(apply).toHaveCount(0);
    await expect(addTags).toBeFocused();
    await expect(addTags).toHaveAttribute('aria-expanded', 'false');

    // Nothing covers Apply after a pick: a real click reaches it
    await addTags.click();
    await field.fill('errands');
    await field.press('Enter');
    await apply.click();
    await expect.poll(() => state.lastBulkPayload).toMatchObject({ ids: [71], action: 'tags', tags: ['errands'] });
    await expect(page.locator('#entry-71').getByText('errands')).toBeVisible();
  });

  test('in the filter bar: Escape closes the list, and a keyboard pick filters and closes it', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
    await page.goto('/journal?diary=all');
    await expect(page.locator('[id^="entry-"]')).toHaveCount(3);
    const field = page.getByRole('combobox', { name: 'Filter by tags...' });
    const suggestions = page.getByRole('listbox', { name: 'Tag suggestions' });

    await field.click();
    await expect(suggestions.getByRole('option')).toHaveText(['errands', 'reading', 'running']);
    await field.press('Escape');
    await expect(suggestions).toHaveCount(0);
    await expect(field).toBeFocused();

    await field.press('ArrowUp');
    await expect(suggestions.getByRole('option', { name: 'running' })).toHaveAttribute('aria-selected', 'true');
    await field.press('Enter');
    await expect(suggestions).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Remove running tag' })).toBeVisible();
    await expect(page.locator('[id^="entry-"]')).toHaveCount(1);
    await expect(page.locator('#entry-71')).toBeVisible();
  });
});
