import AxeBuilder from '../support/axe';
import { test, expect, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';

const ENTRIES = [
  { id: 501, date: '2026-11-10', index: 1, content: 'Coffee with @Marie at the market', tags: ['life'], visibility: 'private' as const },
  { id: 502, date: '2026-11-08', index: 1, content: 'Marie called about the move', tags: ['life'], visibility: 'private' as const },
  { id: 503, date: '2026-11-05', index: 1, content: 'A quiet day alone', tags: ['life'], visibility: 'private' as const },
];

async function expectNoAxeViolations(page: Page, selector: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .include(selector)
    .analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
}

const card = (page: Page, id: number) => page.locator(`#entry-${id}`);

test.describe('People check before sharing', () => {
  test('lists the people a public new entry names, replaces them in the composer, then saves it as written', async ({ page }) => {
    // New entries are public by default
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES, config: { defaultVisibility: 'public' } });
    await page.goto('/journal?diary=all');

    const form = page.locator('form').first();
    await expect(form.locator('button[title="Public - visible to everyone"]')).toBeVisible();
    const composer = page.getByPlaceholder("What's on your mind?");
    await composer.fill('Lunch with @Marie. marie loved the soup');
    await composer.press('Escape');
    const tagField = form.locator('input[placeholder="tags..."]');
    await tagField.fill('friends');
    await tagField.press('Enter');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    const check = page.getByRole('dialog', { name: 'People in what you share' });
    await expect(check).toContainText('Marie2 mentions');
    await expect(check.getByRole('combobox', { name: 'Replace Marie with' })).toBeFocused();
    await expectNoAxeViolations(page, '[role="dialog"]');
    await check.getByRole('combobox', { name: 'Replace Marie with' }).selectOption('a friend');
    await check.getByRole('button', { name: 'Replace' }).click();

    await expect(check).toHaveCount(0);
    await expect(composer).toHaveValue('Lunch with a friend. A friend loved the soup');
    expect(state.entries.some((entry) => entry.content.startsWith('Lunch with'))).toBe(false);

    // Read again, nothing is left to check: it is saved public at once
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Lunch with a friend. A friend loved the soup')).toBeVisible();
    await expect(check).toHaveCount(0);
    expect(state.entries.find((entry) => entry.content.startsWith('Lunch with'))?.visibility).toBe('public');
  });

  test('saves the new words of an entry made public from its card, and shares another one anyway', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES, config: { theme: 'light' } });
    await page.goto('/journal?diary=all');

    await card(page, 501).locator('button[title="Private - only you can see"]').click();
    const check = page.getByRole('dialog', { name: 'People in what you share' });
    await expect(check).toContainText('Marie1 mention');
    await expect(check).toContainText('Its earlier text stays in its history');
    await expectNoAxeViolations(page, '[role="dialog"]');
    await check.getByRole('button', { name: 'Replace' }).click();

    await expect(page.getByText('Names replaced in 1 entry. Read it again before sharing it.')).toBeVisible();
    await expect(card(page, 501)).toContainText('Coffee with M. at the market');
    expect(state.entries.find((entry) => entry.id === 501)).toMatchObject({ content: 'Coffee with M. at the market', visibility: 'private' });

    // Now it names no one, so it is made public at once
    await card(page, 501).locator('button[title="Private - only you can see"]').click();
    await expect(card(page, 501).locator('button[title="Public - visible to everyone"]')).toBeVisible();
    await expect(check).toHaveCount(0);

    // A name written without @ is checked too; Share anyway keeps it as written
    await card(page, 502).locator('button[title="Private - only you can see"]').click();
    await check.getByRole('button', { name: 'Share anyway' }).click();
    await expect(card(page, 502).locator('button[title="Public - visible to everyone"]')).toBeVisible();
    expect(state.entries.find((entry) => entry.id === 502)).toMatchObject({ content: 'Marie called about the move', visibility: 'public' });

    // An entry naming no one is not checked
    await card(page, 503).locator('button[title="Private - only you can see"]').click();
    await expect(card(page, 503).locator('button[title="Public - visible to everyone"]')).toBeVisible();
    await expect(check).toHaveCount(0);
  });
});
