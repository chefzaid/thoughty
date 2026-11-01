import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import type { MockEntry } from '../support/mockApp.shared';

const TODAY = '2026-11-01';

const firing: MockEntry = {
  id: 701,
  date: '2026-09-10',
  index: 1,
  content: 'The **first** glaze firing went well. The blue ran a little.\n\n- [ ] Order more clay',
  tags: ['craft'],
  visibility: 'public',
  format: 'markdown',
  diaryId: 1,
};

const secret: MockEntry = {
  id: 702,
  date: '2026-10-20',
  index: 2,
  content: 'Told nobody about the offer yet, and I am not sure I will take it at all, because the move would mean leaving the workshop, the river walks and everyone I know here behind for a city I have only seen twice.',
  tags: [],
  visibility: 'private',
  diaryId: 1,
};

const ofToday: MockEntry = { id: 703, date: TODAY, index: 1, content: 'Morning pages.', tags: [], visibility: 'private', diaryId: 1 };

const capsule: MockEntry = {
  id: 704,
  date: '2026-08-01',
  index: 1,
  content: 'A letter for next summer.',
  tags: [],
  visibility: 'private',
  diaryId: 1,
  capsule: { openAt: '2027-08-01T08:00:00.000Z', sealedAt: '2026-08-01T10:00:00.000Z', openedAt: null },
};

const fillOf = (locator: Locator) => locator.evaluate((element) => getComputedStyle(element).webkitTextFillColor);

test.describe('Reply to your past self', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date(`${TODAY}T12:00:00`));
  });

  test('quotes an older Markdown entry, saves the reply on today, and each shows the other', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: [firing, ofToday, capsule] });
    await page.goto('/journal');

    // Offered on older entries only: not on today's, nor on a sealed time capsule
    const oldCard = page.locator('#entry-701');
    const reply = oldCard.getByRole('button', { name: 'Write a reply to the entry of September 10, 2026' });
    await expect(reply).toHaveAttribute('title', 'Write a reply');
    await expect(page.locator('#entry-703')).toBeVisible();
    await expect(page.locator('#entry-703').getByRole('button', { name: /Write a reply/ })).toHaveCount(0);
    await expect(page.locator('#entry-704').getByRole('button', { name: /Write a reply/ })).toHaveCount(0);
    await expect(oldCard.getByText('Backlinks')).toHaveCount(0);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .include('#entry-701')
      .analyze();
    expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);

    await reply.click();
    const form = page.locator('form').first();
    const text = form.getByPlaceholder("What's on your mind?");
    const quote = '> The first glaze firing went well.\n\n— [[2026-09-10#1]]\n\n';
    await expect(text).toHaveValue(quote);
    await expect(text).toBeFocused();
    await page.keyboard.type('The blue is my favourite now.');
    await expect(text).toHaveValue(`${quote}The blue is my favourite now.`);
    // Nothing is copied but the quote: tags are the writer's to pick
    await expect(form.getByRole('button', { name: 'Remove craft tag' })).toHaveCount(0);
    await form.locator('input[placeholder="tags..."]').fill('craft');
    await form.locator('input[placeholder="tags..."]').press('Enter');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect.poll(() => state.entries.find((entry) => entry.id > 704)).toMatchObject({
      date: TODAY,
      content: `${quote}The blue is my favourite now.`,
      format: 'markdown',
      tags: ['craft'],
    });
    const replyId = state.entries.find((entry) => entry.id > 704)?.id;

    // The old entry's backlinks show the reply at once, without a reload
    const backlink = oldCard.getByRole('button', { name: new RegExp(`^${TODAY}`) });
    await expect(backlink).toContainText('The blue is my favourite now.');
    await expect(oldCard.getByText('1 link', { exact: true })).toBeVisible();

    // and the reply links back to the old entry
    const replyCard = page.locator(`#entry-${replyId}`);
    await expect(replyCard.locator('blockquote')).toHaveText('The first glaze firing went well.');
    await replyCard.locator('.entry-reference-link', { hasText: '2026-09-10' }).click();
    await expect(oldCard).toHaveClass(/highlight-entry/);
  });

  test('keeps a reply to a private entry private, quotes plain text in French, and stays blurred', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [secret],
      config: { language: 'fr', defaultVisibility: 'public' },
    });
    await page.goto('/journal');

    const blur = page.getByRole('navigation').getByRole('button', { name: 'Flouter le texte des entrées' });
    await blur.click();
    await expect(blur).toHaveAttribute('aria-pressed', 'true');

    // The name tells the entry by its date and number only, never by its blurred words
    await page.locator('#entry-702').getByRole('button', { name: "Écrire une réponse à l'entrée 2 du 20 octobre 2026" }).click();
    const text = page.locator('form').first().locator('textarea');
    const quoted = await text.inputValue();
    // The first sentence runs past 200 characters, so it is cut on a word
    expect(quoted).toBe('«\u00A0Told nobody about the offer yet, and I am not sure I will take it at all, because the move would mean '
      + 'leaving the workshop, the river walks and everyone I know here behind for a city I have only seen…\u00A0» — [[2026-10-20#2]]\n\n');
    expect(await fillOf(text)).toBe('rgba(0, 0, 0, 0)');

    await page.locator('form').first().locator('input[placeholder="tags..."]').fill('travail');
    await page.locator('form').first().locator('input[placeholder="tags..."]').press('Enter');
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect.poll(() => state.entries.find((entry) => entry.id !== 702)).toMatchObject({
      date: TODAY,
      visibility: 'private',
      format: 'plain',
    });
    await expect(page.locator('#entry-702').getByRole('button', { name: new RegExp(`^${TODAY}`) })).toBeVisible();
  });
});
