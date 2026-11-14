import AxeBuilder from '../support/axe';
import { test, expect } from '../support/test';
import { setupMockApp } from '../support/mockApp';

test.describe('Journal highlights', () => {
  test('shows random and on-this-day highlights and navigates back to the highlighted journal entry', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [
        {
          id: 101,
          date: '2024-04-18',
          index: 1,
          content: 'Private focus reflection for filtering',
          tags: ['focus', 'reflection'],
          visibility: 'private',
          diaryId: 1,
        },
        {
          id: 102,
          date: '2024-04-17',
          index: 1,
          content: 'Earlier highlight memory',
          tags: ['memory'],
          visibility: 'private',
          diaryId: 2,
        },
      ],
    });

    // A year after the earlier entry, so On this day shows it
    await page.clock.setFixedTime(new Date('2025-04-17T12:00:00'));
    await page.goto('/journal?diary=all');
    await page.getByRole('button', { name: 'Highlights' }).click();

    await expect(page.getByRole('heading', { name: 'Highlights' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Random Thought' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'On This Day' })).toBeVisible();

    await page.getByRole('button', { name: /Private focus reflection for filtering/ }).click();

    await expect(page).toHaveURL(/\/journal\?diary=all$/);
    await expect(page.locator('#entry-101')).toHaveClass(/highlight-entry/);
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`keeps keyboard focus inside the highlights dialog in the ${theme} theme`, async ({ page }) => {
      const today = '2026-06-15';
      const lastYear = '2025-06-15';
      await page.clock.setFixedTime(new Date(`${today}T12:00:00`));
      await setupMockApp(page, {
        startAuthenticated: true,
        config: { theme },
        initialEntries: [
          { id: 201, date: today, index: 1, content: 'Written today', tags: [], visibility: 'private', diaryId: 1 },
          { id: 202, date: lastYear, index: 1, content: 'Written a year ago', tags: [], visibility: 'private', diaryId: 1 },
        ],
      });
      await page.goto('/journal?diary=all');

      const trigger = page.getByRole('button', { name: 'Highlights' });
      await trigger.focus();
      await page.keyboard.press('Enter');

      const dialog = page.getByRole('dialog', { name: 'Highlights' });
      await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
      await expect(dialog.getByRole('button', { name: /Written a year ago/ })).toBeVisible();

      for (let press = 0; press < 8; press += 1) {
        await page.keyboard.press('Tab');
        await expect(dialog.locator(':focus')).toHaveCount(1);
      }
      await page.keyboard.press('Shift+Tab');
      await expect(dialog.locator(':focus')).toHaveCount(1);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .include('.thought-of-day-modal')
        .analyze();
      expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);

      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });
  }

  test('opens without sliding, spinning or lifting its cards when the system asks for less motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.setFixedTime(new Date('2025-04-17T12:00:00'));
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [
        { id: 301, date: '2025-04-17', index: 1, content: 'Written today', tags: [], visibility: 'private', diaryId: 1 },
        { id: 302, date: '2024-04-17', index: 1, content: 'Written a year ago', tags: [], visibility: 'private', diaryId: 1 },
      ],
    });
    let answerHighlights = () => {};
    const highlightsHeld = new Promise<void>((resolve) => { answerHighlights = resolve; });
    await page.route('http://localhost:5173/api/entries/highlights**', async (route) => {
      await highlightsHeld;
      await route.fallback();
    });
    await page.goto('/journal?diary=all');
    await page.getByRole('button', { name: 'Highlights' }).click();

    const dialog = page.getByRole('dialog', { name: 'Highlights' });
    const styleOf = (selector: string, property: 'animationName' | 'animationDuration' | 'transitionDuration') =>
      page.locator(selector).first().evaluate((element, name) => getComputedStyle(element)[name], property);
    // The loader fades in place instead of spinning while the highlights load
    await expect(dialog.locator('.spinner')).toBeVisible();
    expect(await styleOf('.thought-of-day-loading .spinner', 'animationName')).toBe('motion-loader-fade');

    answerHighlights();
    await expect(dialog.getByRole('button', { name: /Written a year ago/ })).toBeVisible();
    expect(await styleOf('.thought-of-day-overlay', 'animationDuration')).toBe('0s');
    expect(await styleOf('.thought-of-day-modal', 'animationDuration')).toBe('0s');
    const running = () => page.evaluate(() => document.getAnimations()
      .filter((animation) => animation.playState === 'running')
      .map((animation) => (animation as CSSAnimation).animationName ?? (animation as CSSTransition).transitionProperty));
    expect(await running()).toEqual([]);

    // Hovering a card or the refresh button moves nothing over time
    await dialog.locator('.highlight-card').first().hover();
    expect(await styleOf('.highlight-card', 'transitionDuration')).toBe('0s');
    await dialog.locator('.action-button.refresh').first().hover();
    expect(await styleOf('.action-button.refresh svg', 'animationDuration')).toBe('0s');
    expect(await running()).toEqual([]);
  });
});
