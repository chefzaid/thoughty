import AxeBuilder from '../support/axe';
import { expect, test, type Locator, type Page } from '../support/test';

import type { MockEntry } from '../support/mockApp.shared';
import { mockDiary } from '../support/mockApp.diaries';
import { setupMockApp } from '../support/mockApp';

const entry = (id: number, date: string, content: string): MockEntry => ({
  id, date, index: 1, content, tags: ['walks'], visibility: 'private', diaryId: 1,
});

const ENTRIES: MockEntry[] = [
  // The goal is four words a day: met on March 3 only, and not yet on March 10, today
  entry(81, '2026-03-02', 'Canal walk.'),
  entry(82, '2026-03-03', 'Rain on the station roof.'),
  { ...entry(83, '2026-03-03', 'Soup for dinner.'), index: 2 },
  entry(84, '2026-03-10', 'Letters from grandmother.'),
];

const DIARIES = [mockDiary({ id: 1, name: 'Personal', isDefault: true, goalType: 'words_per_day', goalTarget: 4 })];

async function openStats(page: Page, config: { theme?: 'dark' | 'light'; language?: 'en' | 'fr' } = {}) {
  await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES, diaries: DIARIES, config });
  await page.clock.setFixedTime(new Date('2026-03-10T21:00:00'));
  await page.goto('/stats?diary=1');
  const grid = page.getByRole('grid', { name: /Journal Activity by Day|Activité du journal par jour/ });
  await expect(grid).toBeVisible();
  return grid;
}

const tooltip = (page: Page) => page.getByTestId('heatmap-tooltip');
const day = (grid: Locator, name: string) => grid.getByRole('gridcell', { name, exact: true });

async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .include('.heatmap-card')
    .analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
}

/** The box of an element, from the page's own layout. */
const box = (locator: Locator) => locator.evaluate((element) => {
  const rect = element.getBoundingClientRect();
  return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
});

/** Whether two boxes share any area. */
const overlaps = (a: Awaited<ReturnType<typeof box>>, b: Awaited<ReturnType<typeof box>>) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

test.describe('Journal activity by day', () => {
  test('keeps the key under the map, clear of the details of a day at the right edge', async ({ page }) => {
    const grid = await openStats(page);
    const legend = page.locator('.heatmap-legend');
    await expect(legend).toHaveText(/Less\s*More/);
    await grid.scrollIntoViewIfNeeded();
    const latest = day(grid, 'Tuesday, March 10, 2026. 1 entry. 3 words. Daily goal not met yet');
    await latest.hover();
    await expect(tooltip(page)).toBeVisible();

    const key = await box(legend);
    expect(key.top).toBeGreaterThan((await box(grid)).bottom);
    // The shades sit at the right, under the latest weeks, where the details of the latest days show
    expect(Math.abs(key.right - (await box(page.locator('.heatmap-shell'))).right)).toBeLessThan(24);
    expect(overlaps(await box(tooltip(page)), key)).toBe(false);
  });

  test('shows a day’s details, its words under its entries, on hover and pops the tile out without moving its neighbours', async ({ page }) => {
    const grid = await openStats(page);
    const tuesday = day(grid, 'Tuesday, March 3, 2026. 2 entries. 8 words. Daily goal met');
    const monday = day(grid, 'Monday, March 2, 2026. 1 entry. 2 words. Daily goal not met');
    // Where the neighbour sits in the map (hovering may scroll the page)
    const offset = () => monday.evaluate((element) => {
      const tile = element.getBoundingClientRect();
      const map = element.closest('[role="grid"]')!.getBoundingClientRect();
      return { left: tile.left - map.left, top: tile.top - map.top, width: tile.width };
    });
    await grid.scrollIntoViewIfNeeded();
    const before = await offset();

    await tuesday.hover();
    await expect(tooltip(page)).toHaveText('Tuesday, March 3, 2026' + '2 entries' + '8 words' + '✓ Daily goal met');
    await expect(tuesday).toHaveClass(/\btipped\b/);
    await expect.poll(() => tuesday.evaluate((element) => getComputedStyle(element).transform)).not.toBe('none');
    expect(await offset()).toEqual(before);
    // The tooltip sits near its day
    const tip = await box(tooltip(page));
    const tile = await box(tuesday);
    expect(Math.abs(tip.left + tip.width / 2 - (tile.left + tile.width / 2))).toBeLessThan(2);
    expect(tip.bottom).toBeLessThanOrEqual(tile.top);

    await page.mouse.move(5, 5);
    await expect(tooltip(page)).toHaveCount(0);
  });

  test('shows the active day’s details on keyboard focus and follows the arrows', async ({ page }) => {
    const grid = await openStats(page);
    await grid.focus();
    await expect(tooltip(page)).toHaveText('Tuesday, March 10, 2026' + '1 entry' + '3 words' + 'Daily goal not met yet');
    await page.keyboard.press('ArrowLeft');
    await expect(tooltip(page)).toHaveText('Tuesday, March 3, 2026' + '2 entries' + '8 words' + '✓ Daily goal met');
    await expect(day(grid, 'Tuesday, March 3, 2026. 2 entries. 8 words. Daily goal met')).toHaveClass(/\btipped\b/);
    await page.keyboard.press('Escape');
    await expect(tooltip(page)).toHaveCount(0);
    await page.keyboard.press('ArrowUp');
    await expect(tooltip(page)).toHaveText('Monday, March 2, 2026' + '1 entry' + '2 words' + 'Daily goal not met');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/journal/);
    await expect(page.getByText('Canal walk.')).toBeVisible();
  });

  test('a click opens the day in the journal', async ({ page }) => {
    const grid = await openStats(page);
    await day(grid, 'Tuesday, March 10, 2026. 1 entry. 3 words. Daily goal not met yet').click();
    await expect(page).toHaveURL(/\/journal/);
    await expect(page.getByText('Letters from grandmother.')).toBeVisible();
  });

  test('speaks French in the details, words included', async ({ page }) => {
    const grid = await openStats(page, { language: 'fr' });
    await day(grid, 'mardi 3 mars 2026. 2 entrées. 8 mots. Objectif du jour atteint').hover();
    await expect(tooltip(page)).toHaveText('mardi 3 mars 2026' + '2 entrées' + '8 mots' + '✓ Objectif du jour atteint');
    await day(grid, 'mercredi 4 mars 2026. Aucune entrée. Objectif du jour non atteint').hover();
    await expect(tooltip(page)).toHaveText('mercredi 4 mars 2026' + 'Aucune entrée' + 'Objectif du jour non atteint');
  });

  test('draws each day as its own tile, with a gap to the next day and the next week', async ({ page }) => {
    const grid = await openStats(page);
    const tiles = await grid.evaluate((element) => {
      const rect = (date: string) => element.querySelector(`[data-date="${date}"]`)!.getBoundingClientRect();
      const monday = rect('2026-03-02');
      return {
        size: monday.width,
        height: monday.height,
        dayPitch: rect('2026-03-03').top - monday.top,
        weekPitch: rect('2026-03-09').left - monday.left,
        radius: parseFloat(getComputedStyle(element.querySelector('[data-date="2026-03-02"]')!).borderTopLeftRadius),
      };
    });
    expect(tiles.size).toBeGreaterThanOrEqual(10);
    expect(tiles.height).toBeCloseTo(tiles.size, 1);
    expect(tiles.dayPitch - tiles.size).toBeGreaterThanOrEqual(3);
    expect(tiles.weekPitch - tiles.size).toBeGreaterThanOrEqual(3);
    expect(tiles.radius).toBeGreaterThan(0);
  });

  test('skips the pop-out animation when the system asks for less motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const grid = await openStats(page);
    const tile = day(grid, 'Tuesday, March 3, 2026. 2 entries. 8 words. Daily goal met');
    expect(await tile.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s');
  });

  for (const theme of ['dark', 'light'] as const) {
    for (const highContrast of [false, true]) {
      test(`${theme}${highContrast ? ' high contrast' : ''}: no accessibility violations with the details open`, async ({ page }) => {
        await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES, diaries: DIARIES, config: { theme, highContrast } });
        await page.clock.setFixedTime(new Date('2026-03-10T21:00:00'));
        await page.goto('/stats?diary=1');
        const grid = page.getByRole('grid', { name: 'Journal Activity by Day' });
        await grid.focus();
        await expect(tooltip(page)).toBeVisible();
        await expectNoAccessibilityViolations(page);
        await day(grid, 'Tuesday, March 3, 2026. 2 entries. 8 words. Daily goal met').hover();
        await expect(tooltip(page)).toContainText('Daily goal met');
        await expectNoAccessibilityViolations(page);
      });
    }
  }
});

test.describe('Journal activity by day on a phone', () => {
  test.use({ viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true });

  test('scrolls inside its card to the latest weeks, never the page, and keeps the details on screen', async ({ page }) => {
    const grid = await openStats(page);
    const scroll = await page.locator('.heatmap-shell').evaluate((shell) => ({
      scrolls: shell.scrollWidth > shell.clientWidth,
      atEnd: Math.abs(shell.scrollLeft + shell.clientWidth - shell.scrollWidth) <= 1,
      pageScrolls: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    expect(scroll).toEqual({ scrolls: true, atEnd: true, pageScrolls: false });

    // The latest day, at the right edge: its details stay inside the window
    const latest = day(grid, 'Tuesday, March 10, 2026. 1 entry. 3 words. Daily goal not met yet');
    await latest.tap();
    await expect(tooltip(page)).toBeVisible();
    const tip = await box(tooltip(page));
    expect(tip.left).toBeGreaterThanOrEqual(0);
    expect(tip.right).toBeLessThanOrEqual(375);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  });

  test('keeps the weekday names in place beside the year as it scrolls, with no day showing under them', async ({ page }) => {
    await openStats(page);
    const shell = page.locator('.heatmap-shell');
    const monday = page.locator('.heatmap-weekday-label').first();
    await expect(monday).toHaveText('Mon');
    const before = await box(monday);

    for (const scrollLeft of [0, 137]) {
      await shell.evaluate((element, left) => { element.scrollLeft = left; }, scrollLeft);
      expect(await box(monday)).toEqual(before);
      // Days are clipped at the scroll area's edge, to the right of the names
      const visibleTiles = await shell.evaluate((element) => {
        const edge = element.getBoundingClientRect().left;
        return [...element.querySelectorAll('[role="gridcell"]')]
          .map((tile) => tile.getBoundingClientRect())
          .filter((tile) => tile.right > edge)
          .map((tile) => Math.max(tile.left, edge));
      });
      expect(Math.min(...visibleTiles)).toBeGreaterThanOrEqual(before.right);
    }
    // Monday's name is level with Monday's row
    const mondayTile = await box(page.locator('[role="gridcell"][data-date="2026-03-09"]'));
    expect(Math.abs((before.top + before.bottom) / 2 - (mondayTile.top + mondayTile.bottom) / 2)).toBeLessThan(2);
  });

  for (const language of ['en', 'fr'] as const) {
    for (const goalType of ['words_per_day', 'entries_per_week'] as const) {
      test(`fits the key on one line in ${language} with a ${goalType} goal`, async ({ page }) => {
        const diaries = [mockDiary({ id: 1, name: 'Personal', isDefault: true, goalType, goalTarget: 4 })];
        await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES, diaries, config: { language } });
        await page.clock.setFixedTime(new Date('2026-03-10T21:00:00'));
        await page.goto('/stats?diary=1');
        const legend = page.locator('.heatmap-legend');
        await expect(legend.locator('.heatmap-legend-goal')).toHaveText(language === 'en'
          ? (goalType === 'words_per_day' ? 'Daily goal met' : '✓Weekly goal met')
          : (goalType === 'words_per_day' ? 'Objectif atteint' : '✓Objectif atteint'));
        const goal = await box(legend.locator('.heatmap-legend-goal'));
        const shades = await box(legend.locator('.heatmap-legend-shades'));
        // One line: the goal and the shades side by side, each on a single line of text
        expect(Math.abs(goal.top + goal.height / 2 - (shades.top + shades.height / 2))).toBeLessThan(2);
        expect(goal.right).toBeLessThan(shades.left);
        expect(goal.height).toBeLessThan(20);
        expect((await box(legend)).height).toBeLessThan(24);
      });
    }
  }

  test('a first tap shows the details and a second opens the day', async ({ page }) => {
    const grid = await openStats(page);
    const tuesday = day(grid, 'Tuesday, March 3, 2026. 2 entries. 8 words. Daily goal met');
    await tuesday.tap();
    await expect(tooltip(page)).toHaveText('Tuesday, March 3, 2026' + '2 entries' + '8 words' + '✓ Daily goal met' + 'Tap again to open the day');
    await expect(page).toHaveURL(/\/stats/);

    await tuesday.tap();
    await expect(page).toHaveURL(/\/journal/);
    await expect(page.getByText('Rain on the station roof.')).toBeVisible();
  });
});
