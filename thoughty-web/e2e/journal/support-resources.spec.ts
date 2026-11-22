import AxeBuilder from '../support/axe';
import { expect, test, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';

const EN_TITLE = "You don't have to face this alone";
const FR_TITLE = "De l'aide est là pour vous";

const card = (page: Page, name = EN_TITLE) => page.getByRole('region', { name });

/** Writes and saves an entry in the composer, in English or French. */
async function writeEntry(page: Page, text: string, fr = false) {
  const form = page.locator('form').first();
  await page.getByPlaceholder(fr ? "Qu'avez-vous à l'esprit ?" : "What's on your mind?").fill(text);
  const tags = form.locator('input[placeholder="tags..."]');
  await tags.fill('days');
  await tags.press('Enter');
  await page.getByRole('button', { name: fr ? 'Enregistrer' : 'Save', exact: true }).click();
  await expect(page.locator('[id^="entry-"]', { hasText: text })).toBeVisible();
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page })
    .include('[data-testid="support-resources"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));
}

test.describe('Support resources when words signal a crisis', () => {
  test('follows a save that signals a crisis with the crisis lines, without taking focus, until closed', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/journal');

    await writeEntry(page, 'A calm evening with tea.');
    await expect(page.getByTestId('support-resources')).toHaveCount(0);

    await writeEntry(page, 'Some nights I just want to die.');
    const support = card(page);
    await expect(support).toBeVisible();
    await expect(support.getByRole('link', { name: '3114' })).toHaveAttribute('href', 'tel:3114');
    await expect(support.getByRole('link', { name: 'findahelpline.com' })).toHaveAttribute('href', 'https://findahelpline.com');
    await expect(page.locator('[role="status"]', { hasText: EN_TITLE })).toContainText('If you are thinking about suicide');
    expect(await page.evaluate(() => document.activeElement?.closest('[data-testid="support-resources"]') ?? null)).toBeNull();
    expect(await axe(page)).toEqual([]);

    await support.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTestId('support-resources')).toHaveCount(0);

    // A later save that signals a crisis shows it again; Escape inside the card closes it
    await writeEntry(page, 'I keep thinking about suicide.');
    await expect(card(page)).toBeVisible();
    await card(page).getByRole('link', { name: '112' }).focus();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('support-resources')).toHaveCount(0);
  });

  test('speaks French and passes the scan in the light theme', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr', theme: 'light' } });
    await page.goto('/journal');

    await writeEntry(page, "Je n'ai plus envie de vivre.", true);
    const support = card(page, FR_TITLE);
    await expect(support).toBeVisible();
    await expect(support).toContainText('numéro national de prévention du suicide');
    await expect(support.getByRole('button', { name: 'Fermer' })).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

  test('shows the crisis lines inside the AI chat when the writer signals a crisis, and Escape there keeps the chat open', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [{ id: 101, date: '2024-04-18', index: 1, content: 'A long week at work.', tags: ['work'], visibility: 'private', diaryId: 1 }],
    });
    await page.goto('/journal');

    await page.locator('#entry-101').getByTitle('Discuss with AI').click();
    const dialog = page.getByRole('dialog', { name: 'AI Chat' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('support-resources')).toHaveCount(0);

    const input = dialog.getByPlaceholder('Ask something about this entry...');
    await input.fill('Honestly I want to kill myself.');
    await input.press('Enter');
    const support = dialog.getByRole('region', { name: EN_TITLE });
    await expect(support).toBeVisible();
    await expect(support.getByRole('heading', { level: 4, name: EN_TITLE })).toBeVisible();
    expect(await axe(page)).toEqual([]);

    await support.getByRole('link', { name: '988' }).focus();
    await page.keyboard.press('Escape');
    await expect(dialog.getByTestId('support-resources')).toHaveCount(0);
    await expect(dialog).toBeVisible();
  });
});
