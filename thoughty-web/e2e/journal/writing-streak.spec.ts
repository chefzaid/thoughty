import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import type { MockEntry } from '../support/mockApp.shared';

const TODAY = '2026-10-27';
// The mock profile starts with the card off; these specs turn it on, as a new account has it
const ON = { streakCard: true };

const entry = (id: number, date: string, overrides: Partial<MockEntry> = {}): MockEntry => ({
  id, date, index: 1, content: `Notes from ${date}`, tags: [], visibility: 'private', diaryId: 1, ...overrides,
});

// Three days in a row up to today in Work, and one day in Personal
const STREAK = [
  entry(1, '2026-10-25'),
  entry(2, '2026-10-26'),
  entry(3, TODAY),
  entry(4, '2026-10-20', { diaryId: 2 }),
];

// Nothing written for a week; the last entry is a titled one
const AFTER_A_BREAK = [
  entry(11, '2026-10-12'),
  entry(12, '2026-10-20', { title: 'Harbor run', content: 'A morning run by the harbor, cold and bright.' }),
];

async function openJournal(page: Page, at = `${TODAY}T09:00:00`) {
  await page.clock.setFixedTime(new Date(at));
  await page.goto('/journal');
}

async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
}

test.describe('Writing streak card', () => {
  test('shows the days in a row up to the writer’s day, in the diary shown', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: STREAK, config: ON });
    await openJournal(page);

    const card = page.getByRole('region', { name: 'Writing streak' });
    await expect(card).toContainText('3 days in a row');
    await expect(card).toContainText("Today's page is written. Lovely to see you here.");

    // Personal's one entry is a week old: the card offers to pick up from it instead
    await page.getByRole('button', { name: /Personal/ }).click();
    await expect(card).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Pick up where you left off' })).toContainText('Notes from 2026-10-20');
  });

  test('keeps the streak while today is unwritten, and counts in French', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: STREAK.slice(0, 2), config: { ...ON, language: 'fr' } });
    await openJournal(page);

    const card = page.getByRole('region', { name: "Série d'écriture" });
    await expect(card).toContainText("2 jours d'affilée");
    await expect(card).toContainText("La page du jour vous attend, quand vous aurez envie d'écrire.");
  });

  test('after a break, offers to write now or reread the last entry, never counting a lost streak', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: AFTER_A_BREAK, config: ON });
    await openJournal(page);

    const prompt = page.getByRole('region', { name: 'Pick up where you left off' });
    await expect(prompt).toContainText('Welcome back. Your last entry is from October 20, 2026.');
    await expect(prompt).toContainText('Harbor run');
    await expect(prompt).toContainText('A morning run by the harbor, cold and bright.');
    await expect(prompt).not.toContainText(/in a row|streak|missed|lost/i);

    await prompt.getByRole('button', { name: 'Reread it' }).click();
    await expect(page).toHaveURL(/entry=12/);
    await expect(page.locator('#entry-12')).toBeInViewport();

    await prompt.getByRole('button', { name: 'Write now' }).click();
    const composer = page.getByPlaceholder("What's on your mind?");
    await expect(composer).toBeFocused();

    // Writing today ends the break: the offer goes away
    await composer.fill('Back at it this morning.');
    const tags = page.locator('form').first().locator('input[placeholder="tags..."]');
    await tags.fill('return');
    await tags.press('Enter');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => state.entries.map((saved) => saved.date)).toContain(TODAY);
    await expect(prompt).toHaveCount(0);
  });

  test('hides until tomorrow once dismissed', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: STREAK, config: ON });
    await openJournal(page);

    const card = page.getByRole('region', { name: 'Writing streak' });
    await card.getByRole('button', { name: 'Hide until tomorrow' }).click();
    await expect(card).toHaveCount(0);

    await page.reload();
    await expect(page.getByPlaceholder("What's on your mind?")).toBeVisible();
    await expect(card).toHaveCount(0);

    await openJournal(page, '2026-10-28T08:00:00');
    await expect(card).toContainText('3 days in a row');
  });

  test('can be turned off in Profile', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: STREAK, config: ON });
    await page.clock.setFixedTime(new Date(`${TODAY}T09:00:00`));
    await page.goto('/profile');

    const toggle = page.getByRole('switch', { name: 'Writing streak card' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect.poll(() => state.config.streakCard).toBe(false);

    await page.goto('/journal');
    await expect(page.getByPlaceholder("What's on your mind?")).toBeVisible();
    await expect(page.getByRole('region', { name: 'Writing streak' })).toHaveCount(0);
  });

  for (const theme of ['dark', 'light'] as const) {
    for (const highContrast of [false, true]) {
      const mode = `${theme}${highContrast ? ' high contrast' : ''}`;

      test(`passes an accessibility scan with the streak, ${mode}`, async ({ page }) => {
        await setupMockApp(page, { startAuthenticated: true, initialEntries: STREAK, config: { ...ON, theme, highContrast } });
        await openJournal(page);
        await expect(page.getByRole('region', { name: 'Writing streak' })).toContainText('3 days in a row');
        await expectNoAccessibilityViolations(page);
      });

      test(`passes an accessibility scan with the pick-up prompt, ${mode}`, async ({ page }) => {
        await setupMockApp(page, { startAuthenticated: true, initialEntries: AFTER_A_BREAK, config: { ...ON, theme, highContrast } });
        await openJournal(page);
        await expect(page.getByRole('region', { name: 'Pick up where you left off' })).toBeVisible();
        await expectNoAccessibilityViolations(page);
      });
    }
  }
});
