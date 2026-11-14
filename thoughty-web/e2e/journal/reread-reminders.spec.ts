import AxeBuilder from '../support/axe';
import { expect, test, type Page } from '../support/test';

import { setupMockApp } from '../support/mockApp';
import type { MockEntry, SetupMockAppOptions } from '../support/mockApp.shared';

const TODAY = '2026-10-31';
const moving: MockEntry = { id: 801, date: '2025-04-01', index: 1, title: 'Moving day', content: 'Boxes everywhere, and pizza on the floor.', tags: [], visibility: 'private', diaryId: 1 };
const swim: MockEntry = { id: 802, date: '2025-06-12', index: 1, content: 'First swim of the year, cold and bright.', tags: [], visibility: 'private', diaryId: 1 };

/** The journal on a fixed day, so the presets and the due reminders are known. */
async function openJournal(page: Page, initialEntries: MockEntry[], config: SetupMockAppOptions['config'] = {}) {
  await page.clock.setFixedTime(new Date(`${TODAY}T09:00:00`));
  const app = await setupMockApp(page, { startAuthenticated: true, config, initialEntries });
  await page.goto('/journal?diary=all');
  return app;
}

async function axeViolations(page: Page, selector: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .include(selector)
    .analyze();
  return results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));
}

test.describe('Reread reminders', () => {
  test('asks to reread an entry in a week from More actions, shows the day on its card and removes it', async ({ page }) => {
    const { state } = await openJournal(page, [moving, swim]);
    const card = page.locator('#entry-801');

    await card.getByRole('button', { name: 'More actions' }).click();
    await card.getByRole('menuitem', { name: 'Remind me to reread…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Remind me to reread' });
    await expect(dialog).toContainText('April 1, 2025 · Moving day');
    await expect(dialog.getByLabel('Day to reread it')).toBeFocused();
    await expect(dialog.getByLabel('Day to reread it')).toHaveValue('2026-11-07');
    await expect(dialog.getByRole('button', { name: 'In a week' })).toHaveAttribute('aria-pressed', 'true');
    expect(await axeViolations(page, '[role="dialog"]')).toEqual([]);

    await dialog.getByRole('button', { name: 'In a month' }).click();
    await expect(dialog.getByLabel('Day to reread it')).toHaveValue('2026-11-30');
    const saved = page.waitForRequest((request) => request.method() === 'PUT' && request.url().endsWith('/api/entries/801/reread-reminder'));
    await dialog.getByRole('button', { name: 'Remind me' }).click();
    expect((await saved).postDataJSON()).toEqual({ rereadOn: '2026-11-30', today: TODAY });

    await expect(dialog).toHaveCount(0);
    await expect(card.getByRole('button', { name: 'More actions' })).toBeFocused();
    await expect(card.getByText('Reread on November 30, 2026')).toBeVisible();
    expect(state.entries.find((entry) => entry.id === 801)?.rereadOn).toBe('2026-11-30');

    await card.getByRole('button', { name: 'Remove the reminder to reread on November 30, 2026' }).click();
    await expect(card.getByText(/Reread on/)).toHaveCount(0);
    expect(state.entries.find((entry) => entry.id === 801)?.rereadOn).toBeNull();
  });

  test('refuses today as the day to reread, and replaces an earlier day with a new one', async ({ page }) => {
    await openJournal(page, [{ ...moving, rereadOn: '2027-01-15' }]);
    const card = page.locator('#entry-801');
    await expect(card.getByText('Reread on January 15, 2027')).toBeVisible();

    await card.getByRole('button', { name: 'More actions' }).click();
    await card.getByRole('menuitem', { name: 'Remind me to reread…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Remind me to reread' });
    const day = dialog.getByLabel('Day to reread it');
    await expect(day).toHaveValue('2027-01-15');
    await day.fill(TODAY);
    await dialog.getByRole('button', { name: 'Remind me' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Choose a day from tomorrow up to 50 years ahead.');

    await dialog.getByRole('button', { name: 'In a year' }).click();
    await expect(dialog.getByRole('alert')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Remind me' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(card.getByText('Reread on October 31, 2027')).toBeVisible();
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`shows due entries in Highlights after opened capsules and takes one off when done, in the ${theme} theme`, async ({ page }) => {
      await openJournal(page, [{ ...moving, rereadOn: '2026-10-20' }, { ...swim, rereadOn: TODAY }, { id: 803, date: '2025-08-01', index: 1, content: 'Not yet', tags: [], visibility: 'private', diaryId: 1, rereadOn: '2026-11-07' }], { theme });

      await page.getByRole('button', { name: 'Highlights' }).click();
      const highlights = page.getByRole('dialog', { name: 'Highlights' });
      const section = highlights.locator('.reread-reminders');
      await expect(section.getByRole('heading', { name: 'You asked to reread this' })).toBeVisible();
      await expect(section.locator('.highlight-card')).toHaveCount(2);
      await expect(section.locator('.highlight-card').first()).toContainText('You asked for October 20, 2026');
      await expect(section).not.toContainText('Not yet');
      expect(await axeViolations(page, '.thought-of-day-modal')).toEqual([]);

      await section.getByRole('button', { name: 'Done rereading the entry of April 1, 2025' }).click();
      await expect(section.getByRole('status')).toHaveText('The entry of April 1, 2025 is off your reread list.');
      await expect(section.locator('.highlight-card')).toHaveCount(1);
      await expect(section).toContainText('First swim of the year');

      await section.getByRole('button', { name: /First swim of the year/ }).click();
      await expect(highlights).toHaveCount(0);
      await expect(page.locator('#entry-802')).toHaveClass(/highlight-entry/);
      await expect(page.locator('#entry-801').getByText(/Reread on/)).toHaveCount(0);
      await expect(page.locator('#entry-802').getByText('Reread on October 31, 2026')).toBeVisible();
    });
  }

  test('speaks French', async ({ page }) => {
    await openJournal(page, [{ ...moving, rereadOn: '2026-10-20' }], { language: 'fr' });
    const card = page.locator('#entry-801');
    await expect(card.getByText('À relire le 20 octobre 2026')).toBeVisible();

    await card.getByRole('button', { name: "Plus d'actions" }).click();
    await card.getByRole('menuitem', { name: 'Me rappeler de relire…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Me rappeler de relire' });
    await expect(dialog.getByRole('button', { name: 'Dans une semaine' })).toBeVisible();
    await page.keyboard.press('Escape');

    // The button, the dialog it opens and the reminder's hint all call it "Moments forts"
    await page.getByRole('button', { name: 'Moments forts' }).click();
    const highlights = page.getByRole('dialog', { name: 'Moments forts' });
    await expect(highlights.getByRole('heading', { name: 'Moments forts', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Vous avez demandé à relire ceci' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Relecture terminée pour l’entrée du 1 avril 2025' })).toBeVisible();
  });
});
