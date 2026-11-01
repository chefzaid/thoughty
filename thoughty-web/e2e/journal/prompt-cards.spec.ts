import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '../support/test';
import { setupMockApp } from '../support/mockApp';

const places = (count: number) => Array.from({ length: count }, (_, index) => `places-${index + 1}`);

test.describe('Prompt cards', () => {
  test('draws a card from the keyboard, with no AI at all, and writes about it in the entry', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    const aiRequests: string[] = [];
    await page.route('http://localhost:5173/api/ai/**', async (route) => {
      aiRequests.push(route.request().url());
      await route.fulfill({ status: 503, json: { code: 'AI_NOT_CONFIGURED', message: 'No AI key' } });
    });
    await page.goto('/journal?diary=1');

    const editor = page.getByPlaceholder("What's on your mind?");
    await editor.fill('A quiet Sunday.');
    const draw = page.getByRole('button', { name: 'Draw a card' });
    await draw.focus();
    await page.keyboard.press('Enter');

    const deck = page.getByRole('dialog', { name: 'Prompt cards' });
    await expect(deck).toBeVisible();
    const card = deck.getByRole('figure');
    await expect(card).toHaveAccessibleName(/^(Gratitude|Decisions|People|Places|Small joys) card$/);
    await expect(deck.getByText('59 cards left before the deck is shuffled')).toBeVisible();
    await expect.poll(() => state.config.promptCardsDrawn).toMatch(/^[a-zA-Z]+-\d+$/);

    // Tab back to the theme picker and draw from one theme only
    await page.keyboard.press('Shift+Tab');
    await expect(deck.getByRole('combobox', { name: 'Theme' })).toBeFocused();
    await deck.getByRole('combobox', { name: 'Theme' }).selectOption({ label: 'Small joys' });
    await expect(card).toHaveAccessibleName('Small joys card');
    const question = (await card.locator('blockquote').textContent()) ?? '';
    expect(question).toMatch(/[?.]$/);

    await deck.getByRole('button', { name: 'Write about this' }).focus();
    await page.keyboard.press('Enter');
    await expect(deck).toBeHidden();
    await expect(draw).toBeFocused();
    await expect(editor).toHaveValue(`A quiet Sunday.\n\n${question}`);
    expect(state.config.promptCardsDrawn?.split(',')).toHaveLength(2);
    expect(aiRequests).toEqual([]);
  });

  test('repeats no card until its deck is used up, across a reload, and says when it shuffles', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      config: { promptCardsDrawn: places(11).join(',') },
    });
    await page.goto('/journal?diary=1');

    await page.getByRole('button', { name: 'Draw a card' }).click();
    const deck = page.getByRole('dialog', { name: 'Prompt cards' });
    await deck.getByRole('combobox', { name: 'Theme' }).selectOption({ label: 'Places' });
    // Only the twelfth place is left
    const card = deck.getByRole('figure', { name: 'Places card' });
    await expect(card).toContainText('Where would you like to live in ten years');
    await expect(deck.getByText('0 cards left before the deck is shuffled')).toBeVisible();
    await expect.poll(() => state.config.promptCardsDrawn?.split(',').filter((id) => id.startsWith('places-')).length).toBe(12);

    await page.reload();
    await page.getByRole('button', { name: 'Draw a card' }).click();
    await deck.getByRole('combobox', { name: 'Theme' }).selectOption({ label: 'Places' });
    await expect(deck.getByText('You had drawn every card here, so the deck was shuffled again.')).toBeVisible();
    await expect(card).not.toContainText('Where would you like to live in ten years');
    await expect.poll(() => state.config.promptCardsDrawn?.split(',').filter((id) => id.startsWith('places-')).length).toBe(1);

    await page.keyboard.press('Escape');
    await expect(deck).toBeHidden();
  });

  test('draws French cards in French and passes an accessibility scan', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr', theme: 'light' } });
    await page.goto('/journal?diary=1');

    await page.getByRole('button', { name: 'Tirer une carte' }).click();
    const deck = page.getByRole('dialog', { name: 'Cartes questions' });
    await deck.getByRole('combobox', { name: 'Thème' }).selectOption({ label: 'Petits bonheurs' });
    await expect(deck.getByRole('figure', { name: 'Carte « Petits bonheurs »' })).toBeVisible();
    await expect(deck.getByText(/^Encore 1[01] cartes avant de remélanger le paquet$/)).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
  });
});
